import { Election, ElectionStatus } from './election.entity';

export interface CreateElectionInput {
  nombre: string;
  descripcion?: string;
  registroInicio: Date;
  registroFin: Date;
  votacionInicio: Date;
  votacionFin: Date;
  opciones: Array<{ nombre: string; descripcion?: string }>;
  createdBy: string;
}

export interface UpdateElectionInput {
  nombre?: string;
  descripcion?: string;
  registroInicio?: Date;
  registroFin?: Date;
  votacionInicio?: Date;
  votacionFin?: Date;
  opciones?: Array<{ nombre: string; descripcion?: string }>;
  updatedBy: string;
}

export interface ListElectionsFilter {
  nombre?: string;
  estado?: ElectionStatus;
}

export interface ElectionRepository {
  create(input: CreateElectionInput): Promise<Election>;
  update(id: string, input: UpdateElectionInput): Promise<Election>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Election | null>;
  findMany(filter: ListElectionsFilter): Promise<Election[]>;
  /**
   * Compare-and-swap para el cierre de checkpoint (CU-07): solo avanza
   * lastCheckpointClosedAt si sigue en el valor esperado (null o <= dueAt),
   * devuelve true solo para la llamada que gana la carrera. Ver
   * CloseCheckpointUseCase.
   */
  tryClaimCheckpoint(electionId: string, dueAtExpected: Date): Promise<boolean>;
  setOnChainGroup(electionId: string, onChainGroupId: string): Promise<void>;
  setMerkleRoot(electionId: string, merkleRoot: string): Promise<void>;
}

export const ELECTION_REPOSITORY = 'ELECTION_REPOSITORY';
