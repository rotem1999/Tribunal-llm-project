import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ChargeSheet } from './charge-sheet.entity';
import type { PatchChargeSheetDto } from './dto/patch-charge-sheet.dto';

const SEED_TITLE = 'T-001: The Realm v. Jon Snow';

/**
 * Charge-sheet CRUD + the single-active invariant, plus the boot seed of the
 * canonical Case T-001 (SPEC §4.2, §4.2b, §10).
 */
@Injectable()
export class ChargeSheetsService implements OnModuleInit {
  private readonly logger = new Logger(ChargeSheetsService.name);

  constructor(
    @InjectRepository(ChargeSheet)
    private readonly sheets: Repository<ChargeSheet>,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    if ((await this.sheets.count()) > 0) return;
    const file = this.config.get<string>(
      'CHARGE_SHEET_SEED_FILE',
      'charge-sheet.seed.txt',
    );
    const path = isAbsolute(file) ? file : resolve(process.cwd(), file);
    const content = readFileSync(path, 'utf8');
    await this.sheets.save(
      this.sheets.create({ title: SEED_TITLE, content, isActive: true }),
    );
    this.logger.log(`Seeded charge sheet "${SEED_TITLE}" from ${path}.`);
  }

  /** The active charge sheet the run pipeline loads by default (SPEC §5.5). */
  async getActive(): Promise<ChargeSheet> {
    const active = await this.sheets.findOne({ where: { isActive: true } });
    if (!active) throw new NotFoundException('No active charge sheet.');
    return active;
  }

  list(): Promise<ChargeSheet[]> {
    return this.sheets.find({ order: { updatedAt: 'DESC' } });
  }

  async getById(id: string): Promise<ChargeSheet> {
    const sheet = await this.sheets.findOne({ where: { id } });
    if (!sheet) throw new NotFoundException(`Charge sheet ${id} not found.`);
    return sheet;
  }

  /**
   * Update a charge sheet. Setting `isActive: true` deactivates all others in a
   * transaction, keeping exactly one active (SPEC §4.2, invariant).
   */
  async update(id: string, dto: PatchChargeSheetDto): Promise<ChargeSheet> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ChargeSheet);
      const sheet = await repo.findOne({ where: { id } });
      if (!sheet) throw new NotFoundException(`Charge sheet ${id} not found.`);
      if (dto.isActive === true) {
        await repo.update({ isActive: true }, { isActive: false });
        sheet.isActive = true;
      } else if (dto.isActive === false) {
        sheet.isActive = false;
      }
      if (dto.title !== undefined) sheet.title = dto.title;
      if (dto.content !== undefined) sheet.content = dto.content;
      return repo.save(sheet);
    });
  }
}
