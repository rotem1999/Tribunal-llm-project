import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds `runs.error_code` — the stable user-facing error category (SPEC §12.1). */
export class AddRunErrorCode implements MigrationInterface {
  name = 'AddRunErrorCode1787000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "runs" ADD COLUMN "error_code" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "runs" DROP COLUMN "error_code"`);
  }
}
