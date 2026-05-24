import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { Evaluator } from './entities/evaluator.entity';
import { EvaluationAssignment } from './entities/evaluation-assignment.entity';
import { SubmitEvaluationDto } from './dto/submit-evaluation.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Evaluator)
    private readonly evaluatorRepository: Repository<Evaluator>,
    @InjectRepository(EvaluationAssignment)
    private readonly assignmentRepository: Repository<EvaluationAssignment>,
  ) {}

  private calcTotal(dto: SubmitEvaluationDto): number {
    return (
      dto.economicViabilityScore +
      dto.innovationScore +
      dto.qualityScore +
      dto.implementationCapacityScore +
      dto.socialImpactScore +
      dto.environmentalImpactScore
    );
  }

  // ── Évaluateurs ──────────────────────────────────────────────────────────

  async findAllEvaluators(): Promise<Evaluator[]> {
    return this.evaluatorRepository.find({
      where: { isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findEvaluatorByUserId(userId: number): Promise<Evaluator> {
    const evaluator = await this.evaluatorRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!evaluator) throw new NotFoundException('Profil évaluateur introuvable');
    return evaluator;
  }

  async createEvaluator(userId: number, expertise?: string): Promise<Evaluator> {
    const existing = await this.evaluatorRepository.findOne({ where: { userId } });
    if (existing) throw new ConflictException('Ce compte est déjà enregistré comme évaluateur');
    const evaluator = this.evaluatorRepository.create({ userId, expertise });
    return this.evaluatorRepository.save(evaluator);
  }

  // ── Affectations ─────────────────────────────────────────────────────────

  async findAllAssignments(editionId?: number): Promise<EvaluationAssignment[]> {
    const qb = this.assignmentRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.businessPlan', 'bp')
      .leftJoinAndSelect('bp.beneficiary', 'beneficiary')
      .leftJoinAndSelect('beneficiary.user', 'user')
      .leftJoinAndSelect('a.evaluator', 'evaluator')
      .leftJoinAndSelect('evaluator.user', 'evalUser')
      .orderBy('a.assignedAt', 'DESC');

    if (editionId) qb.where('a.copaEditionId = :editionId', { editionId });

    return qb.getMany();
  }

  async findMyAssignments(evaluatorId: number): Promise<EvaluationAssignment[]> {
    return this.assignmentRepository.find({
      where: { evaluatorId },
      relations: ['businessPlan', 'businessPlan.beneficiary', 'businessPlan.beneficiary.user'],
      order: { deadline: 'ASC' },
    });
  }

  async findAssignmentById(id: number): Promise<EvaluationAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: ['businessPlan', 'businessPlan.beneficiary', 'evaluator'],
    });
    if (!assignment) throw new NotFoundException(`Affectation ${id} introuvable`);
    return assignment;
  }

  async createAssignment(dto: CreateAssignmentDto, assignedByUserId: number): Promise<EvaluationAssignment> {
    const existing = await this.assignmentRepository.findOne({
      where: { businessPlanId: dto.businessPlanId, evaluatorId: dto.evaluatorId },
    });
    if (existing) throw new ConflictException('Ce plan est déjà affecté à cet évaluateur');

    const assignment = this.assignmentRepository.create({
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      assignedByUserId,
    });
    return this.assignmentRepository.save(assignment);
  }

  // ── Évaluations ──────────────────────────────────────────────────────────

  async submitEvaluation(dto: SubmitEvaluationDto, evaluatorId: number, userId?: number): Promise<Evaluation> {
    let assignment = await this.assignmentRepository.findOne({
      where: { businessPlanId: dto.businessPlanId, evaluatorId },
    });

    if (!assignment) {
      assignment = await this.assignmentRepository.save(
        this.assignmentRepository.create({
          businessPlanId: dto.businessPlanId,
          evaluatorId,
          assignedByUserId: userId,
        }),
      );
    }

    const existing = await this.evaluationRepository.findOne({
      where: { businessPlanId: dto.businessPlanId, evaluatorId },
    });
    if (existing) throw new ConflictException('Vous avez déjà soumis une évaluation pour ce plan');

    const totalScore = this.calcTotal(dto);
    const evaluation = this.evaluationRepository.create({
      ...dto,
      evaluatorId,
      assignmentId: assignment.id,
      totalScore,
      isFinalEvaluation: false,
    });

    const saved = await this.evaluationRepository.save(evaluation);

    assignment.status = 'COMPLETED';
    await this.assignmentRepository.save(assignment);

    return saved;
  }

  async updateEvaluation(id: number, dto: Partial<SubmitEvaluationDto>, evaluatorId: number): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id, evaluatorId },
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable');
    if (evaluation.isFinalEvaluation) throw new BadRequestException('L\'évaluation est finalisée et ne peut plus être modifiée');

    Object.assign(evaluation, dto);
    if (dto.economicViabilityScore !== undefined) {
      evaluation.totalScore = this.calcTotal({ ...evaluation, ...dto } as SubmitEvaluationDto);
    }
    return this.evaluationRepository.save(evaluation);
  }

  async findMyEvaluations(evaluatorId: number): Promise<Evaluation[]> {
    return this.evaluationRepository.find({
      where: { evaluatorId },
      relations: ['businessPlan', 'businessPlan.beneficiary', 'businessPlan.beneficiary.user'],
      order: { evaluationDate: 'DESC' },
    });
  }

  async findEvaluationsForBusinessPlan(businessPlanId: number): Promise<Evaluation[]> {
    return this.evaluationRepository.find({
      where: { businessPlanId },
      relations: ['evaluator', 'evaluator.user'],
      order: { evaluationDate: 'ASC' },
    });
  }

  async getEvaluationStats(editionId?: number): Promise<any> {
    const qb = this.assignmentRepository
      .createQueryBuilder('a')
      .select([
        'COUNT(*) as total',
        'SUM(CASE WHEN a.status = \'COMPLETED\' THEN 1 ELSE 0 END) as completed',
        'SUM(CASE WHEN a.status = \'PENDING\' THEN 1 ELSE 0 END) as pending',
      ]);

    if (editionId) qb.where('a.copaEditionId = :editionId', { editionId });

    const stats = await qb.getRawOne();
    return stats;
  }
}
