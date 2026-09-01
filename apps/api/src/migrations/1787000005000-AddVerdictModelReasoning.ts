import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds `verdicts.model_reasoning` — the judge model's captured thinking (SPEC §5.4/§4.5). */
export class AddVerdictModelReasoning implements MigrationInterface {
  name = 'AddVerdictModelReasoning1787000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verdicts" ADD COLUMN "model_reasoning" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "verdicts" DROP COLUMN "model_reasoning"`);
  }
}
