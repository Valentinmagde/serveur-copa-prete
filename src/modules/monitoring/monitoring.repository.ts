import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonitoringIndicator } from './entities/monitoring-indicator.entity';
import { IndicatorMeasurement } from './entities/indicator-measurement.entity';

@Injectable()
export class MonitoringRepository {
  constructor(
    @InjectRepository(MonitoringIndicator)
    public readonly indicatorRepository: Repository<MonitoringIndicator>,
    @InjectRepository(IndicatorMeasurement)
    public readonly measurementRepository: Repository<IndicatorMeasurement>,
  ) {}
}
