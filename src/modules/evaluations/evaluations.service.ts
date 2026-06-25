import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { Evaluator } from './entities/evaluator.entity';
import { EvaluationAssignment } from './entities/evaluation-assignment.entity';
import { SubmitEvaluationDto } from './dto/submit-evaluation.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { BusinessPlan } from '../business-plans/entities/business-plan.entity';
import { Status } from '../reference/entities/status.entity';
import { Document } from '../documents/entities/document.entity';
import { S3Service } from '../documents/storage/s3.service';
import archiver = require('archiver');
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';

const MAX_EVALUATORS = 3;

type InfoCol = { header: string; key: string; width: number; numFmt?: string };

// Mêmes critères, libellés, sections et coefficients que SCORE_CRITERIA côté
// backoffice (src/lib/api/types/evaluateur.types.ts) — pour reproduire à
// l'identique l'export de l'onglet "Évaluation" d'un plan d'affaires.
const EVALUATION_CRITERIA: { key: string; num: number; section: string; label: string; coefficient: number }[] = [
  { key: 'criterion1Score', num: 1, section: "A. L'objectif et l'idée de projet", label: "L'objectif de l'entreprise est SMART", coefficient: 2 },
  { key: 'criterion2Score', num: 2, section: "A. L'objectif et l'idée de projet", label: "L'idée de projet est innovante", coefficient: 2 },
  { key: 'criterion3Score', num: 3, section: "A. L'objectif et l'idée de projet", label: 'La genèse du projet est originale', coefficient: 2 },
  { key: 'criterion4Score', num: 4, section: 'B. Stratégie et plan marketing', label: "Le besoin est clairement démontré et la part du marché de l'entreprise est prouvée", coefficient: 2 },
  { key: 'criterion5Score', num: 5, section: 'B. Stratégie et plan marketing', label: "L'intérêt de l'offre pour la clientèle et l'avantage concurrentiel sont prouvés", coefficient: 2 },
  { key: 'criterion6Score', num: 6, section: 'B. Stratégie et plan marketing', label: "L'étude FFOM des concurrents potentiels ainsi que le positionnement de l'entreprise sont cohérents et réalistes", coefficient: 2 },
  { key: 'criterion7Score', num: 7, section: 'B. Stratégie et plan marketing', label: 'Le plan marketing est cohérent et chiffré', coefficient: 3 },
  { key: 'criterion8Score', num: 8, section: 'C. Moyens techniques à mettre en œuvre', label: 'Les moyens humains du projet sont en adéquation avec son objet et les objectifs poursuivis', coefficient: 2 },
  { key: 'criterion9Score', num: 9, section: 'C. Moyens techniques à mettre en œuvre', label: "Les équipements nécessaires sont disponibles et acquérables, ainsi que la possibilité d'avoir des pièces de rechange", coefficient: 2 },
  { key: 'criterion10Score', num: 10, section: 'C. Moyens techniques à mettre en œuvre', label: 'Le processus de fabrication est maîtrisé', coefficient: 3 },
  { key: 'criterion11Score', num: 11, section: 'D. Impact environnemental et social', label: "L'entreprise a intégré dans son approche la question de la protection de l'environnement (mesures d'atténuation) ou de résilience climatique", coefficient: 1.5 },
  { key: 'criterion12Score', num: 12, section: 'D. Impact environnemental et social', label: "L'entreprise a intégré dans son approche la question d'inclusion sociale, la prise en compte des communautés locales et des personnes vulnérables", coefficient: 1.5 },
  { key: 'criterion16Score', num: 13, section: 'D. Impact environnemental et social', label: 'L\'entreprise est-elle dirigée par une femme, un réfugié, un batwa, un albinos ou une personne vivant avec un autre handicap ?', coefficient: 1 },
  { key: 'criterion13Score', num: 14, section: 'E. Études économiques et financières', label: 'Les chiffres utilisés dans la partie économique et financière et les autres parties du business plan sont cohérents', coefficient: 2 },
  { key: 'criterion14Score', num: 15, section: 'E. Études économiques et financières', label: 'La demande de financement est claire, chiffrée et cohérente', coefficient: 2 },
  { key: 'criterion15Score', num: 16, section: 'E. Études économiques et financières', label: "Les marges sont connues et l'activité est rentable", coefficient: 2 },
];

const TOTAL_MAX = EVALUATION_CRITERIA.reduce((sum, c) => sum + c.coefficient * 5, 0); // 160

const RECOMMENDATION_LABELS: Record<string, string> = {
  STRONGLY_RECOMMENDED: 'Fortement recommandé',
  RECOMMENDED: 'Recommandé',
  RECOMMENDED_WITH_RESERVES: 'Recommandé avec réserves',
  NOT_RECOMMENDED: 'Non recommandé',
};

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
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly s3Service: S3Service,
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

  async findMyEvaluations(evaluatorId: number, editionId?: number): Promise<Evaluation[]> {
    const qb = this.evaluationRepository
      .createQueryBuilder('evaluation')
      .leftJoinAndSelect('evaluation.businessPlan', 'businessPlan')
      .leftJoinAndSelect('businessPlan.beneficiary', 'beneficiary')
      .leftJoinAndSelect('beneficiary.user', 'user')
      .where('evaluation.evaluatorId = :evaluatorId', { evaluatorId })
      .orderBy('evaluation.evaluationDate', 'DESC');

    if (editionId) {
      qb.andWhere('businessPlan.copaEditionId = :editionId', { editionId });
    }

    return qb.getMany();
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
      .leftJoinAndSelect('beneficiary.status', 'beneficiaryStatus')
      .leftJoinAndSelect('beneficiary.subscriptionStatus', 'subscriptionStatus')
      .leftJoinAndSelect('beneficiary.preSelectedBy', 'preSelectedByUser')
      .leftJoinAndSelect('beneficiary.validatedBy', 'validatedByUser')
      .leftJoinAndSelect('beneficiary.rejectedBy', 'rejectedByUser')
      .leftJoinAndSelect('businessPlan.status', 'businessPlanStatus')
      .leftJoinAndSelect('businessPlan.businessSector', 'planBusinessSector')
      .leftJoinAndSelect('businessPlan.submittedBy', 'submittedByUser')
      .leftJoinAndSelect('businessPlan.financialDataEvaluator', 'financialDataEvaluatorUser')
      .leftJoinAndSelect('beneficiary.user', 'beneficiaryUser')
      .leftJoinAndSelect('beneficiaryUser.gender', 'gender')
      .leftJoinAndSelect('beneficiary.company', 'company')
      .leftJoin('company.primarySector', 'primarySector')
      .addSelect(['primarySector.id', 'primarySector.nameFr'])
      .leftJoin('company.secondarySector', 'secondarySector')
      .addSelect(['secondarySector.id', 'secondarySector.nameFr'])
      .leftJoin('beneficiaryUser.primaryAddress', 'primaryAddress')
      .addSelect(['primaryAddress.id', 'primaryAddress.street', 'primaryAddress.neighborhood'])
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

      if (beneficiary.company) {
        if (!beneficiary.company.primarySector) {
          const sectorName = r['primarySector_name_fr'] ?? r['primarySector_nameFr'];
          if (sectorName) (beneficiary.company as any).primarySector = { nameFr: sectorName };
        }
        if (!beneficiary.company.secondarySector) {
          const sectorName = r['secondarySector_name_fr'] ?? r['secondarySector_nameFr'];
          if (sectorName) (beneficiary.company as any).secondarySector = { nameFr: sectorName };
        }
      }

      if (beneficiary.user && !beneficiary.user.gender) {
        const code  = r['gender_code'];
        const label = r['gender_label'];
        if (code) beneficiary.user.gender = { code, label } as any;
      }

      if (beneficiary.user) {
        const street       = r['primaryAddress_street'];
        const neighborhood = r['primaryAddress_neighborhood'];
        const communeName  = r['commune_name'];
        const provinceName = r['province_name'];

        if (!beneficiary.user.primaryAddress) {
          beneficiary.user.primaryAddress = {
            street:        street       ?? null,
            neighborhood:  neighborhood ?? null,
            commune: communeName ? {
              name:     communeName,
              province: provinceName ? { name: provinceName } as any : null,
            } as any : null,
          } as any;
        } else {
          if (!beneficiary.user.primaryAddress.commune) {
            if (communeName) {
              (beneficiary.user.primaryAddress as any).commune = {
                name:     communeName,
                province: provinceName ? { name: provinceName } as any : null,
              };
            }
          } else if (!beneficiary.user.primaryAddress.commune.province) {
            if (provinceName) {
              (beneficiary.user.primaryAddress.commune as any).province = { name: provinceName };
            }
          }
        }
      }
    });

    // Lien vers le fichier du plan d'affaires déposé (uploadé séparément du
    // formulaire de candidature, via documentTypeId=8 / entityType=businessPlan).
    const businessPlanIds = [
      ...new Set(entities.map((ev) => ev.businessPlanId).filter((id) => id != null)),
    ];
    if (businessPlanIds.length) {
      const documents = await this.documentRepository.find({
        where: { entityId: In(businessPlanIds), entityType: 'businessPlan' },
        order: { createdAt: 'DESC' },
      });
      const fileByPlanId = new Map<number, string>();
      for (const doc of documents) {
        if (!fileByPlanId.has(doc.entityId)) fileByPlanId.set(doc.entityId, doc.filePath);
      }
      entities.forEach((ev) => {
        if (ev.businessPlan) {
          (ev.businessPlan as any).documentUrl = fileByPlanId.get(ev.businessPlanId) ?? null;
        }
      });
    }

    return entities;
  }

  /**
   * Construit, dans un flux ZIP envoyé directement à la réponse HTTP, un
   * dossier par candidat (référence_nom_prénom/) contenant sa fiche
   * d'informations + notes (CSV) et le fichier de plan d'affaires qu'il a
   * lui-même déposé en ligne.
   */
  async streamDossiersZip(editionId: number | undefined, res: Response): Promise<void> {
    // N'exporter que les candidats ayant déposé une version finale de leur
    // plan d'affaires — les versions intermédiaires/brouillons ne sont pas
    // pertinentes pour l'évaluation et ne doivent pas polluer l'archive.
    const evaluations = (await this.findAllEvaluations(editionId)).filter(
      (ev) => (ev.businessPlan as any)?.isFinalVersion === true,
    );

    const byPlan = new Map<number, Evaluation[]>();
    for (const ev of evaluations) {
      const arr = byPlan.get(ev.businessPlanId) ?? [];
      arr.push(ev);
      byPlan.set(ev.businessPlanId, arr);
    }

    const planIds = [...byPlan.keys()];
    const beneficiaryIds = [
      ...new Set(
        [...byPlan.values()].map((evs) => (evs[0]?.businessPlan as any)?.beneficiary?.id).filter((id) => id != null),
      ),
    ];

    // Tous les documents (toutes versions/corrections confondues, pas
    // seulement le plus récent) rattachés au bénéficiaire ou à son plan
    // d'affaires — utilisé à la fois pour la feuille "Documents" et pour
    // joindre les fichiers réels dans l'archive.
    const [businessPlanDocs, beneficiaryDocs] = await Promise.all([
      planIds.length
        ? this.documentRepository.find({
            where: { entityId: In(planIds), entityType: 'businessPlan' },
            relations: ['documentType'],
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([] as Document[]),
      beneficiaryIds.length
        ? this.documentRepository.find({
            where: { entityId: In(beneficiaryIds), entityType: 'beneficiary' },
            relations: ['documentType'],
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([] as Document[]),
    ]);

    const planDocsByPlanId = new Map<number, Document[]>();
    for (const doc of businessPlanDocs) {
      const arr = planDocsByPlanId.get(doc.entityId) ?? [];
      arr.push(doc);
      planDocsByPlanId.set(doc.entityId, arr);
    }
    const benDocsByBenId = new Map<number, Document[]>();
    for (const doc of beneficiaryDocs) {
      const arr = benDocsByBenId.get(doc.entityId) ?? [];
      arr.push(doc);
      benDocsByBenId.set(doc.entityId, arr);
    }

    const archive = archiver('zip', { zlib: { level: 9 } });

    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="dossiers-candidats.zip"',
    );
    archive.pipe(res);

    const candidateExports: { bp: any; ben: any; evs: Evaluation[]; documents: Document[] }[] = [];

    for (const [planId, evs] of byPlan.entries()) {
      const bp: any = evs[0]?.businessPlan;
      const ben = bp?.beneficiary;
      const folderName = this.sanitizeFolderName(
        `${bp?.referenceNumber ?? planId}_${ben?.user?.lastName ?? ''}_${ben?.user?.firstName ?? ''}`,
      );

      const documents = [
        ...(ben?.id ? benDocsByBenId.get(ben.id) ?? [] : []),
        ...(planDocsByPlanId.get(planId) ?? []),
      ];
      candidateExports.push({ bp, ben, evs, documents });

      archive.append(await this.buildInfoWorkbook(bp, ben, evs, documents), {
        name: `${folderName}/informations.xlsx`,
      });

      archive.append(await this.buildEvaluationWorkbook(evs), {
        name: `${folderName}/evaluation.xlsx`,
      });

      const { candidature, correction, planAffaires } = this.groupDocumentsForArchive(documents);
      await this.appendDocuments(archive, candidature, `${folderName}/documents/candidature`);
      await this.appendDocuments(archive, correction, `${folderName}/documents/correction`);
      await this.appendDocuments(archive, planAffaires, `${folderName}/documents/plan-affaires`);
    }

    archive.append(await this.buildAllCandidatesWorkbook(candidateExports), {
      name: 'informations-tous-candidats.xlsx',
    });

    await archive.finalize();
  }

  /**
   * Répartit les documents d'un candidat en trois lots pour l'archive,
   * chacun réduit à la dernière version par type (documentTypeId) : les
   * documents déposés à la candidature, ceux déposés lors d'une correction
   * (formStep='CORRECTION', seul marqueur fiable — voir documents.service.ts),
   * et le plan d'affaires déposé.
   */
  private groupDocumentsForArchive(documents: Document[]): {
    candidature: Document[];
    correction: Document[];
    planAffaires: Document[];
  } {
    const latestByType = (docs: Document[]): Document[] => {
      const seen = new Set<number>();
      const result: Document[] = [];
      for (const doc of docs) {
        const typeId = doc.documentTypeId ?? -1;
        if (seen.has(typeId)) continue;
        seen.add(typeId);
        result.push(doc);
      }
      return result;
    };

    const beneficiaryDocs = documents.filter((d) => d.entityType === 'beneficiary');
    const planDocs = documents.filter((d) => d.entityType === 'businessPlan');
    const planAffairesDoc =
      planDocs.find((d) => (d.documentType?.name ?? '').toLowerCase().includes("plan d'affaires")) ?? planDocs[0];

    return {
      candidature: latestByType(beneficiaryDocs.filter((d) => d.formStep !== 'CORRECTION')),
      correction: latestByType(beneficiaryDocs.filter((d) => d.formStep === 'CORRECTION')),
      planAffaires: planAffairesDoc ? [planAffairesDoc] : [],
    };
  }

  private async appendDocuments(archive: archiver.Archiver, documents: Document[], folder: string): Promise<void> {
    let i = 0;
    for (const doc of documents) {
      i += 1;
      try {
        const key = doc.filePath?.startsWith('local://') ? doc.filePath : doc.storedFilename;
        const stream = await this.s3Service.downloadFile(key);
        const typeName = this.sanitizeFolderName(doc.documentType?.name ?? 'document');
        archive.append(stream, {
          name: `${folder}/${i}_${typeName}_${doc.validationStatus}_${doc.originalFilename}`,
        });
      } catch {
        // Fichier introuvable sur le stockage : on continue sans bloquer le reste de l'archive.
      }
    }
  }

  private sanitizeFolderName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 100);
  }

  private readonly HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };
  private readonly TOTAL_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' },
  };
  private readonly THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFB7C6D9' } },
    left: { style: 'thin', color: { argb: 'FFB7C6D9' } },
    bottom: { style: 'thin', color: { argb: 'FFB7C6D9' } },
    right: { style: 'thin', color: { argb: 'FFB7C6D9' } },
  };

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = this.HEADER_FILL;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = this.THIN_BORDER;
    });
    row.height = 28;
  }

  private styleSectionRow(row: ExcelJS.Row, colCount: number): void {
    for (let col = 1; col <= colCount; col++) {
      const cell = row.getCell(col);
      cell.font = { bold: true, color: { argb: 'FF1F4E78' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
      cell.border = this.THIN_BORDER;
    }
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row.height = 22;
  }

  // Mêmes seuils que scoreClass() côté backoffice
  // (src/app/(hydrogen)/plans-affaires/[id]/evaluations/page.tsx).
  private readonly SCORE_STYLES: { min: number; font: string }[] = [
    { min: 4, font: 'FF15803D' }, // green
    { min: 3, font: 'FF1D4ED8' }, // blue
    { min: 2, font: 'FFB45309' }, // amber
    { min: 1, font: 'FFDC2626' }, // red
    { min: -Infinity, font: 'FF9CA3AF' }, // gray
  ];

  // Mêmes seuils que totalClass() côté backoffice.
  private readonly TOTAL_STYLES: { min: number; font: string }[] = [
    { min: 70, font: 'FF16A34A' },
    { min: 40, font: 'FFD97706' },
    { min: -Infinity, font: 'FFDC2626' },
  ];

  private applyScoreStyle(cell: ExcelJS.Cell, score: number | null): void {
    if (score === null) return;
    const style = this.SCORE_STYLES.find((s) => score >= s.min)!;
    cell.font = { bold: true, color: { argb: style.font } };
  }

  private totalFontColor(pct: number): string {
    return this.TOTAL_STYLES.find((s) => pct >= s.min)!.font;
  }

  private mapCategory(code?: string | null): string {
    return code === 'REFUGEE' ? 'Réfugié(e)' : code === 'BURUNDIAN' ? 'Burundais(e)' : code === 'OTHER' ? 'Autre' : '';
  }

  private mapMaritalStatus(code?: string | null): string {
    switch (code) {
      case 'single': return 'Célibataire';
      case 'married': return 'Marié(e)';
      case 'divorced': return 'Divorcé(e)';
      case 'widowed': return 'Veuf(ve)';
      default: return '';
    }
  }

  private mapEducationLevel(code?: string | null): string {
    switch (code) {
      case 'none': return 'Non scolarisé(e)';
      case 'primary': return 'Primaire';
      case 'secondary': return 'Secondaire';
      case 'university': return 'Universitaire';
      default: return '';
    }
  }

  private mapCompanyType(code?: string | null): string {
    return code === 'formal' ? 'Formel' : code === 'informal' ? 'Informel' : code === 'project' ? 'Projet' : '';
  }

  private mapLegalStatus(code?: string | null, other?: string | null): string {
    switch (code) {
      case 'php': return 'Personne physique';
      case 'snc': return 'Société en Nom Collectif (SNC)';
      case 'sprl': return 'Société de Personnes à Responsabilité Limitée (SPRL)';
      case 'scs': return 'Société en Commandite Simple (SCS)';
      case 'su': return 'Société Unipersonnelle (SU)';
      case 'sa': return 'Société Anonyme (SA)';
      case 'coop': return 'Société Coopérative';
      default: return other ?? code ?? '';
    }
  }

  /**
   * Colonnes (et marqueurs de section) de la feuille "Informations" —
   * structure statique partagée entre la fiche d'un seul candidat
   * (buildInfoWorkbook) et le fichier maître compilant tous les candidats
   * (buildAllCandidatesWorkbook).
   */
  private buildInfoColumns(): { columns: InfoCol[]; SECTION_MARKERS: Record<string, string> } {
    // Colonnes "marqueur de section" (mêmes valeurs en tirets que l'export
    // candidatures-all) insérées devant chaque bloc de champs, pour repérer
    // les groupes malgré la largeur de la feuille — un seul candidat/ligne.
    const SECTION_MARKERS: Record<string, string> = {
      sectionInfosPersonnellesMacro: '--- INFORMATIONS PERSONNELLES ---',
      sectionIdentite: '--- IDENTITÉ ---',
      sectionAdresse: '--- ADRESSE ---',
      sectionConflitInteret: "--- DÉCLARATION DE CAS DE CONFLIT D'INTÉRÊT ---",
      sectionCandidature: '--- CANDIDATURE ---',
      sectionEntrepriseMacro: "--- INFORMATIONS SUR L'ENTREPRISE ---",
      sectionInfosGenerales: '--- INFORMATIONS GÉNÉRALES ---',
      sectionPersonnel: '--- LE PERSONNEL ---',
      sectionFinances: '--- FINANCES ---',
      sectionProjetMacro: '--- PRÉSENTATION DU PROJET ---',
      sectionPresentationProjet: '--- PRÉSENTATION DU PROJET ---',
      sectionEmploisPrevus: '--- EMPLOIS PRÉVUS DANS LE CADRE DU PROJET ---',
      sectionAutresInfosProjet: '--- AUTRES INFORMATIONS SUR VOTRE PROJET ---',
      sectionPreselection: '--- PRÉSÉLECTION & VALIDATION ---',
      sectionPlanAffaires: "--- PLAN D'AFFAIRES ---",
      sectionEvaluation: '--- ÉVALUATION ---',
    };
    const marker = (key: keyof typeof SECTION_MARKERS): InfoCol => ({ header: 'Section', key, width: 32 });

    // Une seule ligne de données (à plat) : ordre chronologique du parcours
    // candidat — identité → inscription → entreprise/projet déclarés à
    // l'inscription → présélection → plan d'affaires → évaluation.
    // Volontairement exclus : champs d'authentification internes
    // (mot de passe, jetons de réinitialisation/vérification, compteurs de
    // tentatives de connexion) — sans intérêt pour l'évaluation et risqués
    // à exporter dans un fichier partagé.
    const columns: InfoCol[] = [
      marker('sectionInfosPersonnellesMacro'),
      marker('sectionIdentite'),
      { header: 'Nom', key: 'nom', width: 24 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Téléphone', key: 'telephone', width: 16 },
      { header: 'Réfugié (compte)', key: 'estRefugieCompte', width: 14 },
      { header: 'Compte créé le', key: 'compteCreeLe', width: 14, numFmt: 'dd/mm/yyyy' },
      { header: 'Dernière connexion', key: 'derniereConnexion', width: 16, numFmt: 'dd/mm/yyyy' },
      { header: 'Sexe', key: 'sexe', width: 10 },
      { header: 'Date de naissance', key: 'dateNaissance', width: 14, numFmt: 'dd/mm/yyyy' },
      { header: 'Âge', key: 'age', width: 8 },
      { header: 'Statut', key: 'statutCategorie', width: 14 },
      { header: 'Situation matrimoniale', key: 'situationMatrimoniale', width: 18 },
      { header: "Niveau d'éducation", key: 'niveauEducation', width: 16 },
      { header: 'Fonction', key: 'fonction', width: 16 },

      marker('sectionAdresse'),
      { header: 'Province', key: 'province', width: 14 },
      { header: 'Commune', key: 'commune', width: 14 },
      { header: 'Quartier', key: 'quartier', width: 14 },
      { header: 'Rue', key: 'rue', width: 18 },

      marker('sectionConflitInteret'),
      { header: 'Agent de l\'État', key: 'estAgentEtat', width: 14 },
      { header: "Proche d'un agent de l'État", key: 'procheAgentEtat', width: 18 },
      { header: "Stagiaire de l'État", key: 'estStagiaireEtat', width: 14 },
      { header: "Proche d'un stagiaire de l'État", key: 'procheStagiaireEtat', width: 18 },
      { header: 'A été haut fonctionnaire', key: 'futHautFonctionnaire', width: 18 },
      { header: "Proche d'un haut fonctionnaire", key: 'procheHautFonctionnaire', width: 20 },
      { header: 'Lien avec un projet existant', key: 'lienProjetExistant', width: 18 },
      { header: 'Fournisseur direct du projet', key: 'fournisseurDirectProjet', width: 18 },
      { header: 'Subvention antérieure', key: 'subventionAnterieure', width: 16 },
      { header: 'Détails subvention antérieure', key: 'detailsSubventionAnterieure', width: 30 },

      marker('sectionCandidature'),
      { header: 'Code bénéficiaire', key: 'codeBeneficiaire', width: 16 },
      { header: 'Édition', key: 'edition', width: 24 },
      { header: 'Date de soumission de candidature', key: 'dateSoumissionCandidature', width: 16, numFmt: 'dd/mm/yyyy' },
      { header: 'Document candidature 1 — Type', key: 'doc1Type', width: 24 },
      { header: 'Document candidature 1 — Lien', key: 'doc1Lien', width: 18 },
      { header: 'Document candidature 2 — Type', key: 'doc2Type', width: 24 },
      { header: 'Document candidature 2 — Lien', key: 'doc2Lien', width: 18 },
      { header: 'Document candidature 3 — Type', key: 'doc3Type', width: 24 },
      { header: 'Document candidature 3 — Lien', key: 'doc3Lien', width: 18 },
      { header: 'Documents corrigés', key: 'documentsCorrigesFlag', width: 16 },
      { header: 'A soumis la correction', key: 'aSoumisCorrection', width: 16 },
      { header: 'A soumis la correction le', key: 'aSoumisCorrectionLe', width: 16, numFmt: 'dd/mm/yyyy' },
      { header: 'Document de correction — Type', key: 'docCorrectionType', width: 24 },
      { header: 'Document de correction — Lien', key: 'docCorrectionLien', width: 18 },

      marker('sectionEntrepriseMacro'),
      marker('sectionInfosGenerales'),
      { header: "Nom de l'entreprise", key: 'nomEntreprise', width: 24 },
      { header: "N° d'enregistrement", key: 'numEnregistrement', width: 18 },
      { header: 'N° RCCM', key: 'numRccm', width: 16 },
      { header: 'NIF', key: 'nif', width: 16 },
      { header: 'N° contribuable', key: 'numContribuable', width: 16 },
      { header: "Type d'entreprise", key: 'typeEntreprise', width: 14 },
      { header: 'Statut légal', key: 'statutLegal', width: 30 },
      { header: "Secteur d'activité", key: 'secteurActivite', width: 20 },
      { header: 'Autre secteur', key: 'autreSecteur', width: 18 },
      { header: "Description de l'activité", key: 'descriptionActivite', width: 35 },
      { header: 'Date de création', key: 'dateCreationEntreprise', width: 14, numFmt: 'dd/mm/yyyy' },
      { header: 'Tél. entreprise', key: 'telEntreprise', width: 16 },
      { header: 'Email entreprise', key: 'emailEntreprise', width: 26 },
      { header: "Service d'appui", key: 'serviceAppui', width: 14 },
      { header: 'Affiliée à une CGA', key: 'affilieeCGA', width: 16 },
      { header: 'Impact climatique positif', key: 'impactClimatiquePositif', width: 18 },

      marker('sectionPersonnel'),
      { header: 'Employés permanents', key: 'employesPermanents', width: 14 },
      { header: 'Employés temporaires', key: 'employesTemporaires', width: 14 },
      { header: 'Employés femmes', key: 'employesFemmes', width: 14 },
      { header: 'Employés hommes', key: 'employesHommes', width: 14 },
      { header: 'Employés jeunes', key: 'employesJeunes', width: 14 },
      { header: 'Employés réfugiés', key: 'employesRefugies', width: 14 },
      { header: 'Employés batwa', key: 'employesBatwa', width: 14 },
      { header: 'Employés handicapés', key: 'employesHandicapes', width: 14 },
      { header: 'Employés albinos', key: 'employesAlbinos', width: 14 },
      { header: 'Employés rapatriés', key: 'employesRapatries', width: 14 },
      { header: 'Employés temps partiel', key: 'employesTempsPartiel', width: 14 },
      { header: 'Employés total', key: 'employesTotal', width: 12 },
      { header: "Nombre d'associés", key: 'nombreAssocies', width: 14 },
      { header: 'Associées femmes', key: 'associesFemmes', width: 14 },
      { header: 'Associés hommes', key: 'associesHommes', width: 14 },
      { header: 'Associés réfugiés', key: 'associesRefugies', width: 14 },
      { header: 'Associés batwa', key: 'associesBatwa', width: 14 },
      { header: 'Associés handicapés', key: 'associesHandicapes', width: 14 },
      { header: 'Associés albinos', key: 'associesAlbinos', width: 14 },
      { header: 'Associés rapatriés', key: 'associesRapatries', width: 14 },

      marker('sectionFinances'),
      { header: 'CA N-1 (BIF)', key: 'caN1', width: 16, numFmt: '#,##0' },
      { header: 'Compte bancaire', key: 'compteBancaire', width: 14 },
      { header: 'Crédit bancaire', key: 'creditBancaire', width: 14 },
      { header: 'Montant crédit bancaire', key: 'montantCreditBancaire', width: 18, numFmt: '#,##0.00' },

      marker('sectionProjetMacro'),
      marker('sectionPresentationProjet'),
      { header: 'Titre du projet', key: 'titreProjet', width: 30 },
      { header: 'Objectif du projet', key: 'objectifProjet', width: 35 },
      { header: "Idée d'entreprise", key: 'ideeEntreprise', width: 35 },
      { header: 'Activités principales', key: 'activitesPrincipales', width: 30 },
      { header: 'Produits / services', key: 'produitsServices', width: 30 },
      { header: 'Clientèle ciblée', key: 'clienteleCiblee', width: 30 },
      { header: 'A des concurrents', key: 'aDesConcurrents', width: 14 },
      { header: 'Noms des concurrents', key: 'nomsConcurrents', width: 30 },

      marker('sectionEmploisPrevus'),
      { header: 'Femmes prévues', key: 'femmesPrevues', width: 12 },
      { header: 'Hommes prévus', key: 'hommesPrevus', width: 12 },
      { header: 'Emplois permanents prévus', key: 'emploisPermanentsPrevus', width: 16 },
      { header: 'Emplois réfugiés prévus', key: 'emploisRefugiesPrevus', width: 16 },
      { header: 'Emplois batwa prévus', key: 'emploisBatwaPrevus', width: 16 },
      { header: 'Emplois handicapés prévus', key: 'emploisHandicapesPrevus', width: 16 },
      { header: 'Emplois albinos prévus', key: 'emploisAlbinosPrevus', width: 16 },
      { header: 'Emplois rapatriés prévus', key: 'emploisRapatriesPrevus', width: 16 },
      { header: 'Emplois temps partiel prévus', key: 'emploisTempsPartielPrevus', width: 18 },

      marker('sectionAutresInfosProjet'),
      { header: 'Idée testée', key: 'ideeTestee', width: 12 },
      { header: 'Nouvelle idée', key: 'nouvelleIdee', width: 12 },
      { header: 'Actions climatiques', key: 'actionsClimatiques', width: 30 },
      { header: "Actions d'inclusion", key: 'actionsInclusion', width: 30 },
      { header: 'Coût total demandé (BIF)', key: 'coutTotalDemande', width: 18, numFmt: '#,##0' },
      { header: 'Subvention demandée (BIF)', key: 'subventionDemandee', width: 18, numFmt: '#,##0' },
      { header: 'Coût estimé', key: 'coutEstime', width: 12 },
      { header: 'Dépenses principales', key: 'depensesPrincipales', width: 30 },

      marker('sectionPreselection'),
      { header: 'Présélectionné le', key: 'preselectionneLe', width: 14, numFmt: 'dd/mm/yyyy' },
      { header: 'Présélectionné par', key: 'preselectionnePar', width: 20 },
      { header: 'Commentaire de présélection', key: 'commentairePreselection', width: 35 },

      marker('sectionPlanAffaires'),
      { header: 'Référence', key: 'reference', width: 14 },
      { header: "Statut du plan d'affaires", key: 'statutPlanAffaires', width: 18 },
      { header: 'Description du plan', key: 'descriptionPlan', width: 35 },
      { header: 'Secteur du plan', key: 'secteurPlan', width: 20 },
      { header: 'Montant demandé (plan)', key: 'montantDemandePlan', width: 18, numFmt: '#,##0' },
      { header: 'Apport personnel déclaré', key: 'apportPersonnelDeclare', width: 18, numFmt: '#,##0' },
      { header: 'Soumis le', key: 'soumisLe', width: 14, numFmt: 'dd/mm/yyyy' },
      { header: 'Soumis par', key: 'soumisPar', width: 20 },
      { header: 'Dernière modification le', key: 'derniereModifLe', width: 16, numFmt: 'dd/mm/yyyy' },
      { header: 'Version', key: 'version', width: 10 },
      { header: 'Version finale', key: 'versionFinale', width: 12 },
      { header: 'Coût total vérifié (USD)', key: 'coutTotalVerifie', width: 18, numFmt: '#,##0.00' },
      { header: 'Subvention totale vérifiée (USD)', key: 'subventionTotaleVerifiee', width: 20, numFmt: '#,##0.00' },
      { header: 'dont investissement vérifiée (USD)', key: 'investissementVerifie', width: 20, numFmt: '#,##0.00' },
      { header: 'dont exploitation vérifiée (USD)', key: 'exploitationVerifiee', width: 20, numFmt: '#,##0.00' },
      { header: 'Apport personnel vérifié (USD)', key: 'apportPersonnel', width: 18, numFmt: '#,##0.00' },
      { header: 'Évaluateur des données financières', key: 'evaluateurDonneesFinancieres', width: 22 },
      { header: 'Emplois prévus', key: 'emploisPrevus', width: 12 },
      { header: 'dont femmes', key: 'emploisPrevusFemmes', width: 12 },
      { header: "Plan d'affaires (fichier) — Type", key: 'docPlanType', width: 24 },
      { header: "Plan d'affaires (fichier) — Lien", key: 'docPlanLien', width: 18 },
    ];

    columns.push(marker('sectionEvaluation'));
    for (let i = 0; i < MAX_EVALUATORS; i++) {
      columns.push({ header: `Évaluateur ${i + 1}`, key: `evaluateur${i}Nom`, width: 20 });
      columns.push({ header: `Évaluateur ${i + 1} — Note /160`, key: `evaluateur${i}Note`, width: 16, numFmt: '0.00' });
      columns.push({ header: `Évaluateur ${i + 1} — Recommandation`, key: `evaluateur${i}Reco`, width: 22 });
      columns.push({ header: `Évaluateur ${i + 1} — Date d'évaluation`, key: `evaluateur${i}Date`, width: 16, numFmt: 'dd/mm/yyyy' });
    }
    columns.push({ header: 'Moyenne /160', key: 'moyenne', width: 12, numFmt: '0.00' });
    columns.push({ header: '% moyen', key: 'pctMoyen', width: 10, numFmt: '0.00' });

    return { columns, SECTION_MARKERS };
  }

  /**
   * Calcule les valeurs (une par colonne de buildInfoColumns) pour un seul
   * candidat — réutilisé pour sa fiche individuelle et pour sa ligne dans le
   * fichier maître compilant tous les candidats.
   */
  private computeInfoValues(
    bp: any,
    ben: any,
    evs: Evaluation[],
    documents: Document[],
    SECTION_MARKERS: Record<string, string>,
  ): Record<string, any> {
    const user = ben?.user;
    const company = ben?.company;
    const fullName = (u: any) => (u ? `${u.firstName} ${u.lastName}` : '');
    const asDate = (d: any) => (d ? new Date(d) : null);
    const yn = (v: any): string => (v == null ? '' : v ? 'Oui' : 'Non');
    // Les colonnes decimal/numeric Postgres sont renvoyées comme des chaînes
    // par TypeORM/pg — on les convertit pour que numFmt s'applique réellement.
    const toNum = (v: any): number | '' => (v != null && v !== '' ? Number(v) : '');

    const birthDate = asDate(user?.birthDate);
    const age = birthDate
      ? Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : '';

    const cost = toNum(bp?.verifiedTotalProjectCost);
    const funding = toNum(bp?.verifiedFundingAmount);
    const personalContribution = cost !== '' && funding !== '' ? cost - funding : null;

    // Liens directs vers les documents (URL S3) — mêmes documents que la
    // feuille "Documents" et l'archive, mais affichés directement sur la
    // ligne du candidat pour un accès rapide aux pièces les plus utiles à
    // l'évaluation. "Correction" se distingue de "candidature" par
    // formStep='CORRECTION' (seul marqueur fiable, voir documents.service.ts
    // et groupDocumentsForArchive) — pas par les drapeaux du bénéficiaire,
    // qui n'indiquent qu'une intention/autorisation, pas le document lui-même.
    const benDocs = documents.filter((d) => d.entityType === 'beneficiary');
    const planDocsOnly = documents.filter((d) => d.entityType === 'businessPlan');
    const candidatureDocs = benDocs.filter((d) => d.formStep !== 'CORRECTION').slice(0, 3);
    const correctionDoc = benDocs.find((d) => d.formStep === 'CORRECTION');
    const planDoc =
      planDocsOnly.find((d) => (d.documentType?.name ?? '').toLowerCase().includes("plan d'affaires")) ??
      planDocsOnly[0];
    const docName = (doc?: Document): string => doc?.documentType?.name ?? doc?.originalFilename ?? '';
    const docLink = (doc?: Document): any =>
      doc?.filePath?.startsWith('http') ? { text: 'Ouvrir le document', hyperlink: doc.filePath } : '';

    const values: Record<string, any> = {
      nom: fullName(user),
      email: user?.email ?? '',
      telephone: user?.phoneNumber ?? '',
      estRefugieCompte: yn(user?.isRefugee),
      compteCreeLe: asDate(user?.createdAt),
      derniereConnexion: asDate(user?.lastLoginAt),
      sexe: user?.gender?.code === 'M' ? 'Masculin' : user?.gender?.code === 'F' ? 'Féminin' : '',
      dateNaissance: birthDate,
      age,
      statutCategorie: this.mapCategory(ben?.category),
      situationMatrimoniale: this.mapMaritalStatus(ben?.maritalStatus),
      niveauEducation: this.mapEducationLevel(ben?.educationLevel),
      fonction: ben?.position ?? '',
      province: user?.primaryAddress?.commune?.province?.name ?? '',
      commune: user?.primaryAddress?.commune?.name ?? '',
      quartier: user?.primaryAddress?.neighborhood ?? '',
      rue: user?.primaryAddress?.street ?? '',

      estAgentEtat: yn(ben?.isPublicServant),
      procheAgentEtat: yn(ben?.isRelativeOfPublicServant),
      estStagiaireEtat: yn(ben?.isPublicIntern),
      procheStagiaireEtat: yn(ben?.isRelativeOfPublicIntern),
      futHautFonctionnaire: yn(ben?.wasHighOfficer),
      procheHautFonctionnaire: yn(ben?.isRelativeOfHighOfficer),

      codeBeneficiaire: ben?.applicationCode ?? '',
      edition: bp?.copaEdition?.name ?? '',
      dateSoumissionCandidature: asDate(ben?.applicationSubmittedAt),
      doc1Type: docName(candidatureDocs[0]),
      doc1Lien: docLink(candidatureDocs[0]),
      doc2Type: docName(candidatureDocs[1]),
      doc2Lien: docLink(candidatureDocs[1]),
      doc3Type: docName(candidatureDocs[2]),
      doc3Lien: docLink(candidatureDocs[2]),
      documentsCorrigesFlag: yn(ben?.documentsCorrected),
      aSoumisCorrection: yn(ben?.hasSubmitDocumentsCorrected),
      aSoumisCorrectionLe: asDate(correctionDoc?.uploadedAt),
      docCorrectionType: docName(correctionDoc),
      docCorrectionLien: docLink(correctionDoc),

      nomEntreprise: company?.companyName ?? '',
      numEnregistrement: company?.registrationNumber ?? '',
      numRccm: company?.rcNumber ?? '',
      nif: company?.taxIdNumber ?? '',
      numContribuable: company?.taxpayerNumber ?? '',
      typeEntreprise: this.mapCompanyType(company?.companyType),
      statutLegal: this.mapLegalStatus(company?.legalStatus, company?.legalStatusOther),
      secteurActivite: company?.primarySector?.nameFr ?? company?.otherCompanySector ?? '',
      autreSecteur: company?.otherCompanySector ?? '',
      descriptionActivite: company?.activityDescription ?? '',
      dateCreationEntreprise: asDate(company?.creationDate),
      employesPermanents: company?.permanentEmployees ?? '',
      employesTemporaires: company?.temporaryEmployees ?? '',
      employesFemmes: company?.femaleEmployees ?? '',
      employesHommes: company?.maleEmployees ?? '',
      employesJeunes: company?.youngEmployees ?? '',
      employesRefugies: company?.refugeeEmployees ?? '',
      employesBatwa: company?.batwaEmployees ?? '',
      employesHandicapes: company?.disabledEmployees ?? '',
      employesAlbinos: company?.albinosEmployees ?? '',
      employesRapatries: company?.repatriatesEmployees ?? '',
      employesTempsPartiel: company?.partTimeEmployees ?? '',
      employesTotal: company?.totalEmployees ?? '',
      nombreAssocies: company?.associatesCount ?? company?.associatesCountOther ?? '',
      associesFemmes: company?.femalePartners ?? '',
      associesHommes: company?.malePartners ?? '',
      associesRefugies: company?.refugeePartners ?? '',
      associesBatwa: company?.batwaPartners ?? '',
      associesHandicapes: company?.disabledPartners ?? '',
      associesAlbinos: company?.albinosPartners ?? '',
      associesRapatries: company?.repatriatesPartners ?? '',
      caN1: toNum(company?.revenueYearN1),
      compteBancaire: yn(company?.hasBankAccount),
      creditBancaire: yn(company?.hasBankCredit),
      montantCreditBancaire: toNum(company?.bankCreditAmount),
      affilieeCGA: yn(company?.affiliatedToCGA),
      impactClimatiquePositif: yn(company?.hasPositiveClimateImpact),
      serviceAppui: yn(company?.supportService),
      telEntreprise: company?.companyPhone ?? '',
      emailEntreprise: company?.companyEmail ?? '',

      titreProjet: bp?.projectTitle ?? ben?.projectTitle ?? '',
      objectifProjet: ben?.projectObjective ?? '',
      ideeEntreprise: ben?.businessIdea ?? '',
      activitesPrincipales: ben?.mainActivities ?? '',
      produitsServices: ben?.productsServices ?? '',
      clienteleCiblee: ben?.targetClients ?? '',
      aDesConcurrents: yn(ben?.hasCompetitors),
      nomsConcurrents: ben?.competitorNames ?? '',
      ideeTestee: yn(ben?.ideaTested),
      nouvelleIdee: yn(ben?.isNewIdea),
      lienProjetExistant: yn(ben?.hasProjectLink),
      fournisseurDirectProjet: yn(ben?.isDirectSupplierToProject),
      subventionAnterieure: yn(ben?.hasPreviousGrant),
      detailsSubventionAnterieure: ben?.previousGrantDetails ?? '',
      actionsClimatiques: ben?.climateActions ?? '',
      actionsInclusion: ben?.inclusionActions ?? '',
      coutTotalDemande: toNum(ben?.totalProjectCost),
      subventionDemandee: toNum(ben?.requestedSubsidyAmount),
      coutEstime: yn(ben?.hasEstimatedCost),
      depensesPrincipales: ben?.mainExpenses ?? '',
      femmesPrevues: ben?.plannedEmployeesFemale ?? '',
      hommesPrevus: ben?.plannedEmployeesMale ?? '',
      emploisPermanentsPrevus: ben?.plannedPermanentEmployees ?? '',
      emploisRefugiesPrevus: ben?.plannedRefugeeEmployees ?? '',
      emploisBatwaPrevus: ben?.plannedBatwaEmployees ?? '',
      emploisHandicapesPrevus: ben?.plannedDisabledEmployees ?? '',
      emploisAlbinosPrevus: ben?.plannedAlbinosEmployees ?? '',
      emploisRapatriesPrevus: ben?.plannedRepatriatesEmployees ?? '',
      emploisTempsPartielPrevus: ben?.plannedPartTimeEmployees ?? '',

      preselectionneLe: asDate(ben?.preSelectedAt),
      preselectionnePar: fullName(ben?.preSelectedBy),
      commentairePreselection: ben?.preSelectedComment ?? '',

      reference: bp?.referenceNumber ?? '',
      statutPlanAffaires: bp?.status?.nameFr ?? bp?.status?.name ?? '',
      descriptionPlan: bp?.projectDescription ?? '',
      secteurPlan: bp?.businessSector?.nameFr ?? '',
      montantDemandePlan: toNum(bp?.requestedFundingAmount),
      apportPersonnelDeclare: toNum(bp?.personalContributionAmount),
      soumisLe: asDate(bp?.submittedAt),
      soumisPar: fullName(bp?.submittedBy),
      derniereModifLe: asDate(bp?.lastModifiedAt),
      version: bp?.versionNumber ?? '',
      versionFinale: yn(bp?.isFinalVersion),
      coutTotalVerifie: cost,
      subventionTotaleVerifiee: funding,
      investissementVerifie: toNum(bp?.verifiedInvestmentSubsidy),
      exploitationVerifiee: toNum(bp?.verifiedExploitationSubsidy),
      apportPersonnel: personalContribution ?? '',
      evaluateurDonneesFinancieres: fullName(bp?.financialDataEvaluator),
      emploisPrevus: bp?.expectedJobsCount ?? '',
      emploisPrevusFemmes: bp?.expectedWomenJobsCount ?? '',
      docPlanType: docName(planDoc),
      docPlanLien: docLink(planDoc),

      ...SECTION_MARKERS,
    };

    const totals: number[] = [];
    evs.slice(0, MAX_EVALUATORS).forEach((ev, i) => {
      const evaluatorUser = ev.evaluator?.user as any;
      const total = this.calcTotal(ev as any);
      totals.push(total);
      values[`evaluateur${i}Nom`] = fullName(evaluatorUser);
      values[`evaluateur${i}Note`] = Number(total.toFixed(2));
      values[`evaluateur${i}Reco`] = RECOMMENDATION_LABELS[ev.recommendation] ?? ev.recommendation ?? '';
      values[`evaluateur${i}Date`] = asDate(ev.evaluationDate);
    });
    const avgTotal = totals.length > 0 ? totals.reduce((s, t) => s + t, 0) / totals.length : null;
    values.moyenne = avgTotal !== null ? Number(avgTotal.toFixed(2)) : '';
    values.pctMoyen = avgTotal !== null ? Number(((avgTotal / TOTAL_MAX) * 100).toFixed(2)) : '';

    return values;
  }

  /**
   * Applique bordures, formats numériques et mise en évidence (bandeaux de
   * section, liens de documents) à une ligne de données de la feuille
   * "Informations" — partagé entre la fiche individuelle et le fichier
   * maître (une ligne par candidat).
   */
  private styleInfoDataRow(row: ExcelJS.Row, columns: InfoCol[], SECTION_MARKERS: Record<string, string>): void {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = this.THIN_BORDER;
      cell.alignment = { vertical: 'middle' };
    });
    columns.forEach((col) => {
      if (col.numFmt) row.getCell(col.key).numFmt = col.numFmt;
    });
    Object.keys(SECTION_MARKERS).forEach((key) => {
      const cell = row.getCell(key);
      cell.font = { bold: true, color: { argb: 'FF1F4E78' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    });
    ['doc1Lien', 'doc2Lien', 'doc3Lien', 'docCorrectionLien', 'docPlanLien'].forEach((key) => {
      const cell = row.getCell(key);
      if (cell.value) cell.font = { color: { argb: 'FF0563C1' }, underline: true };
    });
  }

  private async buildInfoWorkbook(bp: any, ben: any, evs: Evaluation[], documents: Document[] = []): Promise<Buffer> {
    const { columns, SECTION_MARKERS } = this.buildInfoColumns();
    const values = this.computeInfoValues(bp, ben, evs, documents, SECTION_MARKERS);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Informations', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns;
    this.styleHeaderRow(ws.getRow(1));

    const row = ws.addRow(values);
    this.styleInfoDataRow(row, columns, SECTION_MARKERS);

    this.addDocumentsSheet(wb, documents);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Fichier maître placé à la racine de l'archive : mêmes colonnes que la
   * fiche individuelle, mais une ligne par candidat — pour comparer/filtrer
   * tous les candidats dans un seul classeur.
   */
  private async buildAllCandidatesWorkbook(
    items: { bp: any; ben: any; evs: Evaluation[]; documents: Document[] }[],
  ): Promise<Buffer> {
    const { columns, SECTION_MARKERS } = this.buildInfoColumns();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Informations', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns;
    this.styleHeaderRow(ws.getRow(1));

    for (const { bp, ben, evs, documents } of items) {
      const values = this.computeInfoValues(bp, ben, evs, documents, SECTION_MARKERS);
      const row = ws.addRow(values);
      this.styleInfoDataRow(row, columns, SECTION_MARKERS);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private addDocumentsSheet(wb: ExcelJS.Workbook, documents: Document[]): void {
    const ws = wb.addWorksheet('Documents', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Type de document', key: 'type', width: 28 },
      { header: 'Rattaché à', key: 'rattacheA', width: 16 },
      { header: 'Nom du fichier', key: 'nomFichier', width: 35 },
      { header: 'Téléversé le', key: 'televerseLe', width: 16 },
      { header: 'Téléversé par', key: 'televersePar', width: 22 },
      { header: 'Statut de validation', key: 'statutValidation', width: 18 },
      { header: 'Validé le', key: 'valideLe', width: 16 },
      { header: 'Motif de rejet', key: 'motifRejet', width: 35 },
      { header: 'Lien', key: 'lien', width: 45 },
    ];
    this.styleHeaderRow(ws.getRow(1));

    const fullName = (u: any) => (u ? `${u.firstName} ${u.lastName}` : '');
    documents.forEach((doc) => {
      const row = ws.addRow({
        type: doc.documentType?.name ?? `Type #${doc.documentTypeId}`,
        rattacheA: doc.entityType === 'businessPlan' ? "Plan d'affaires" : 'Bénéficiaire',
        nomFichier: doc.originalFilename ?? '',
        televerseLe: doc.uploadedAt ?? null,
        televersePar: fullName(doc.uploadedBy as any),
        statutValidation: doc.validationStatus ?? '',
        valideLe: doc.validatedAt ?? null,
        motifRejet: doc.rejectionComment ?? '',
      });
      row.getCell('televerseLe').numFmt = 'dd/mm/yyyy hh:mm';
      row.getCell('valideLe').numFmt = 'dd/mm/yyyy hh:mm';
      row.getCell('motifRejet').alignment = { wrapText: true, vertical: 'middle' };
      if (doc.filePath?.startsWith('http')) {
        const lienCell = row.getCell('lien');
        lienCell.value = { text: 'Ouvrir le document', hyperlink: doc.filePath };
        lienCell.font = { color: { argb: 'FF0563C1' }, underline: true };
      }
      row.eachCell({ includeEmpty: true }, (cell) => (cell.border = this.THIN_BORDER));
    });

    if (documents.length === 0) {
      const row = ws.addRow({ type: 'Aucun document trouvé' });
      row.getCell('type').font = { italic: true, color: { argb: 'FF9CA3AF' } };
    }
  }

  /**
   * Reproduit l'export de l'onglet "Évaluation" d'un plan d'affaires
   * (src/app/(hydrogen)/plans-affaires/[id]/evaluations/page.tsx) : la
   * section apparaît comme une ligne de groupe fusionnée au-dessus de ses
   * critères (comme à l'écran) au lieu d'une colonne séparée, et les notes
   * sont colorées selon les mêmes seuils que scoreClass()/totalClass().
   */
  private async buildEvaluationWorkbook(evs: Evaluation[]): Promise<Buffer> {
    const slots: (Evaluation | null)[] = [
      ...evs.slice(0, MAX_EVALUATORS),
      ...Array(MAX_EVALUATORS - Math.min(evs.length, MAX_EVALUATORS)).fill(null),
    ];
    const evalNames = slots.map((ev, i) => {
      const u = ev?.evaluator?.user as any;
      return u ? `${u.firstName} ${u.lastName}` : ev ? `Évaluateur ${i + 1}` : '';
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Évaluation', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'N°', key: 'num', width: 6 },
      { header: 'Critère', key: 'label', width: 60 },
      ...slots.map((_, i) => ({
        header: evalNames[i]
          ? `Note évaluateur ${i + 1}: ${evalNames[i]}`
          : `Note évaluateur ${i + 1}`,
        key: `score${i}`,
        width: 16,
      })),
      { header: 'Moyenne', key: 'avg', width: 12 },
      { header: 'Coefficient', key: 'coef', width: 12 },
      { header: 'Note pondérée', key: 'weighted', width: 14 },
      { header: 'Commentaires', key: 'comments', width: 45 },
    ];
    const colCount = ws.columns.length;
    this.styleHeaderRow(ws.getRow(1));

    let currentSection: string | null = null;
    for (const c of EVALUATION_CRITERIA) {
      if (c.section !== currentSection) {
        currentSection = c.section;
        const sectionRow = ws.addRow({});
        sectionRow.getCell(1).value = c.section;
        this.styleSectionRow(sectionRow, colCount);
        ws.mergeCells(sectionRow.number, 1, sectionRow.number, colCount);
      }

      const scores = slots.map((ev) => (ev !== null ? (ev as any)[c.key] ?? null : null));
      const valid = scores.filter((s): s is number => s != null);
      const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
      const maxW = 5 * c.coefficient;
      const weightedDisplay = avg !== null ? `${(avg * c.coefficient).toFixed(2)}/${maxW}` : '';
      const comments = slots
        .map((ev, i) => {
          const text = (ev?.criteriaComments as any)?.[c.key];
          return text ? `${text} (${evalNames[i]})` : null;
        })
        .filter(Boolean)
        .join(' | ');

      const rowValues: Record<string, any> = {
        num: c.num,
        label: c.label,
        coef: c.coefficient,
        avg: avg !== null ? Number(avg.toFixed(2)) : null,
        weighted: weightedDisplay,
        comments,
      };
      scores.forEach((s, i) => { rowValues[`score${i}`] = s; });

      const row = ws.addRow(rowValues);
      row.getCell('label').alignment = { wrapText: true, vertical: 'middle' };
      row.getCell('comments').alignment = { wrapText: true, vertical: 'middle' };
      ['num', 'coef', 'avg', 'weighted', ...slots.map((_, i) => `score${i}`)].forEach((key) => {
        row.getCell(key).alignment = { horizontal: 'center', vertical: 'middle' };
      });
      row.getCell('avg').numFmt = '0.00';
      row.eachCell({ includeEmpty: true }, (cell) => (cell.border = this.THIN_BORDER));

      scores.forEach((s, i) => this.applyScoreStyle(row.getCell(`score${i}`), s));
      this.applyScoreStyle(row.getCell('avg'), avg !== null ? Math.round(avg) : null);
    }

    const slotTotals = slots
      .filter((ev): ev is Evaluation => ev !== null)
      .map((ev) => this.calcTotal(ev as any));
    const avgTotal = slotTotals.length > 0
      ? slotTotals.reduce((s, t) => s + t, 0) / slotTotals.length
      : null;

    const totalValues: Record<string, any> = {
      label: `Total /${TOTAL_MAX}`,
      avg: avgTotal !== null ? Number(avgTotal.toFixed(2)) : null,
      weighted: avgTotal !== null ? `${avgTotal.toFixed(2)}/${TOTAL_MAX}` : '',
    };
    slots.forEach((ev, i) => { totalValues[`score${i}`] = ev ? this.calcTotal(ev as any) : null; });
    const totalRow = ws.addRow(totalValues);
    totalRow.getCell('avg').numFmt = '0.00';
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.fill = this.TOTAL_FILL;
      cell.border = this.THIN_BORDER;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    totalRow.getCell('label').alignment = { horizontal: 'right', vertical: 'middle' };

    slots.forEach((ev, i) => {
      const t = ev ? this.calcTotal(ev as any) : null;
      if (t !== null) {
        totalRow.getCell(`score${i}`).font = {
          bold: true,
          color: { argb: this.totalFontColor((t / TOTAL_MAX) * 100) },
        };
      }
    });
    if (avgTotal !== null) {
      const totalFont = { bold: true, color: { argb: this.totalFontColor((avgTotal / TOTAL_MAX) * 100) } };
      totalRow.getCell('avg').font = totalFont;
      totalRow.getCell('weighted').font = totalFont;
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
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
