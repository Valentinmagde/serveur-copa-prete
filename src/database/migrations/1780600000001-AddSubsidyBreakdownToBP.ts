import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubsidyBreakdownToBP1780600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_plans"
        ADD COLUMN IF NOT EXISTS "verified_investment_subsidy" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "verified_exploitation_subsidy" numeric(15,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_plans"
        DROP COLUMN IF EXISTS "verified_investment_subsidy",
        DROP COLUMN IF EXISTS "verified_exploitation_subsidy"
    `);
  }
}
