import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subvention } from './entities/subvention.entity';
import { SubventionTranche } from './entities/subvention-tranche.entity';
import { CreatedJob } from './entities/created-job.entity';
import { CreateSubventionDto } from './dto/create-subvention.dto';

const TRANCHE_CONFIG = [
  { number: 1, percentage: 40, condition: 'Signature convention + preuve contribution propre' },
  { number: 2, percentage: 30, condition: 'Atteinte jalon 1 + justificatifs acquisitions tranche 1' },
  { number: 3, percentage: 30, condition: 'Atteinte jalon 2 + rapport final' },
];

@Injectable()
export class SubventionsService {
  constructor(
    @InjectRepository(Subvention)
    public readonly subventionRepository: Repository<Subvention>,
    @InjectRepository(SubventionTranche)
    private readonly trancheRepository: Repository<SubventionTranche>,
    @InjectRepository(CreatedJob)
    public readonly createdJobRepository: Repository<CreatedJob>,
  ) {}

  async findAll(): Promise<Subvention[]> {
    return this.subventionRepository.find({
      relations: ['beneficiary', 'beneficiary.user', 'status', 'tranches', 'businessPlan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Subvention> {
    const subvention = await this.subventionRepository.findOne({
      where: { id },
      relations: ['status', 'beneficiary', 'beneficiary.user', 'businessPlan', 'tranches', 'approvedBy'],
    });
    if (!subvention) throw new NotFoundException(`Subvention ${id} introuvable`);
    return subvention;
  }

  async findByBeneficiaryId(beneficiaryId: number): Promise<Subvention | null> {
    return this.subventionRepository.findOne({
      where: { beneficiaryId },
      relations: ['status', 'businessPlan', 'tranches'],
    });
  }

  async create(dto: CreateSubventionDto, approvedByUserId: number): Promise<Subvention> {
    const existing = await this.subventionRepository.findOne({
      where: { businessPlanId: dto.businessPlanId },
    });
    if (existing) throw new ConflictException('Une subvention existe déjà pour ce plan d\'affaires');

    const agreementNumber = `CONV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const subvention = this.subventionRepository.create({
      ...dto,
      agreementNumber,
      signatureDate: new Date(dto.signatureDate),
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
      approvedByUserId,
      approvalDate: new Date(),
    });

    const saved = await this.subventionRepository.save(subvention);

    // Créer automatiquement les 3 tranches
    for (const config of TRANCHE_CONFIG) {
      const tranche = this.trancheRepository.create({
        subventionId: saved.id,
        trancheNumber: config.number,
        percentage: config.percentage,
        amount: Math.round((dto.awardedAmount * config.percentage) / 100),
        releaseCondition: config.condition,
      });
      await this.trancheRepository.save(tranche);
    }

    return this.findById(saved.id);
  }

  async updateStatus(id: number, statusCode: string, _userId: number): Promise<Subvention> {
    const subvention = await this.findById(id);
    // statusId lookup would normally go through Status repo — using code directly
    (subvention as any).statusCode = statusCode;
    return this.subventionRepository.save(subvention);
  }

  async approveTranche(subventionId: number, trancheId: number, releasedByUserId: number): Promise<SubventionTranche> {
    const subvention = await this.findById(subventionId);
    const tranche = subvention.tranches.find((t) => t.id === trancheId);
    if (!tranche) throw new NotFoundException('Tranche introuvable');
    if (tranche.status === 'RELEASED') throw new ConflictException('Cette tranche est déjà libérée');

    // Vérifier que la tranche précédente est bien libérée
    if (tranche.trancheNumber > 1) {
      const prevTranche = subvention.tranches.find(
        (t) => t.trancheNumber === tranche.trancheNumber - 1,
      );
      if (prevTranche && prevTranche.status !== 'RELEASED') {
        throw new BadRequestException('La tranche précédente doit être libérée en premier');
      }
    }

    tranche.status = 'RELEASED';
    tranche.effectiveReleaseDate = new Date();
    tranche.releasedByUserId = releasedByUserId;
    return this.trancheRepository.save(tranche);
  }

  async requestTranche(subventionId: number, trancheNumber: number, beneficiaryId: number): Promise<SubventionTranche> {
    const subvention = await this.subventionRepository.findOne({
      where: { id: subventionId, beneficiaryId },
      relations: ['tranches'],
    });
    if (!subvention) throw new NotFoundException('Subvention introuvable');

    const tranche = subvention.tranches.find((t) => t.trancheNumber === trancheNumber);
    if (!tranche) throw new NotFoundException('Tranche introuvable');
    if (tranche.status !== 'PENDING') throw new ConflictException('Cette tranche a déjà été demandée ou libérée');

    tranche.status = 'REQUESTED';
    return this.trancheRepository.save(tranche);
  }

  async getPortfolioStats(): Promise<any> {
    const total = await this.subventionRepository.count();
    const totalAmount = await this.subventionRepository
      .createQueryBuilder('s')
      .select('SUM(s.awardedAmount)', 'total')
      .getRawOne();

    const releasedAmount = await this.trancheRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.status = :status', { status: 'RELEASED' })
      .getRawOne();

    return {
      totalSubventions: total,
      totalAwardedAmount: totalAmount?.total || 0,
      totalReleasedAmount: releasedAmount?.total || 0,
    };
  }
}
