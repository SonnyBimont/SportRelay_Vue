import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';

@Injectable()
export class DatabaseSchemaService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSchemaService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async onModuleInit(): Promise<void> {
    const dialect = this.sequelize.getDialect();

    try {
      if (dialect === 'sqlite') {
        await this.ensureSqliteColumn('ChatMessages', 'readAt', 'DATETIME');
        await this.ensureSqliteColumn(
          'Offers',
          'quantity',
          'INTEGER NOT NULL DEFAULT 1',
        );
        await this.ensureSqliteColumn(
          'Users',
          'profileImageUrl',
          'VARCHAR(255)',
        );
        return;
      }

      if (dialect === 'postgres') {
        await this.sequelize.query(
          'ALTER TABLE IF EXISTS "ChatMessages" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMPTZ NULL;',
        );
        await this.sequelize.query(
          'ALTER TABLE IF EXISTS "Offers" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;',
        );
        await this.sequelize.query(
          'ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "profileImageUrl" VARCHAR(255) NULL;',
        );
      }
    } catch (error) {
      this.logger.error('Schema patch failed at startup.', error as Error);
      throw error;
    }
  }

  private async ensureSqliteColumn(
    tableName: string,
    columnName: string,
    columnDefinition: string,
  ): Promise<void> {
    const rows = await this.sequelize.query<{ name: string }>(
      `PRAGMA table_info(${tableName});`,
      { type: QueryTypes.SELECT },
    );

    const exists = rows.some((row) => row.name === columnName);
    if (exists) {
      return;
    }

    await this.sequelize.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`,
    );
  }
}
