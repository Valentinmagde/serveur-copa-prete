import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Evaluation } from './entities/evaluation.entity';
import { Evaluator } from './entities/evaluator.entity';
import { EvaluationAssignment } from './entities/evaluation-assignment.entity';
import { BusinessPlansModule } from '../business-plans/business-plans.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evaluation, Evaluator, EvaluationAssignment]),
    BusinessPlansModule,
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
