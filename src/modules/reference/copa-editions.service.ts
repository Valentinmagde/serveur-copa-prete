import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, MoreThan, Repository } from 'typeorm';
import { CopaEdition } from './entities/copa-edition.entity';

@Injectable()
export class CopaEditionsService {
  constructor(
    @InjectRepository(CopaEdition)
    private readonly copaEditionRepository: Repository<CopaEdition>,
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

    if (data.year) {
      const existingYear = await this.copaEditionRepository.findOne({
        where: { year: data.year },
      });
      if (existingYear) {
        throw new ConflictException(
          `Une édition pour l'année ${data.year} existe déjà`,
        );
      }
    }

    const edition = this.copaEditionRepository.create(data);
    return this.copaEditionRepository.save(edition);
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

    // Vérifier si la nouvelle année n'est pas déjà utilisée par une autre édition
    if (data.year && data.year !== edition.year) {
      const existingYear = await this.copaEditionRepository.findOne({
        where: { year: data.year },
      });
      if (existingYear && existingYear.id !== id) {
        throw new ConflictException(
          `Une édition pour l'année ${data.year} existe déjà`,
        );
      }
    }

    Object.assign(edition, data);
    return this.copaEditionRepository.save(edition);
  }

  async delete(id: number): Promise<void> {
    const edition = await this.findById(id);
    await this.copaEditionRepository.remove(edition);
  }

  async softDelete(id: number): Promise<CopaEdition> {
    const edition = await this.findById(id);
    edition.isActive = false;
    return this.copaEditionRepository.save(edition);
  }

  // ==================== GESTION DU STATUT ====================

  async activate(id: number): Promise<CopaEdition> {
    // Désactiver toutes les éditions
    await this.copaEditionRepository.update({}, { isActive: false });

    // Activer l'édition choisie
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

    const existing = await this.copaEditionRepository.findOne({
      where: { year: newYear },
    });
    if (existing) {
      throw new ConflictException(
        `Une édition pour l'année ${newYear} existe déjà`,
      );
    }

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
