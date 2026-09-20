import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { MockSsoModule } from '../mock-sso/mock-sso.module';
import { VotingController } from './presentation/voting.controller';
import { ListPublicElectionsUseCase } from './application/list-public-elections.usecase';
import { GetPublicElectionUseCase } from './application/get-public-election.usecase';
import { GetMerkleTreeUseCase } from './application/get-merkle-tree.usecase';
import { CastVoteUseCase } from './application/cast-vote.usecase';
import { GetVoterStatusUseCase } from './application/get-voter-status.usecase';
import { PrismaVotingRepository } from './infrastructure/prisma-voting.repository';
import { VotingOnChainService } from './infrastructure/voting-onchain.service';
import { VOTING_REPOSITORY } from './domain/voting.repository';

@Module({
  imports: [PrismaModule, MockSsoModule],
  controllers: [VotingController],
  providers: [
    ListPublicElectionsUseCase,
    GetPublicElectionUseCase,
    GetMerkleTreeUseCase,
    CastVoteUseCase,
    GetVoterStatusUseCase,
    VotingOnChainService,
    {
      provide: VOTING_REPOSITORY,
      useClass: PrismaVotingRepository,
    },
  ],
  exports: [VOTING_REPOSITORY],
})
export class VotingModule {}
