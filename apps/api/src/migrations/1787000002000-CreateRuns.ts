import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the `runs`, `speeches`, and `verdicts` tables (SPEC §4.3–4.5). */
export class CreateRuns implements MigrationInterface {
  name = 'CreateRuns1787000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "charge_sheet_id" uuid NOT NULL,
        "charge_sheet_snapshot" text NOT NULL,
        "mode" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "model_single" varchar,
        "cost_ceiling_usd" numeric(12,6) NOT NULL,
        "verdict_tally" jsonb,
        "total_prompt_tokens" integer NOT NULL DEFAULT 0,
        "total_completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "total_cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
        "speech_order_by_judge" jsonb,
        "error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "speeches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
        "persona_key" varchar NOT NULL,
        "side" varchar NOT NULL,
        "model" varchar NOT NULL,
        "system_prompt" text NOT NULL,
        "content" text NOT NULL,
        "prompt_tokens" integer NOT NULL DEFAULT 0,
        "completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "reasoning_tokens" integer,
        "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
        "latency_ms" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_speeches_run_id" ON "speeches"("run_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "verdicts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
        "persona_key" varchar NOT NULL,
        "model" varchar NOT NULL,
        "system_prompt" text NOT NULL,
        "decision" varchar NOT NULL,
        "confidence" integer NOT NULL,
        "reasoning" text NOT NULL,
        "raw_response" text NOT NULL,
        "speech_order_shown" jsonb,
        "prompt_tokens" integer NOT NULL DEFAULT 0,
        "completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "reasoning_tokens" integer,
        "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
        "latency_ms" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_verdicts_run_id" ON "verdicts"("run_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "verdicts"`);
    await queryRunner.query(`DROP TABLE "speeches"`);
    await queryRunner.query(`DROP TABLE "runs"`);
  }
}
