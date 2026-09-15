import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { PlatformUser } from '../domain/platform-user.entity';
import {
  CreatePlatformUserInput,
  PlatformUserRepository,
} from '../domain/platform-user.repository';

@Injectable()
export class PrismaPlatformUserRepository implements PlatformUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<PlatformUser | null> {
    const row = await this.prisma.platformUser.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<PlatformUser | null> {
    const row = await this.prisma.platformUser.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(input: CreatePlatformUserInput): Promise<PlatformUser> {
    const row = await this.prisma.platformUser.create({ data: input });
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    email: string;
    passwordHash: string;
    nombreCompleto: string;
    role: string;
    createdAt: Date;
  }): PlatformUser {
    return new PlatformUser(
      row.id,
      row.email,
      row.passwordHash,
      row.nombreCompleto,
      row.role as PlatformUser['role'],
      row.createdAt,
    );
  }
}
