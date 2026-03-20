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
        await this.ensureSqliteColumn(
          'Orders',
          'stripeSessionId',
          'VARCHAR(255)',
        );
        await this.ensureSqliteUniqueIndex(
          'Orders',
          'idx_orders_stripe_session_id_unique',
          'stripeSessionId',
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
        await this.sequelize.query(
          'ALTER TABLE IF EXISTS "Orders" ADD COLUMN IF NOT EXISTS "stripeSessionId" VARCHAR(255) NULL;',
        );
        await this.sequelize.query(
          `DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'Orders_stripeSessionId_key'
            ) THEN
              ALTER TABLE "Orders" ADD CONSTRAINT "Orders_stripeSessionId_key" UNIQUE ("stripeSessionId");
            END IF;
          END
          $$;`,
        );
        await this.sequelize.query(
          `ALTER TYPE "enum_Offers_status" ADD VALUE IF NOT EXISTS 'paid';`,
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

  private async ensureSqliteUniqueIndex(
    tableName: string,
    indexName: string,
    columnName: string,
  ): Promise<void> {
    await this.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnName});`,
    );
  }
}
