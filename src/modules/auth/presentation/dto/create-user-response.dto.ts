import { ApiProperty } from '@nestjs/swagger';
import type { CreatablePlatformRole } from './create-user.dto';

export class CreateUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  nombreCompleto!: string;

  @ApiProperty({ enum: ['ADMIN', 'AUTORIDAD_REGISTRO', 'AUDITOR'] })
  role!: CreatablePlatformRole;
}
