import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Initial schema: the `users` table (SPEC §4.1). Uses Postgres' built-in
 * `gen_random_uuid()` (core since PG13) so no extension is required.
 */
export class CreateUsers1787000000000 implements MigrationInterface {
  name = 'CreateUsers1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'username', type: 'varchar', isUnique: true },
          { name: 'password_hash', type: 'varchar' },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
