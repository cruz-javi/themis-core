import { PresentedCredential } from '../../src/modules/registration/domain/presented-credential.entity';
import type {
  CreatePresentedCredentialInput,
  PresentedCredentialRepository,
} from '../../src/modules/registration/domain/presented-credential.repository';

export class InMemoryPresentedCredentialRepository implements PresentedCredentialRepository {
  private readonly credentials: PresentedCredential[] = [];
  private sequence = 0;

  async create(input: CreatePresentedCredentialInput): Promise<PresentedCredential> {
    this.sequence += 1;
    const credential = new PresentedCredential(
      `presented-credential-${this.sequence}`,
      input.electionId,
      input.commitment,
      input.preparedMessage,
      input.signature,
      'PENDING',
      new Date(),
    );
    this.credentials.push(credential);
    return credential;
  }

  async findByElectionAndCommitment(
    electionId: string,
    commitment: string,
  ): Promise<PresentedCredential | null> {
    return (
      this.credentials.find(
        (credential) =>
          credential.electionId === electionId && credential.commitment === commitment,
      ) ?? null
    );
  }

  async findPendingByElection(electionId: string): Promise<PresentedCredential[]> {
    return this.credentials.filter(
      (credential) => credential.electionId === electionId && credential.status === 'PENDING',
    );
  }

  async countPresentedBetween(electionId: string, from: Date, to: Date): Promise<number> {
    return this.credentials.filter(
      (credential) =>
        credential.electionId === electionId &&
        credential.presentedAt.getTime() >= from.getTime() &&
        credential.presentedAt.getTime() < to.getTime(),
    ).length;
  }

  async findByBatch(batchId: string): Promise<PresentedCredential[]> {
    return this.credentials.filter((credential) => credential.batchId === batchId);
  }

  /** Solo para el doble de RegistrationBatchRepository: simula la transaccion de cierre. */
  markBatched(ids: string[], batchId: string): void {
    this.replaceMany(ids, (credential) => 'BATCHED', batchId);
  }

  /** Solo para el doble de RegistrationBatchRepository: simula la transaccion de insercion. */
  markInsertedByBatch(batchId: string): void {
    const ids = this.credentials
      .filter((credential) => credential.batchId === batchId && credential.status === 'BATCHED')
      .map((credential) => credential.id);
    this.replaceMany(ids, () => 'INSERTED', batchId);
  }

  private replaceMany(
    ids: string[],
    nextStatus: (credential: PresentedCredential) => PresentedCredential['status'],
    batchId: string,
  ): void {
    const idSet = new Set(ids);
    for (let i = 0; i < this.credentials.length; i += 1) {
      const credential = this.credentials[i];
      if (!idSet.has(credential.id)) {
        continue;
      }
      this.credentials[i] = new PresentedCredential(
        credential.id,
        credential.electionId,
        credential.commitment,
        credential.preparedMessage,
        credential.signature,
        nextStatus(credential),
        credential.presentedAt,
        batchId,
      );
    }
  }
}
