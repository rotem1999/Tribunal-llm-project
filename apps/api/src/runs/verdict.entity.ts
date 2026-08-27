import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Decision } from '@tribunal/shared-types';
import { numericTransformer } from './run.entity';

/** One judge verdict (SPEC §4.5). `reasoning` is that judge's protocol. */
@Entity('verdicts')
export class Verdict {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'persona_key', type: 'varchar' })
  personaKey!: string;

  @Column({ type: 'varchar' })
  model!: string;

  @Column({ name: 'system_prompt', type: 'text' })
  systemPrompt!: string;

  @Column({ type: 'varchar' })
  decision!: Decision;

  @Column({ type: 'int' })
  confidence!: number;

  @Column({ type: 'text' })
  reasoning!: string;

  /** Full model text (fallback if parsing was partial). */
  @Column({ name: 'raw_response', type: 'text' })
  rawResponse!: string;

  /** Order of speeches this judge saw (audit). */
  @Column({ name: 'speech_order_shown', type: 'jsonb', nullable: true })
  speechOrderShown!: string[] | null;

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
