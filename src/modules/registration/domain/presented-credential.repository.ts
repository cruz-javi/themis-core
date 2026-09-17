import { PresentedCredential } from './presented-credential.entity';

export interface CreatePresentedCredentialInput {
  electionId: string;
  commitment: string;
  preparedMessage: string;
  signature: string;
}

export interface PresentedCredentialRepository {
  create(input: CreatePresentedCredentialInput): Promise<PresentedCredential>;
  findByElectionAndCommitment(
    electionId: string,
    commitment: string,
  ): Promise<PresentedCredential | null>;
}

export const PRESENTED_CREDENTIAL_REPOSITORY = 'PRESENTED_CREDENTIAL_REPOSITORY';
