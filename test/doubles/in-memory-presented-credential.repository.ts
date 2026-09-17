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
}
