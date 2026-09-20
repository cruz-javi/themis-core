import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VotesController } from './presentation/votes.controller';
import { AuditController } from './presentation/audit.controller';
import { SubmitVoteUseCase } from './application/submit-vote.usecase';
import { GetVotingContextUseCase } from './application/get-voting-context.usecase';
import { GetLiveTallyUseCase } from './application/get-live-tally.usecase';
import { SyncVoteEventsUseCase } from './application/sync-vote-events.usecase';
import { ExecuteFinalCountUseCase } from './application/execute-final-count.usecase';
import { GetAuditResultUseCase } from './application/get-audit-result.usecase';
import { PrismaVoteSubmissionRepository } from './infrastructure/prisma-vote-submission.repository';
import { PrismaChainSyncStateRepository } from './infrastructure/prisma-chain-sync-state.repository';
import { PrismaElectionResultRepository } from './infrastructure/prisma-election-result.repository';
import { SemaphoreVoteOnChainService } from './infrastructure/semaphore-vote-onchain.service';
import { VotingScheduler } from './infrastructure/voting.scheduler';
import { VOTE_SUBMISSION_REPOSITORY } from './domain/vote-submission.repository';
import { CHAIN_SYNC_STATE_REPOSITORY } from './domain/chain-sync-state.repository';
import { ELECTION_RESULT_REPOSITORY } from './domain/election-result.repository';
import { VOTE_ONCHAIN_PORT } from './domain/vote-onchain.port';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { ElectionsModule } from '../elections/elections.module';
import { CheckpointsModule } from '../checkpoints/checkpoints.module';
import { BlockchainModule } from '../../shared/blockchain/blockchain.module';

@Module({
  imports: [
    AuthSharedModule,
    ElectionsModule,
    CheckpointsModule,
    ScheduleModule.forRoot(),
    BlockchainModule,
  ],
  controllers: [VotesController, AuditController],
  providers: [
    SubmitVoteUseCase,
    GetVotingContextUseCase,
    GetLiveTallyUseCase,
    SyncVoteEventsUseCase,
    ExecuteFinalCountUseCase,
    GetAuditResultUseCase,
    VotingScheduler,
    { provide: VOTE_SUBMISSION_REPOSITORY, useClass: PrismaVoteSubmissionRepository },
    { provide: CHAIN_SYNC_STATE_REPOSITORY, useClass: PrismaChainSyncStateRepository },
    { provide: ELECTION_RESULT_REPOSITORY, useClass: PrismaElectionResultRepository },
    { provide: VOTE_ONCHAIN_PORT, useClass: SemaphoreVoteOnChainService },
  ],
})
export class VotingModule {}
