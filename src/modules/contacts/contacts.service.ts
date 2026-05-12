import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Contact, ContactStatus } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    const contact = this.contactRepository.create({
      isAnonymous: dto.anonymous,
      fullName: dto.anonymous ? null : (dto.name ?? null),
      email: dto.anonymous ? null : (dto.email ?? null),
      phone: dto.anonymous ? null : (dto.phone ?? null),
      subject: dto.subject,
      message: dto.message,
      status: 'PENDING',
    });
    return this.contactRepository.save(contact);
  }

  async findAll(filters: {
    search?: string;
    status?: ContactStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.fullName = ILike(`%${filters.search}%`);
    }

    const [data, total] = await this.contactRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact #${id} introuvable`);
    return contact;
  }

  async markAsRead(id: number): Promise<Contact> {
    const contact = await this.findById(id);
    if (contact.status === 'PENDING') {
      contact.status = 'READ';
      await this.contactRepository.save(contact);
    }
    return contact;
  }

  async respond(id: number, response: string): Promise<Contact> {
    const contact = await this.findById(id);
    contact.response = response;
    contact.respondedAt = new Date();
    contact.status = 'RESPONDED';
    return this.contactRepository.save(contact);
  }

  async close(id: number): Promise<Contact> {
    const contact = await this.findById(id);
    contact.status = 'CLOSED';
    return this.contactRepository.save(contact);
  }
}
