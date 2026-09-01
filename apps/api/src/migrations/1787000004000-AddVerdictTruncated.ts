import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds `verdicts.truncated` — the opinion was cut off/unreadable (SPEC §5.6/§4.5). */
export class AddVerdictTruncated implements MigrationInterface {
  name = 'AddVerdictTruncated1787000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verdicts" ADD COLUMN "truncated" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "verdicts" DROP COLUMN "truncated"`);
  }
}
