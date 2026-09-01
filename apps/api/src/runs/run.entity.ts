import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';
import {
  type ErrorCode,
  RunMode,
  RunStatus,
  type VerdictTally,
} from '@tribunal/shared-types';

/** Postgres `numeric` <-> JS number (TypeORM returns numerics as strings). */
export const numericTransformer: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** One tribunal run (SPEC §4.3). Output = 3 verdicts + economy; no combined verdict. */
@Entity('runs')
export class Run {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'charge_sheet_id', type: 'uuid' })
  chargeSheetId!: string;

  /** Immutable exact charge-sheet text used for this run (reproducibility). */
  @Column({ name: 'charge_sheet_snapshot', type: 'text' })
  chargeSheetSnapshot!: string;

  @Column({ type: 'varchar' })
  mode!: RunMode;

  @Column({ type: 'varchar', default: RunStatus.pending })
  status!: RunStatus;

  @Column({ name: 'model_single', type: 'varchar', nullable: true })
  modelSingle!: string | null;

  @Column({ name: 'cost_ceiling_usd', type: 'numeric', precision: 12, scale: 6, transformer: numericTransformer })
  costCeilingUsd!: number;

  /** Non-binding count of the 3 verdicts (SPEC §4.3 / D5). Null until completed. */
  @Column({ name: 'verdict_tally', type: 'jsonb', nullable: true })
  verdictTally!: VerdictTally | null;

  @Column({ name: 'total_prompt_tokens', type: 'int', default: 0 })
  totalPromptTokens!: number;

  @Column({ name: 'total_completion_tokens', type: 'int', default: 0 })
  totalCompletionTokens!: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ name: 'total_cost_usd', type: 'numeric', precision: 12, scale: 6, default: 0, transformer: numericTransformer })
  totalCostUsd!: number;

  /** Recorded counterbalanced speech order per judge (audit). */
  @Column({ name: 'speech_order_by_judge', type: 'jsonb', nullable: true })
  speechOrderByJudge!: Record<string, string[]> | null;

  /** User-safe message on failure (SPEC §12.1); the raw cause goes to the §5.7 log only. */
  @Column({ type: 'text', nullable: true })
  error!: string | null;

  /** Stable failure/flag category (SPEC §12.1); e.g. VERDICT_UNREADABLE on a completed run. */
  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode!: ErrorCode | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
