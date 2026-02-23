import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CopaEdition } from './entities/copa-edition.entity';

@Injectable()
export class CopaEditionsService {
  constructor(
    @InjectRepository(CopaEdition)
    private readonly copaEditionRepository: Repository<CopaEdition>,
  ) {}

  async findById(id: number): Promise<CopaEdition> {
    const edition = await this.copaEditionRepository.findOne({ where: { id } });
    if (!edition) {
      throw new NotFoundException(`COPA edition with ID ${id} not found`);
    }
    return edition;
  }

  async findActive(): Promise<CopaEdition[]> {
    return this.copaEditionRepository.find({ where: { isActive: true } });
  }

  async findCurrent(): Promise<CopaEdition | null> {
    return this.copaEditionRepository.findOne({
      where: { isActive: true },
      order: { year: 'DESC' },
    });
  }
}
