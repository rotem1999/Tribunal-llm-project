import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/** Adds the `charge_sheets` table (SPEC §4.2). */
export class CreateChargeSheets implements MigrationInterface {
  name = 'CreateChargeSheets1787000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'charge_sheets',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'title', type: 'varchar' },
          { name: 'content', type: 'text' },
          { name: 'is_active', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('charge_sheets');
  }
}
