import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, MoreThan, Repository } from 'typeorm';
import { CopaEdition } from './entities/copa-edition.entity';
import { CopaPhase, PhaseCode } from './entities/copa-phase.entity';

@Injectable()
export class CopaEditionsService {
  constructor(
    @InjectRepository(CopaEdition)
    private readonly copaEditionRepository: Repository<CopaEdition>,
    @InjectRepository(CopaPhase)
    private readonly copaPhaseRepository: Repository<CopaPhase>,
  ) {}
  async findAll(): Promise<any[]> {
    const editions = await this.copaEditionRepository
      .createQueryBuilder('edition')
      .leftJoin('beneficiaries', 'b', 'b.copa_edition_id = edition.id')
      .addSelect('COUNT(b.id)', 'participantCount')
      .groupBy('edition.id')
      .orderBy('edition.year', 'DESC')
      .getRawMany();

    // Transformer les résultats
    return editions.map((edition) => ({
      id: edition.edition_id,
      code: edition.edition_code,
      name: edition.edition_name,
      nameFr: edition.edition_name_fr,
      nameRn: edition.edition_name_rn,
      year: edition.edition_year,
      registrationStartDate: edition.edition_registration_start_date,
      registrationEndDate: edition.edition_registration_end_date,
      submissionStartDate: edition.edition_submission_start_date,
      submissionEndDate: edition.edition_submission_end_date,
      evaluationStartDate: edition.edition_evaluation_start_date,
      evaluationEndDate: edition.edition_evaluation_end_date,
      selectionCommitteeDate: edition.edition_selection_committee_date,
      resultsPublicationDate: edition.edition_results_publication_date,
      totalBudget: edition.edition_total_budget,
      expectedWinnersCount: edition.edition_expected_winners_count,
      regulationsUrl: edition.edition_regulations_url,
      isActive: edition.edition_is_active,
      createdAt: edition.edition_created_at,
      updatedAt: edition.edition_updated_at,
      participantCount: parseInt(edition.participantCount) || 0,
    }));
  }

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

  async findByCode(code: string): Promise<CopaEdition> {
    const edition = await this.copaEditionRepository.findOne({
      where: { code },
    });
    if (!edition) {
      throw new NotFoundException(
        `Édition COPA avec le code ${code} non trouvée`,
      );
    }
    return edition;
  }

  async findPastEditions(): Promise<any[]> {
    const all = await this.findAll();
    return all.filter((e) => !e.isActive);
  }

  async findByYear(year: number): Promise<CopaEdition[]> {
    return this.copaEditionRepository.find({
      where: { year },
      order: { createdAt: 'DESC' },
    });
  }

  async findByYearRange(
    startYear: number,
    endYear: number,
  ): Promise<CopaEdition[]> {
    return this.copaEditionRepository.find({
      where: { year: Between(startYear, endYear) },
      order: { year: 'DESC' },
    });
  }

  async create(data: Partial<CopaEdition>): Promise<CopaEdition> {
    if (data.code) {
      const existing = await this.copaEditionRepository.findOne({
        where: { code: data.code },
      });
      if (existing) {
        throw new ConflictException(
          `Une édition avec le code ${data.code} existe déjà`,
        );
      }
    }

    // Une même année peut avoir plusieurs éditions (ex: plusieurs cohortes
    // dans l'année) — seul le code doit être unique.
    const edition = this.copaEditionRepository.create(data);
    const saved = await this.copaEditionRepository.save(edition);
    await this.createDefaultPhases(saved);
    return saved;
  }

  /**
   * Calcule les 8 phases standard d'une édition. REGISTRATION et
   * BUSINESS_PLAN_SUBMISSION reprennent les dates saisies sur l'édition ; les
   * autres sont enchaînées à la suite (mêmes durées relatives que la cohorte
   * de référence COPA-2026-FIRST-ROUND) et doivent être ajustées par l'admin
   * via "Modifier les dates" sur la page de détail.
   */
  private buildPhaseTemplate(edition: CopaEdition) {
    const addDays = (date: Date | string, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };

    const registrationEnd = new Date(edition.registrationEndDate);
    const submissionEnd = new Date(edition.submissionEndDate);

    const candidatureStart = addDays(registrationEnd, 1);
    const candidatureEnd = addDays(candidatureStart, 8);

    const evaluationStart = addDays(submissionEnd, 2);
    const evaluationEnd = addDays(evaluationStart, 44);

    const selectionStart = addDays(evaluationEnd, 1);
    const selectionEnd = addDays(selectionStart, 14);

    const awardingStart = addDays(selectionEnd, 1);
    const awardingEnd = addDays(awardingStart, 89);

    return [
      {
        code: PhaseCode.REGISTRATION,
        name: 'Registration',
        nameFr: 'Inscription',
        start: new Date(edition.registrationStartDate),
        end: registrationEnd,
        displayOrder: 1,
      },
      {
        code: PhaseCode.CANDIDATURE_SUBMISSION,
        name: 'Candidature Submission',
        nameFr: 'Soumission de candidature',
        start: candidatureStart,
        end: candidatureEnd,
        displayOrder: 2,
      },
      {
        code: PhaseCode.BUSINESS_PLAN_SUBMISSION,
        name: 'Business Plan Submission',
        nameFr: "Soumission du plan d'affaires",
        start: new Date(edition.submissionStartDate),
        end: submissionEnd,
        displayOrder: 3,
      },
      {
        code: PhaseCode.EVALUATION,
        name: 'Evaluation',
        nameFr: 'Évaluation',
        start: evaluationStart,
        end: evaluationEnd,
        displayOrder: 4,
      },
      {
        code: PhaseCode.SELECTION,
        name: 'Selection',
        nameFr: 'Sélection',
        start: selectionStart,
        end: selectionEnd,
        displayOrder: 5,
      },
      {
        code: PhaseCode.AWARDING,
        name: 'Awarding',
        nameFr: 'Attribution',
        start: awardingStart,
        end: awardingEnd,
        displayOrder: 6,
      },
      {
        code: PhaseCode.MENTORING,
        name: 'Mentoring',
        nameFr: 'Accompagnement',
        start: awardingStart,
        end: addDays(awardingStart, 364),
        displayOrder: 7,
      },
      {
        code: PhaseCode.MONITORING,
        name: 'Monitoring',
        nameFr: 'Suivi',
        start: awardingStart,
        end: addDays(awardingStart, 499),
        displayOrder: 8,
      },
    ];
  }

  private async createDefaultPhases(edition: CopaEdition): Promise<void> {
    const template = this.buildPhaseTemplate(edition);
    const phases = template.map((t) =>
      this.copaPhaseRepository.create({
        copaEditionId: edition.id,
        phaseCode: t.code,
        phaseName: t.name,
        phaseNameFr: t.nameFr,
        startDate: t.start,
        endDate: t.end,
        isActive: false,
        displayOrder: t.displayOrder,
      }),
    );
    await this.copaPhaseRepository.save(phases);
  }

  /**
   * Ajoute les phases standard absentes d'une édition (sans toucher à celles
   * qui existent déjà). Permet de rattraper une édition créée avant l'ajout
   * de la génération automatique, ou une phase supprimée par erreur.
   */
  async completeMissingPhases(editionId: number): Promise<CopaPhase[]> {
    const edition = await this.findById(editionId);
    const existing = await this.copaPhaseRepository.find({
      where: { copaEditionId: editionId },
    });
    const existingCodes = new Set(existing.map((p) => p.phaseCode));

    const missing = this.buildPhaseTemplate(edition).filter(
      (t) => !existingCodes.has(t.code),
    );

    if (missing.length) {
      const phases = missing.map((t) =>
        this.copaPhaseRepository.create({
          copaEditionId: edition.id,
          phaseCode: t.code,
          phaseName: t.name,
          phaseNameFr: t.nameFr,
          startDate: t.start,
          endDate: t.end,
          isActive: false,
          displayOrder: t.displayOrder,
        }),
      );
      await this.copaPhaseRepository.save(phases);
    }

    return this.copaPhaseRepository.find({
      where: { copaEditionId: editionId },
      order: { displayOrder: 'ASC' },
    });
  }

  async update(id: number, data: Partial<CopaEdition>): Promise<CopaEdition> {
    const edition = await this.findById(id);

    // Vérifier si le nouveau code n'est pas déjà utilisé par une autre édition
    if (data.code && data.code !== edition.code) {
      const existing = await this.copaEditionRepository.findOne({
        where: { code: data.code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Une édition avec le code ${data.code} existe déjà`,
        );
      }
    }

    Object.assign(edition, data);
    return this.copaEditionRepository.save(edition);
  }

  async delete(id: number): Promise<void> {
    const edition = await this.findById(id);
    await this.copaPhaseRepository.delete({ copaEditionId: id });
    await this.copaEditionRepository.remove(edition);
  }

  async softDelete(id: number): Promise<CopaEdition> {
    const edition = await this.findById(id);
    edition.isActive = false;
    return this.copaEditionRepository.save(edition);
  }

  // ==================== GESTION DU STATUT ====================

  async activate(id: number): Promise<CopaEdition> {
    // Plusieurs éditions peuvent être actives simultanément (ex: une cohorte
    // encore en évaluation pendant que la suivante ouvre ses inscriptions).
    // L'exclusivité se gère au niveau des phases (cf. ReferenceService.togglePhase).
    const edition = await this.findById(id);
    edition.isActive = true;
    return this.copaEditionRepository.save(edition);
  }

  async deactivate(id: number): Promise<CopaEdition> {
    const edition = await this.findById(id);
    edition.isActive = false;
    return this.copaEditionRepository.save(edition);
  }

  // ==================== VALIDATIONS DES DATES ====================

  async isRegistrationOpen(editionId?: number): Promise<boolean> {
    let edition: CopaEdition | null = null;

    if (editionId) {
      edition = await this.findById(editionId);
    } else {
      edition = await this.findCurrent();
    }

    if (!edition) return false;

    const now = new Date();
    const start = new Date(edition.registrationStartDate);
    const end = new Date(edition.registrationEndDate);

    return now >= start && now <= end;
  }

  async isSubmissionOpen(editionId?: number): Promise<boolean> {
    let edition: CopaEdition | null = null;

    if (editionId) {
      edition = await this.findById(editionId);
    } else {
      edition = await this.findCurrent();
    }

    if (!edition) return false;

    const now = new Date();
    const start = new Date(edition.submissionStartDate);
    const end = new Date(edition.submissionEndDate);

    return now >= start && now <= end;
  }

  async findOpenForRegistration(): Promise<CopaEdition[]> {
    const now = new Date();
    return this.copaEditionRepository.find({
      where: {
        isActive: true,
        registrationStartDate: LessThan(now),
        registrationEndDate: MoreThan(now),
      },
      order: { year: 'DESC' },
    });
  }

  // ==================== STATISTIQUES ====================

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    years: number[];
    currentYear?: number;
  }> {
    const all = await this.findAll();
    const active = all.filter((e) => e.isActive);

    return {
      total: all.length,
      active: active.length,
      inactive: all.length - active.length,
      years: [...new Set(all.map((e) => e.year))].sort((a, b) => b - a),
      currentYear: active[0]?.year,
    };
  }

  // ==================== DUPLICATION ====================

  async duplicate(id: number, newYear: number): Promise<CopaEdition> {
    const source = await this.findById(id);

    const newEdition = this.copaEditionRepository.create({
      code: `${newYear}`,
      name: `COPA ${newYear}`,
      nameFr: `COPA ${newYear}`,
      nameRn: `COPA ${newYear}`,
      year: newYear,
      registrationStartDate: source.registrationStartDate,
      registrationEndDate: source.registrationEndDate,
      submissionStartDate: source.submissionStartDate,
      submissionEndDate: source.submissionEndDate,
      evaluationStartDate: source.evaluationStartDate,
      evaluationEndDate: source.evaluationEndDate,
      selectionCommitteeDate: source.selectionCommitteeDate,
      resultsPublicationDate: source.resultsPublicationDate,
      totalBudget: source.totalBudget,
      expectedWinnersCount: source.expectedWinnersCount,
      regulationsUrl: source.regulationsUrl,
      isActive: false,
    });

    return this.copaEditionRepository.save(newEdition);
  }

  // ==================== VALIDATION ====================

  /**
   * Valide les dates d'une édition
   */
  validateDates(edition: Partial<CopaEdition>): void {
    if (edition.registrationStartDate && edition.registrationEndDate) {
      if (
        new Date(edition.registrationStartDate) >=
        new Date(edition.registrationEndDate)
      ) {
        throw new BadRequestException(
          `La date de début d'inscription doit être antérieure à la date de fin`,
        );
      }
    }

    if (edition.submissionStartDate && edition.submissionEndDate) {
      if (
        new Date(edition.submissionStartDate) >=
        new Date(edition.submissionEndDate)
      ) {
        throw new BadRequestException(
          `La date de début de soumission doit être antérieure à la date de fin`,
        );
      }
    }

    if (edition.evaluationStartDate && edition.evaluationEndDate) {
      if (
        new Date(edition.evaluationStartDate) >=
        new Date(edition.evaluationEndDate)
      ) {
        throw new BadRequestException(
          `La date de début d'évaluation doit être antérieure à la date de fin`
        );
      }
    }
  }
}
