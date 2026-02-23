import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subvention } from './entities/subvention.entity';
import { CreatedJob } from './entities/created-job.entity';

@Injectable()
export class SubventionsService {
  constructor(
    @InjectRepository(Subvention)
    public readonly subventionRepository: Repository<Subvention>,
    @InjectRepository(CreatedJob)
    public readonly createdJobRepository: Repository<CreatedJob>,
  ) {}

  async findById(id: number): Promise<Subvention> {
    const subvention = await this.subventionRepository.findOne({
      where: { id },
      relations: ['status', 'beneficiary', 'businessPlan'],
    });
    if (!subvention) {
      throw new NotFoundException(`Subvention with ID ${id} not found`);
    }
    return subvention;
  }
}
