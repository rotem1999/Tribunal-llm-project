import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PersonaRole, type PersonaInfo } from '@tribunal/shared-types';
import {
  type Advocate,
  type Judge,
  type Personas,
  personasSchema,
} from './personas.schema';

/**
 * Loads and validates the personalities file at boot (SPEC §8). The personas are
 * baked in (not editable in the UI, D3); if the file is missing or invalid the
 * app refuses to start with a clear message.
 */
@Injectable()
export class PersonasService implements OnModuleInit {
  private readonly logger = new Logger(PersonasService.name);
  private personas!: Personas;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const file = this.config.get<string>('PERSONAS_FILE', 'personalities.json');
    const path = isAbsolute(file) ? file : resolve(process.cwd(), file);

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      throw new Error(
        `Cannot read personalities file at "${path}" (set PERSONAS_FILE): ${(err as Error).message}`,
      );
    }

    const result = personasSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid personalities file (SPEC §8):\n${issues}`);
    }

    this.personas = result.data;
    this.logger.log(
      `Loaded ${this.personas.advocates.length} advocates + ${this.personas.judges.length} judges from ${path}.`,
    );
  }

  getAdvocates(): Advocate[] {
    return this.personas.advocates;
  }

  getJudges(): Judge[] {
    return this.personas.judges;
  }

  /** Public roster for `GET /personas` + the run animation (SPEC §10, §11). */
  getRoster(): PersonaInfo[] {
    return [
      ...this.personas.advocates.map((a) => ({
        key: a.key,
        name: a.name,
        role: PersonaRole.advocate,
        side: a.side,
      })),
      ...this.personas.judges.map((j) => ({
        key: j.key,
        name: j.name,
        role: PersonaRole.judge,
        side: null,
      })),
    ];
  }

  /** Display name for a persona key (SPEC §5.6/§11); falls back to the key. */
  nameFor(key: string): string {
    const found = [...this.personas.advocates, ...this.personas.judges].find(
      (p) => p.key === key,
    );
    return found?.name ?? key;
  }

  /** All persona keys in a fixed order: advocates then judges (SPEC §5.2 Mode B). */
  getPersonaKeys(): string[] {
    return [
      ...this.personas.advocates.map((a) => a.key),
      ...this.personas.judges.map((j) => j.key),
    ];
  }
}
