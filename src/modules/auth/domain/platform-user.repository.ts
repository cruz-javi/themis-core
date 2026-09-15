import { PlatformUser, PlatformRole } from './platform-user.entity';

export interface CreatePlatformUserInput {
  email: string;
  passwordHash: string;
  nombreCompleto: string;
  role: PlatformRole;
}

export interface PlatformUserRepository {
  findByEmail(email: string): Promise<PlatformUser | null>;
  findById(id: string): Promise<PlatformUser | null>;
  create(input: CreatePlatformUserInput): Promise<PlatformUser>;
}

export const PLATFORM_USER_REPOSITORY = 'PLATFORM_USER_REPOSITORY';
