import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCriterion16Score1780000000001 implements MigrationInterface {
  name = 'AddCriterion16Score1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nouveau critère 13 grille VF26052026 — dirigée par femme/réfugié/batwa/albinos/handicap (0 ou 5)
    await queryRunner.query(
      `ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "criterion16_score" integer NULL`,
    );
    // total_score peut désormais être décimal (coefficients 1.5 pour critères 11 et 12)
    await queryRunner.query(
      `ALTER TABLE "evaluations" ALTER COLUMN "total_score" TYPE numeric(6,1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluations" ALTER COLUMN "total_score" TYPE integer USING total_score::integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluations" DROP COLUMN IF EXISTS "criterion16_score"`,
    );
  }
}
