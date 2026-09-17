import { Inject, Injectable } from '@nestjs/common';
import {
  ELECTION_REPOSITORY,
  ElectionRepository,
} from '../../elections/domain/election.repository';
import { Election } from '../../elections/domain/election.entity';
import { CloseCheckpointUseCase } from './close-checkpoint.usecase';

function computeDueAt(election: Election): Date {
  const base =
    election.lastCheckpointClosedAt ?? election.padronConfiguradoEn ?? election.registroInicio;
  return new Date(base.getTime() + election.checkpointIntervalEfectivo * 60_000);
}

/**
 * CU-07, orquestacion: invocada por el cron (ver CheckpointScheduler). Para
 * cada eleccion con registro abierto y checkpoint vencido, dispara
 * CloseCheckpointUseCase. Tick del cron: EVERY_MINUTE, mas fino que el
 * checkpointIntervalMinutes minimo (5 min) para no violar la configuracion
 * de ninguna eleccion.
 */
@Injectable()
export class CloseDueCheckpointsUseCase {
  constructor(
    @Inject(ELECTION_REPOSITORY)
    private readonly electionRepository: ElectionRepository,
    private readonly closeCheckpoint: CloseCheckpointUseCase,
  ) {}

  async execute(): Promise<void> {
    const elections = await this.electionRepository.findMany({ estado: 'REGISTRO_ABIERTO' });
    const now = new Date();

    for (const election of elections) {
      const dueAt = computeDueAt(election);
      if (now.getTime() >= dueAt.getTime()) {
        await this.closeCheckpoint.execute(election.id, dueAt);
      }
    }
  }
}
