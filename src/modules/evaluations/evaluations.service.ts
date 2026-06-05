import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { Evaluator } from './entities/evaluator.entity';
import { EvaluationAssignment } from './entities/evaluation-assignment.entity';
import { SubmitEvaluationDto } from './dto/submit-evaluation.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { BusinessPlan } from '../business-plans/entities/business-plan.entity';
import { Status } from '../reference/entities/status.entity';

const MAX_EVALUATORS = 3;

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Evaluator)
    private readonly evaluatorRepository: Repository<Evaluator>,
    @InjectRepository(EvaluationAssignment)
    private readonly assignmentRepository: Repository<EvaluationAssignment>,
    @InjectRepository(BusinessPlan)
    private readonly businessPlanRepository: Repository<BusinessPlan>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
  ) {}

  private calcTotal(dto: SubmitEvaluationDto): number {
    // Grille VF26052026 : critères 11 et 12 passent à 1.5, nouveau critère 16 (affiché 13) coeff 1
    const COEFFICIENTS = [2, 2, 2, 2, 2, 2, 3, 2, 2, 3, 1.5, 1.5, 1, 2, 2, 2];
    const scores = [
      dto.criterion1Score,  dto.criterion2Score,  dto.criterion3Score,
      dto.criterion4Score,  dto.criterion5Score,  dto.criterion6Score,  dto.criterion7Score,
      dto.criterion8Score,  dto.criterion9Score,  dto.criterion10Score,
      dto.criterion11Score, dto.criterion12Score, dto.criterion16Score ?? 0,
      dto.criterion13Score, dto.criterion14Score, dto.criterion15Score,
    ];
    return scores.reduce((sum, score, i) => sum + (score ?? 0) * COEFFICIENTS[i], 0);
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

  async resolveEvaluatorIdForUser(evaluatorId: number | null | undefined, userId?: number): Promise<number> {
    return this.resolveEvaluatorId(evaluatorId, userId);
  }

  private async resolveEvaluatorId(evaluatorId: number | null | undefined, userId?: number): Promise<number> {
    if (evaluatorId) return evaluatorId;
    if (!userId) throw new BadRequestException('Profil évaluateur introuvable');
    let evaluator = await this.evaluatorRepository.findOne({ where: { userId } });
    if (!evaluator) {
      evaluator = await this.evaluatorRepository.save(
        this.evaluatorRepository.create({ userId }),
      );
    }
    return evaluator.id;
  }

  async submitEvaluation(dto: SubmitEvaluationDto, evaluatorId: number | null | undefined, userId?: number): Promise<Evaluation> {
    const resolvedEvaluatorId = await this.resolveEvaluatorId(evaluatorId, userId);
    let assignment = await this.assignmentRepository.findOne({
      where: { businessPlanId: dto.businessPlanId, evaluatorId: resolvedEvaluatorId },
    });

    if (!assignment) {
      const bp = await this.businessPlanRepository.findOne({ where: { id: dto.businessPlanId } });
      if (!bp) throw new NotFoundException(`Plan d'affaires ${dto.businessPlanId} introuvable`);
      assignment = await this.assignmentRepository.save(
        this.assignmentRepository.create({
          businessPlanId: dto.businessPlanId,
          evaluatorId: resolvedEvaluatorId,
          copaEditionId: bp.copaEditionId,
          assignedByUserId: userId,
        }),
      );
    }

    const existing = await this.evaluationRepository.findOne({
      where: { businessPlanId: dto.businessPlanId, evaluatorId: resolvedEvaluatorId },
    });
    if (existing) throw new ConflictException('Vous avez déjà soumis une évaluation pour ce plan');

    const totalScore = this.calcTotal(dto);
    const evaluation = this.evaluationRepository.create({
      ...dto,
      evaluatorId: resolvedEvaluatorId,
      assignmentId: assignment.id,
      totalScore,
      isFinalEvaluation: false,
    });

    const saved = await this.evaluationRepository.save(evaluation);

    assignment.status = 'COMPLETED';
    await this.assignmentRepository.save(assignment);

    await this.updateBusinessPlanStatus(dto.businessPlanId);

    return saved;
  }

  async updateEvaluation(id: number, dto: Partial<SubmitEvaluationDto>, evaluatorId: number): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id, evaluatorId },
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable');
    if (evaluation.isFinalEvaluation) throw new BadRequestException('L\'évaluation est finalisée et ne peut plus être modifiée');

    Object.assign(evaluation, dto);
    evaluation.totalScore = this.calcTotal(evaluation as unknown as SubmitEvaluationDto);
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

  async findAllEvaluations(editionId?: number): Promise<Evaluation[]> {
    const qb = this.evaluationRepository
      .createQueryBuilder('evaluation')
      .leftJoinAndSelect('evaluation.evaluator', 'evaluator')
      .leftJoinAndSelect('evaluator.user', 'evaluatorUser')
      .leftJoinAndSelect('evaluation.businessPlan', 'businessPlan')
      .leftJoinAndSelect('businessPlan.beneficiary', 'beneficiary')
      .leftJoinAndSelect('beneficiary.user', 'beneficiaryUser')
      .leftJoinAndSelect('beneficiaryUser.gender', 'gender')
      .leftJoin('beneficiary.company', 'company')
      .addSelect(['company.id', 'company.companyName'])
      .leftJoin('beneficiaryUser.primaryAddress', 'primaryAddress')
      .addSelect(['primaryAddress.id', 'primaryAddress.hill', 'primaryAddress.neighborhood'])
      .leftJoin('primaryAddress.commune', 'commune')
      .addSelect(['commune.id', 'commune.name'])
      .leftJoin('commune.province', 'province')
      .addSelect(['province.id', 'province.name'])
      .leftJoinAndSelect('businessPlan.copaEdition', 'copaEdition')
      .orderBy('businessPlan.referenceNumber', 'ASC')
      .addOrderBy('evaluation.evaluationDate', 'ASC');

    if (editionId) {
      qb.where('businessPlan.copaEditionId = :editionId', { editionId });
    }

    const { entities, raw } = await qb.getRawAndEntities();

    // TypeORM n'hydrate pas toujours les relations à 4+ niveaux de profondeur
    // depuis l'entité racine — on complète manuellement depuis le SQL brut.
    entities.forEach((ev, i) => {
      const r = raw[i];
      if (!r) return;
      const beneficiary = ev.businessPlan?.beneficiary;
      if (!beneficiary) return;

      if (!beneficiary.company) {
        const companyName = r['company_company_name'] ?? r['company_companyName'];
        if (companyName) beneficiary.company = { companyName } as any;
      }

      if (beneficiary.user && !beneficiary.user.gender) {
        const code  = r['gender_code'];
        const label = r['gender_label'];
        if (code) beneficiary.user.gender = { code, label } as any;
      }

      if (beneficiary.user && !beneficiary.user.primaryAddress) {
        const hill         = r['primaryAddress_hill'];
        const neighborhood = r['primaryAddress_neighborhood'];
        const communeName  = r['commune_name'];
        const provinceName = r['province_name'];
        beneficiary.user.primaryAddress = {
          hill:          hill         ?? null,
          neighborhood:  neighborhood ?? null,
          commune: communeName ? {
            name:     communeName,
            province: provinceName ? { name: provinceName } as any : null,
          } as any : null,
        } as any;
      }
    });

    return entities;
  }

  private async updateBusinessPlanStatus(businessPlanId: number): Promise<void> {
    const count = await this.evaluationRepository.count({ where: { businessPlanId } });
    const statusCode = count >= MAX_EVALUATORS ? 'EVALUATED' : 'UNDER_EVALUATION';
    const status = await this.statusRepository.findOne({
      where: { code: statusCode, entityType: 'BUSINESS_PLAN' },
    });
    if (status) {
      await this.businessPlanRepository.update(businessPlanId, { statusId: status.id });
    }
  }

  async getGapData(businessPlanId: number): Promise<Record<string, number>> {
    const count = await this.evaluationRepository.count({ where: { businessPlanId } });
    if (count === 0) return {};

    const criteriaKeys = [
      'criterion1Score', 'criterion2Score', 'criterion3Score',
      'criterion4Score', 'criterion5Score', 'criterion6Score', 'criterion7Score',
      'criterion8Score', 'criterion9Score', 'criterion10Score',
      'criterion11Score', 'criterion12Score', 'criterion16Score',
      'criterion13Score', 'criterion14Score', 'criterion15Score',
    ];

    const selects = criteriaKeys.map((k) => `AVG(e.${k}) as "${k}"`);
    const result = await this.evaluationRepository
      .createQueryBuilder('e')
      .select(selects)
      .where('e.businessPlanId = :businessPlanId', { businessPlanId })
      .getRawOne();

    if (!result) return {};
    return Object.fromEntries(
      criteriaKeys.map((k) => [k, result[k] != null ? parseFloat(result[k]) : 0]),
    );
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
