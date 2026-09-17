import { Inject, Injectable } from '@nestjs/common';
import {
  AUTHORITY_REPOSITORY,
  AuthorityRepository,
  ReplaceAuthorityInput,
} from '../domain/authority.repository';
import { ELECTION_REPOSITORY, ElectionRepository } from '../domain/election.repository';
import {
  AuthorityNotFoundError,
  AuthorityElectionClosedError,
  AuthorityAccountNotFoundError,
  AuthorityAccountInvalidRoleError,
  AuthorityAccountInactiveError,
} from './election.errors';
import {
  PLATFORM_USER_REPOSITORY,
  PlatformUserRepository,
} from '../../auth/domain/platform-user.repository';
import { AuthorityWithEmail } from './list-authorities.usecase';

export interface ReplaceAuthorityUseCaseInput {
  platformUserId?: string;
  rolDescriptivo?: string;
}

@Injectable()
export class ReplaceAuthorityUseCase {
  constructor(
    @Inject(AUTHORITY_REPOSITORY)
    private readonly authorityRepository: AuthorityRepository,
    @Inject(ELECTION_REPOSITORY)
    private readonly electionRepository: ElectionRepository,
    @Inject(PLATFORM_USER_REPOSITORY)
    private readonly platformUserRepository: PlatformUserRepository,
  ) {}

  async execute(
    authorityId: string,
    input: ReplaceAuthorityUseCaseInput,
    actorId: string,
  ): Promise<AuthorityWithEmail> {
    const authority = await this.authorityRepository.findById(authorityId);
    if (!authority) {
      throw new AuthorityNotFoundError();
    }

    const election = await this.electionRepository.findById(authority.electionId);
    if (!election || election.estado === 'CERRADA') {
      throw new AuthorityElectionClosedError();
    }

    if (input.platformUserId) {
      const account = await this.platformUserRepository.findById(input.platformUserId);
      if (!account) {
        throw new AuthorityAccountNotFoundError();
      }
      if (account.role !== 'AUTORIDAD_REGISTRO') {
        throw new AuthorityAccountInvalidRoleError();
      }
      if (!account.isActive) {
        throw new AuthorityAccountInactiveError();
      }
    }

    const replaceInput: ReplaceAuthorityInput = { ...input, updatedBy: actorId };
    const updated = await this.authorityRepository.replace(authorityId, replaceInput);
    const account = await this.platformUserRepository.findById(updated.platformUserId);

    return {
      id: updated.id,
      rolDescriptivo: updated.rolDescriptivo,
      platformUserEmail: account?.email ?? '(cuenta eliminada)',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
