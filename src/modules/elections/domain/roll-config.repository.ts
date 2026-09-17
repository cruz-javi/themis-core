import type {
  FacultadSso,
  CarreraSso,
  TipoUsuarioSso,
  EstadoAcademicoSso,
} from '../../mock-sso/domain/mock-sso-user.entity';
import { Election } from './election.entity';

export interface ConfigureRollInput {
  profundidadArbol: number;
  elegibilidadFacultad: FacultadSso;
  elegibilidadCarreras: CarreraSso[];
  elegibilidadTipoUsuario: TipoUsuarioSso;
  elegibilidadEstadoAcademico: EstadoAcademicoSso;
}

export interface RollConfigRepository {
  configure(electionId: string, input: ConfigureRollInput): Promise<Election>;
}

export const ROLL_CONFIG_REPOSITORY = 'ROLL_CONFIG_REPOSITORY';
