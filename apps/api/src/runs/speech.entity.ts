import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Side } from '@tribunal/shared-types';
import { numericTransformer } from './run.entity';

/** One advocate speech (SPEC §4.4). */
@Entity('speeches')
export class Speech {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'persona_key', type: 'varchar' })
  personaKey!: string;

  @Column({ type: 'varchar' })
  side!: Side;

  @Column({ type: 'varchar' })
  model!: string;

  /** Exact prompt sent (audit/reproducibility). */
  @Column({ name: 'system_prompt', type: 'text' })
  systemPrompt!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens!: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens!: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ name: 'reasoning_tokens', type: 'int', nullable: true })
  reasoningTokens!: number | null;

  @Column({ name: 'cost_usd', type: 'numeric', precision: 12, scale: 6, default: 0, transformer: numericTransformer })
  costUsd!: number;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
