import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from './entities/complaint.entity';
import { ComplaintType } from './entities/complaint-type.entity';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    public readonly complaintRepository: Repository<Complaint>,
    @InjectRepository(ComplaintType)
    public readonly complaintTypeRepository: Repository<ComplaintType>,
  ) {}

  async findById(id: number): Promise<Complaint> {
    const complaint = await this.complaintRepository.findOne({
      where: { id },
      relations: ['complaintType', 'status', 'user', 'assignedTo'],
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    return complaint;
  }

  async findAll(): Promise<Complaint[]> {
    return this.complaintRepository.find({
      relations: ['complaintType', 'status'],
      order: { createdAt: 'DESC' },
    });
  }
}
