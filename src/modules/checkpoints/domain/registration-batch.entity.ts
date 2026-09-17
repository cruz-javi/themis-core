export type RegistrationBatchStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'INSERTED'
  | 'INSERTION_FAILED';

export class RegistrationBatch {
  constructor(
    public readonly id: string,
    public readonly electionId: string,
    public readonly status: RegistrationBatchStatus,
    public readonly credentialCount: number,
    public readonly approvalsRequired: number,
    public readonly closedAt: Date,
    public readonly merkleRootBefore: string | null = null,
    public readonly merkleRootAfter: string | null = null,
    public readonly onChainTxHash: string | null = null,
    public readonly onChainGroupId: string | null = null,
    public readonly approvedAt: Date | null = null,
    public readonly insertedAt: Date | null = null,
    public readonly failureReason: string | null = null,
  ) {}
}
