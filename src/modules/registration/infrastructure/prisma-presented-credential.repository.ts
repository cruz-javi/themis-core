import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { PresentedCredential } from '../domain/presented-credential.entity';
import type {
  CreatePresentedCredentialInput,
  PresentedCredentialRepository,
} from '../domain/presented-credential.repository';
import { presentedCredentialToDomain } from './presented-credential.mapper';

@Injectable()
export class PrismaPresentedCredentialRepository implements PresentedCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePresentedCredentialInput): Promise<PresentedCredential> {
    const row = await this.prisma.presentedCredential.create({
      data: {
        electionId: input.electionId,
        commitment: input.commitment,
        preparedMessage: input.preparedMessage,
        signature: input.signature,
      },
    });
    return presentedCredentialToDomain(row);
  }

  async findByElectionAndCommitment(
    electionId: string,
    commitment: string,
  ): Promise<PresentedCredential | null> {
    const row = await this.prisma.presentedCredential.findUnique({
      where: { electionId_commitment: { electionId, commitment } },
    });
    return row ? presentedCredentialToDomain(row) : null;
  }
}
