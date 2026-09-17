import { Inject, Injectable } from '@nestjs/common';
import { ELECTION_REPOSITORY, ElectionRepository } from '../../elections/domain/election.repository';
import { ElectionNotFoundError } from '../../elections/application/election.errors';
import {
  PRESENTED_CREDENTIAL_REPOSITORY,
  PresentedCredentialRepository,
} from '../domain/presented-credential.repository';
import { PresentedCredential } from '../domain/presented-credential.entity';
import { RegistrationSigningService } from '../infrastructure/registration-signing.service';
import { assertElectionNotClosed } from './registration-validation';
import { CredentialAlreadyPresentedError, CredentialInvalidSignatureError } from './registration.errors';

export interface PresentCredentialInput {
  preparedMessage: string;
  signature: string;
}

// RFC 9474 (modo Randomized, el unico que usa este proyecto): el mensaje
// realmente firmado es `random(32 bytes) || mensaje original`. El commitment
// real se extrae recortando ese prefijo - no hace falta que el cliente lo
// mande aparte, y confiar en el solo tiene sentido una vez que la firma ya
// verifico contra ese mismo preparedMessage.
const RANDOMIZED_PREFIX_BYTES = 32;

function extractCommitment(preparedMessageBase64: string): string {
  const preparedMessage = Buffer.from(preparedMessageBase64, 'base64');
  return preparedMessage.subarray(RANDOMIZED_PREFIX_BYTES).toString('utf8');
}

@Injectable()
export class PresentCredentialUseCase {
  constructor(
    @Inject(ELECTION_REPOSITORY)
    private readonly electionRepository: ElectionRepository,
    @Inject(PRESENTED_CREDENTIAL_REPOSITORY)
    private readonly presentedCredentialRepository: PresentedCredentialRepository,
    private readonly registrationSigning: RegistrationSigningService,
  ) {}

  async execute(
    electionId: string,
    input: PresentCredentialInput,
  ): Promise<PresentedCredential> {
    const election = await this.electionRepository.findById(electionId);
    if (!election) {
      throw new ElectionNotFoundError();
    }
    assertElectionNotClosed(election);

    const isValid = await this.registrationSigning.verify(
      input.preparedMessage,
      input.signature,
    );
    if (!isValid) {
      throw new CredentialInvalidSignatureError();
    }

    const commitment = extractCommitment(input.preparedMessage);

    const existing = await this.presentedCredentialRepository.findByElectionAndCommitment(
      electionId,
      commitment,
    );
    if (existing) {
      throw new CredentialAlreadyPresentedError();
    }

    return this.presentedCredentialRepository.create({
      electionId,
      commitment,
      preparedMessage: input.preparedMessage,
      signature: input.signature,
    });
  }
}
