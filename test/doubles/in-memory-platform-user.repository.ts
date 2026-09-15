import { PlatformUser } from '../../src/modules/auth/domain/platform-user.entity';
import {
  CreatePlatformUserInput,
  PlatformUserRepository,
} from '../../src/modules/auth/domain/platform-user.repository';

export class InMemoryPlatformUserRepository implements PlatformUserRepository {
  private readonly users = new Map<string, PlatformUser>();
  private sequence = 0;

  async findByEmail(email: string): Promise<PlatformUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<PlatformUser | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: CreatePlatformUserInput): Promise<PlatformUser> {
    this.sequence += 1;
    const user = new PlatformUser(
      `test-id-${this.sequence}`,
      input.email,
      input.passwordHash,
      input.nombreCompleto,
      input.role,
      new Date(),
    );
    this.users.set(user.id, user);
    return user;
  }
}
