import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { Training } from './entities/training.entity';
import { TrainingSession } from './entities/training-session.entity';
import { Trainer } from './entities/trainer.entity';
import { TrainingParticipation } from './entities/training-participation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Training,
      TrainingSession,
      Trainer,
      TrainingParticipation,
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
