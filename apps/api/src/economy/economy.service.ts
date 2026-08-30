import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LedgerEntry, RunEconomy } from '@tribunal/shared-types';
import { PersonasService } from '../personas/personas.service';
import { Run } from '../runs/run.entity';
import { Speech } from '../runs/speech.entity';
import { Verdict } from '../runs/verdict.entity';
import { buildRunEconomy, toLedgerEntry } from './economy.builder';

/**
 * Token-economy artifacts (SPEC §6): builds the per-run economy, writes the
 * per-run JSON file + appends the cumulative ledger, and serves both. Cost values
 * come straight from OpenRouter usage (0 for free models) — never estimated.
 */
@Injectable()
export class EconomyService {
  private readonly dataDir = resolve(process.cwd(), 'apps/api/data');

  constructor(
    @InjectRepository(Run) private readonly runs: Repository<Run>,
    @InjectRepository(Speech) private readonly speeches: Repository<Speech>,
    @InjectRepository(Verdict) private readonly verdicts: Repository<Verdict>,
    private readonly personas: PersonasService,
  ) {}

  private readonly nameFor = (key: string): string => this.personas.nameFor(key);

  /** Persist the per-run JSON file + append the ledger line (SPEC §6a/§6b). */
  async writeRun(
    run: Run,
    speeches: Speech[],
    verdicts: Verdict[],
  ): Promise<RunEconomy> {
    const economy = buildRunEconomy(run, speeches, verdicts, this.nameFor);
    await mkdir(resolve(this.dataDir, 'runs'), { recursive: true });
    await writeFile(
      resolve(this.dataDir, 'runs', `${run.id}.json`),
      JSON.stringify(economy, null, 2),
      'utf8',
    );
    await appendFile(
      resolve(this.dataDir, 'ledger.jsonl'),
      `${JSON.stringify(toLedgerEntry(run))}\n`,
      'utf8',
    );
    return economy;
  }

  /** Rebuild a run's economy from the DB (SPEC §6c). */
  async buildForRun(runId: string): Promise<RunEconomy> {
    const run = await this.runs.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found.`);
    const [speeches, verdicts] = await Promise.all([
      this.speeches.findBy({ runId }),
      this.verdicts.findBy({ runId }),
    ]);
    return buildRunEconomy(run, speeches, verdicts, this.nameFor);
  }

  /** The cumulative ledger, reconstructed from the DB (SPEC §6b). */
  async ledger(): Promise<LedgerEntry[]> {
    const runs = await this.runs.find({ order: { createdAt: 'ASC' } });
    return runs.map(toLedgerEntry);
  }
}
