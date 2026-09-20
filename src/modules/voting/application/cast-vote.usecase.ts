import { Inject, Injectable } from '@nestjs/common';
import {
  VOTING_REPOSITORY,
  type VotingRepository,
} from '../domain/voting.repository';
import {
  ElectionNotFoundError,
  ElectionNotOpenForVotingError,
  OptionNotFoundError,
  DuplicateVoteError,
} from '../domain/voting.errors';
import {
  VotingOnChainService,
  type OnChainVoteProof,
} from '../infrastructure/voting-onchain.service';
import type { VoteReceiptEntity } from '../domain/vote-receipt.entity';

export interface CastVoteInput {
  electionId: string;
  optionId: string;
  proof: OnChainVoteProof;
}

@Injectable()
export class CastVoteUseCase {
  constructor(
    @Inject(VOTING_REPOSITORY)
    private readonly votingRepository: VotingRepository,
    private readonly onChainService: VotingOnChainService,
  ) {}

  async execute(input: CastVoteInput): Promise<VoteReceiptEntity> {
    const election = await this.votingRepository.findPublicElectionById(
      input.electionId,
    );
    if (!election) {
      throw new ElectionNotFoundError();
    }

    if (election.estado !== 'VOTACION_ABIERTA') {
      throw new ElectionNotOpenForVotingError();
    }

    const optionExists = election.opciones.some((o) => o.id === input.optionId);
    if (!optionExists) {
      throw new OptionNotFoundError();
    }

    if (!election.onChainGroupId) {
      throw new ElectionNotOpenForVotingError(
        'La elección no tiene un grupo Semaphore inicializado on-chain',
      );
    }

    // Verificación rápida en base de datos para evitar gastar gas si el nullifier ya se vio
    const existingReceipt =
      await this.votingRepository.findVoteReceiptByNullifier(
        input.proof.nullifier,
      );
    if (existingReceipt) {
      throw new DuplicateVoteError();
    }

    // Enviar transacción a blockchain vía Relayer (verificación on-chain de Semaphore)
    const onChainResult = await this.onChainService.castVote(
      election.onChainGroupId,
      input.proof,
    );

    // Guardar el recibo anónimo en base de datos
    return this.votingRepository.saveVoteReceipt({
      electionId: input.electionId,
      optionId: input.optionId,
      nullifier: input.proof.nullifier,
      txHash: onChainResult.txHash,
    });
  }
}
