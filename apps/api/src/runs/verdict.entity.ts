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

  /**
   * The opinion could not be read — reply cut off (`finish_reason=length`),
   * failed re-ask fallback, or empty (SPEC §5.6). Decision/confidence still
   * stand; the card shows a recess placeholder instead of the opinion (§11).
   */
  @Column({ type: 'boolean', default: false })
  truncated!: boolean;

  /**
   * The judge model's own reasoning/thinking (`message.reasoning`, SPEC §5.4),
   * captured when reasoning is enabled on judge calls; null when the model
   * returned none. Shown as a subsection beneath the opinion (§11).
   */
  @Column({ name: 'model_reasoning', type: 'text', nullable: true })
  modelReasoning!: string | null;

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
