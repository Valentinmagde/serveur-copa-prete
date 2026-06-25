import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, IsNull, Not } from 'typeorm';
import {
    StatsCardsResponseDto,
    SectorDataDto,
    RegionalDataDto,
    GenderCategoryDataDto,
    TrendDataDto,
    StatusDataDto,
    RecentApplicationDto,
} from './dto/dashboard-response.dto';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { User } from '../users/entities/user.entity';
import { BusinessPlan } from '../business-plans/entities/business-plan.entity';
import { BusinessSector } from '../reference/entities/business-sector.entity';
import { Status } from '../reference/entities/status.entity';
import { Province } from '../reference/entities/province.entity';
import { Commune } from '../reference/entities/commune.entity';
import { Gender } from '../reference/entities/gender.entity';
import { Subvention } from '../subventions/entities/subvention.entity';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        @InjectRepository(Beneficiary)
        private beneficiaryRepository: Repository<Beneficiary>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(BusinessPlan)
        private businessPlanRepository: Repository<BusinessPlan>,
        @InjectRepository(BusinessSector)
        private businessSectorRepository: Repository<BusinessSector>,
        @InjectRepository(Status)
        private statusRepository: Repository<Status>,
        @InjectRepository(Province)
        private provinceRepository: Repository<Province>,
        @InjectRepository(Commune)
        private communeRepository: Repository<Commune>,
        @InjectRepository(Gender)
        private genderRepository: Repository<Gender>,
        @InjectRepository(Subvention)
        private subventionRepository: Repository<Subvention>,
    ) { }

    /**
     * Récupère les statistiques des cartes
     */
    async getStatsCards(editionId?: number): Promise<StatsCardsResponseDto> {
        const previousMonthDate = new Date();
        previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
        const editionWhere = editionId ? { copaEditionId: editionId } : {};

        const [
            totalMpme,
            totalCandidatures,
            totalBusinessPlans,
            totalWomen,
            totalRegistratedWomen,
            totalSubventionsAccordees,
            totalSubventionsDecessees,
            totalRejected,
            totalPreselected,
            totalSelected,
            totalRegistered,
        ] = await Promise.all([
            // 1. Total MPME inscrits
            this.beneficiaryRepository.count({ where: editionWhere }),

            // 2. Total candidatures (profils complets)
            this.beneficiaryRepository.count({
                where: { isProfileComplete: true, ...editionWhere },
            }),

            // 3. Total business plans soumis
            this.businessPlanRepository.count({
                where: { submittedAt: MoreThan(new Date(0)), ...editionWhere },
            }),

            // 4. Nombre de femmes candidates
            this.beneficiaryRepository.find({
                where: { isProfileComplete: true, ...editionWhere },
                relations: ['user', 'user.gender'],
            }).then((beneficiaries) =>
                beneficiaries.filter((b) => b?.user?.gender?.code === "F").length,
            ),

            // 5. Nombre de femmes inscrites
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.user', 'user')
                    .innerJoin('user.gender', 'gender')
                    .where('gender.code = :genderCode', { genderCode: 'F' });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // 6. Subventions accordées (nombre)
            this.subventionRepository.count({
                where: { approvalDate: Not(IsNull()), ...editionWhere },
            }),

            // 7. Montant total des subventions décaissées
            (() => {
                const qb = this.subventionRepository
                    .createQueryBuilder('subvention')
                    .select('SUM(subvention.awardedAmount)', 'total')
                    .where('subvention.signatureDate IS NOT NULL');
                if (editionId) qb.andWhere('subvention.copaEditionId = :editionId', { editionId });
                return qb.getRawOne().then(result => Number(result?.total || 0));
            })(),

            // 8. ✅ Nombre de candidatures rejetées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'REJECTED' });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // 9. ✅ Nombre de candidatures présélectionnées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'PRE_SELECTED' });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // 10. ✅ Nombre de candidatures sélectionnées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'SELECTED' });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // 11. Nombre de candidatures enregistrées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'REGISTERED' });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),
        ]);

        // Période précédente
        const [
            previousTotalMpme,
            previousTotalCandidatures,
            previousTotalBusinessPlans,
            previousTotalWomen,
            previousTotalRegistratedWomen,
            previousSubventionsAccordees,
            previousSubventionsDecessees,
            previousTotalRejected,
            previousTotalPreselected,
            previousTotalSelected,
            previousTotalRegistered,
        ] = await Promise.all([
            this.beneficiaryRepository.count({
                where: { createdAt: LessThan(previousMonthDate), ...editionWhere }
            }),
            this.beneficiaryRepository.count({
                where: {
                    isProfileComplete: true,
                    createdAt: LessThan(previousMonthDate),
                    ...editionWhere,
                },
            }),
            this.businessPlanRepository.count({
                where: {
                    submittedAt: LessThan(previousMonthDate),
                    ...editionWhere,
                },
            }),
            this.beneficiaryRepository.find({
                where: { isProfileComplete: true, ...editionWhere },
                relations: ['user', 'user.gender'],
            }).then((beneficiaries) =>
                beneficiaries.filter((b) => b?.user?.gender?.code === "F").length,
            ),
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.user', 'user')
                    .innerJoin('user.gender', 'gender')
                    .where('gender.code = :genderCode', { genderCode: 'F' })
                    .andWhere('beneficiary.createdAt < :previousMonthDate', { previousMonthDate });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),
            this.subventionRepository.count({
                where: {
                    approvalDate: LessThan(previousMonthDate),
                    ...editionWhere,
                },
            }),
            (() => {
                const qb = this.subventionRepository
                    .createQueryBuilder('subvention')
                    .select('SUM(subvention.awardedAmount)', 'total')
                    .where('subvention.signatureDate < :previousMonthDate', { previousMonthDate });
                if (editionId) qb.andWhere('subvention.copaEditionId = :editionId', { editionId });
                return qb.getRawOne().then(result => Number(result?.total || 0));
            })(),

            // ✅ Période précédente - Rejetées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'REJECTED' })
                    .andWhere('beneficiary.createdAt < :previousMonthDate', { previousMonthDate });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // ✅ Période précédente - Présélectionnées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'PRE_SELECTED' })
                    .andWhere('beneficiary.createdAt < :previousMonthDate', { previousMonthDate });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // ✅ Période précédente - Sélectionnées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'SELECTED' })
                    .andWhere('beneficiary.createdAt < :previousMonthDate', { previousMonthDate });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),

            // Période précédente - Enregistrées
            (() => {
                const qb = this.beneficiaryRepository
                    .createQueryBuilder('beneficiary')
                    .innerJoin('beneficiary.status', 'status')
                    .where('beneficiary.isProfileComplete = :isComplete', { isComplete: true })
                    .andWhere('status.code = :statusCode', { statusCode: 'REGISTERED' })
                    .andWhere('beneficiary.createdAt < :previousMonthDate', { previousMonthDate });
                if (editionId) qb.andWhere('beneficiary.copaEditionId = :editionId', { editionId });
                return qb.getCount();
            })(),
        ]);

        const emploisCrees = 0;
        const previousEmploisCrees = 0;

        const calculateVariation = (current: number, previous: number): number => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Number(((current - previous) / previous * 100).toFixed(1));
        };

        return {
            totalMpme,
            totalCandidatures,
            totalBusinessPlans,
            totalWomen,
            totalRegistratedWomen,
            totalSubventionsAccordees,
            totalSubventionsDecessees,
            emploisCrees,
            totalRejected,
            totalPreselected,
            totalSelected,
            totalRegistered,
            previousPeriod: {
                totalMpme: previousTotalMpme,
                totalCandidatures: previousTotalCandidatures,
                totalBusinessPlans: previousTotalBusinessPlans,
                totalWomen: previousTotalWomen,
                totalRegistratedWomen: previousTotalRegistratedWomen,
                totalSubventionsAccordees: previousSubventionsAccordees,
                totalSubventionsDecessees: previousSubventionsDecessees,
                emploisCrees: previousEmploisCrees,
                totalRejected: previousTotalRejected,
                totalPreselected: previousTotalPreselected,
                totalSelected: previousTotalSelected,
                totalRegistered: previousTotalRegistered,
            },
            variations: {
                totalMpme: calculateVariation(totalMpme, previousTotalMpme),
                totalCandidatures: calculateVariation(totalCandidatures, previousTotalCandidatures),
                totalBusinessPlans: calculateVariation(totalBusinessPlans, previousTotalBusinessPlans),
                totalWomen: calculateVariation(totalWomen, previousTotalWomen),
                totalRegistratedWomen: calculateVariation(totalRegistratedWomen, previousTotalRegistratedWomen),
                totalSubventionsAccordees: calculateVariation(totalSubventionsAccordees, previousSubventionsAccordees),
                totalSubventionsDecessees: calculateVariation(totalSubventionsDecessees, previousSubventionsDecessees),
                emploisCrees: calculateVariation(emploisCrees, previousEmploisCrees),
                totalRejected: calculateVariation(totalRejected, previousTotalRejected),
                totalPreselected: calculateVariation(totalPreselected, previousTotalPreselected),
                totalSelected: calculateVariation(totalSelected, previousTotalSelected),
                totalRegistered: calculateVariation(totalRegistered, previousTotalRegistered),
            },
        };
    }

    /**
     * Récupère les candidatures par secteur
     */
    async getCandidatesBySector(editionId?: number): Promise<SectorDataDto[]> {
        const beneficiaries = await this.beneficiaryRepository.find({
            where: { isProfileComplete: true, ...(editionId ? { copaEditionId: editionId } : {}) },
            relations: [
                'user',
                'user.gender',
                'businessPlans',
                'businessPlans.businessSector',
                'company',
                'company.primarySector'
            ],
        });

        const sectorMap = new Map<string, SectorDataDto>();

        for (const beneficiary of beneficiaries) {
            const sector = beneficiary?.company?.primarySector?.nameFr;

            if (!sectorMap.has(sector)) {
                sectorMap.set(sector, {
                    sector,
                    total: 0,
                    women: 0,
                    men: 0,
                    refugees: 0,
                });
            }

            const data = sectorMap.get(sector)!;
            data.total++;

            if (beneficiary?.user?.gender?.code === 'F') {
                data.women++;
            } else if (beneficiary?.user?.gender?.code === 'M') {
                data.men++;
            }

            if (beneficiary?.user?.isRefugee) {
                data.refugees++;
            }
        }

        return Array.from(sectorMap.values()).sort((a, b) => b.total - a.total);
    }

    /**
     * Récupère les inscriptions par région (Burundi)
     */
    async getRegionalInscriptions(editionId?: number): Promise<RegionalDataDto[]> {
        // Récupérer tous les utilisateurs avec leurs adresses et bénéficiaires
        const users = await this.userRepository.find({
            relations: [
                'primaryAddress',
                'primaryAddress.commune',
                'primaryAddress.commune.province',
                'beneficiary',
            ],
            where: {
                beneficiary: {
                    isProfileComplete: true,
                    ...(editionId ? { copaEditionId: editionId } : {}),
                },
            },
        });

        const provinceMap = new Map<string, Map<string, number>>();

        for (const user of users) {
            const address = user.primaryAddress;
            if (!address) continue;

            const commune = address.commune;
            if (!commune) continue;

            const province = commune.province;
            if (!province) continue;

            if (!provinceMap.has(province.name)) {
                provinceMap.set(province.name, new Map());
            }

            const communeMap = provinceMap.get(province.name)!;
            communeMap.set(commune.name, (communeMap.get(commune.name) || 0) + 1);
        }

        const result: RegionalDataDto[] = [];

        for (const [provinceName, communeMap] of provinceMap.entries()) {
            const communes: { name: string; inscriptions: number }[] = [];
            let totalInscriptions = 0;

            for (const [communeName, inscriptions] of communeMap.entries()) {
                communes.push({ name: communeName, inscriptions });
                totalInscriptions += inscriptions;
            }

            result.push({
                province: provinceName,
                inscriptions: totalInscriptions,
                communes: communes.sort((a, b) => b.inscriptions - a.inscriptions),
            });
        }

        return result.sort((a, b) => b.inscriptions - a.inscriptions);
    }

    /**
     * Récupère l'analyse par genre et catégorie
     */
    async getGenderCategoryAnalysis(editionId?: number): Promise<GenderCategoryDataDto> {
        const beneficiaries = await this.beneficiaryRepository.find({
            where: { isProfileComplete: true, ...(editionId ? { copaEditionId: editionId } : {}) },
            relations: ['user', 'user.gender'],
        });

        // Analyse par genre
        const genderCount: { [key: string]: number } = {
            Femmes: 0,
            Hommes: 0,
        };

        for (const beneficiary of beneficiaries) {
            if (beneficiary.user?.gender?.code === 'F') {
                genderCount.Femmes++;
            } else if (beneficiary.user?.gender?.code === 'M') {
                genderCount.Hommes++;
            }
        }

        const total = beneficiaries.length;
        const genderData = Object.entries(genderCount).map(([gender, count]) => ({
            gender,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
        }));

        // Analyse par catégorie (réfugié vs burundais)
        const categoryCount = {
            Burundais: 0,
            Réfugiés: 0,
        };

        for (const beneficiary of beneficiaries) {
            if (beneficiary.user?.isRefugee) {
                categoryCount.Réfugiés++;
            } else {
                categoryCount.Burundais++;
            }
        }

        const categoryData = Object.entries(categoryCount).map(([category, count]) => ({
            category,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
        }));

        return { genderData, categoryData };
    }

    /**
     * Récupère l'évolution des inscriptions
     */
    async getRegistrationTrend(months: number = 12, editionId?: number): Promise<TrendDataDto[]> {
        const currentDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const editionWhere = editionId ? { copaEditionId: editionId } : {};

        const beneficiaries = await this.beneficiaryRepository.find({
            where: {
                createdAt: Between(startDate, currentDate),
                ...editionWhere,
            },
            relations: ['businessPlans'],
        });

        const businessPlans = await this.businessPlanRepository.find({
            where: {
                submittedAt: Between(startDate, currentDate),
                ...editionWhere,
            },
        });

        // Grouper par mois
        const monthlyData = new Map<string, TrendDataDto>();

        for (let i = 0; i <= months; i++) {
            const date = new Date(startDate);
            date.setMonth(startDate.getMonth() + i);
            const monthKey = date.toLocaleString('fr-FR', { month: 'short' });

            monthlyData.set(monthKey, {
                month: monthKey,
                registrations: 0,
                completed: 0,
                submitted: 0,
            });
        }

        // Compter les inscriptions
        for (const beneficiary of beneficiaries) {
            const monthKey = beneficiary.createdAt.toLocaleString('fr-FR', { month: 'short' });
            const data = monthlyData.get(monthKey);
            if (data) {
                data.registrations++;
                if (beneficiary.isProfileComplete) {
                    data.completed++;
                }
            }
        }

        // Compter les plans soumis
        for (const plan of businessPlans) {
            const monthKey = plan.submittedAt.toLocaleString('fr-FR', { month: 'short' });
            const data = monthlyData.get(monthKey);
            if (data) {
                data.submitted++;
            }
        }

        return Array.from(monthlyData.values());
    }

    /**
     * Récupère le pipeline par statut
     */
    async getStatusPipeline(editionId?: number): Promise<StatusDataDto[]> {
        const statuses = await this.statusRepository.find({
            where: { entityType: 'BENEFICIARY', isActive: true },
            order: { displayOrder: 'ASC' },
        });

        const beneficiaries = await this.beneficiaryRepository.find({
            where: { isProfileComplete: true, ...(editionId ? { copaEditionId: editionId } : {}) },
            relations: ['status'],
        });

        const total = beneficiaries.length;
        const statusMap = new Map<string, number>();

        for (const beneficiary of beneficiaries) {
            const statusName = beneficiary.status?.name || 'En attente';
            statusMap.set(statusName, (statusMap.get(statusName) || 0) + 1);
        }

        const statusColors: { [key: string]: string } = {
            'En attente': '#94a3b8',
            'En cours de validation': '#f59e0b',
            'Présélectionné': '#3b82f6',
            'Validé': '#10b981',
            'Rejeté': '#ef4444',
            'En évaluation': '#8b5cf6',
            'Inscrit': '#64748b',
        };

        const result: StatusDataDto[] = [];

        for (const status of statuses) {
            const count = statusMap.get(status.name) || 0;
            if (count > 0) {
                result.push({
                    status: status.name,
                    count,
                    percentage: total > 0 ? (count / total) * 100 : 0,
                    color: statusColors[status.name] || '#94a3b8',
                });
            }
        }

        // Ajouter les statuts qui n'ont pas de correspondance dans statuses
        for (const [statusName, count] of statusMap.entries()) {
            if (!result.find((r) => r.status === statusName)) {
                result.push({
                    status: statusName,
                    count,
                    percentage: total > 0 ? (count / total) * 100 : 0,
                    color: statusColors[statusName] || '#94a3b8',
                });
            }
        }

        return result.sort((a, b) => b.count - a.count);
    }

    async getCompanyStatusAnalysis(editionId?: number): Promise<Array<{ status: string; count: number; percentage: number }>> {
        const total = await this.beneficiaryRepository.count({
            where: { companyType: Not(IsNull()), ...(editionId ? { copaEditionId: editionId } : {}) }
        });

        const statsQb = this.beneficiaryRepository
            .createQueryBuilder('b')
            .select('b.companyType', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('b.companyType IS NOT NULL and b.isProfileComplete = true')
            .groupBy('b.companyType');
        if (editionId) statsQb.andWhere('b.copaEditionId = :editionId', { editionId });
        const stats = await statsQb.getRawMany();

        return stats.map(item => ({
            status: item.status,
            count: parseInt(item.count),
            percentage: total > 0 ? (parseInt(item.count) / total) * 100 : 0,
        }));
    }

    /**
     * Récupère les dernières candidatures
     */
    async getRecentApplications(limit: number = 21, editionId?: number): Promise<RecentApplicationDto[]> {
        const beneficiaries = await this.beneficiaryRepository.find({
            where: { isProfileComplete: true, ...(editionId ? { copaEditionId: editionId } : {}) },
            relations: ['user', 'company', 'company.primarySector', 'status'],
            order: { updatedAt: 'DESC', createdAt: 'DESC' },
            take: limit,
        });

        const statusColors: { [key: string]: string } = {
            'En attente': 'warning',
            'En cours de validation': 'info',
            'Présélectionné': 'success',
            'Validé': 'success',
            'Rejeté': 'danger',
            'En évaluation': 'primary',
            'Inscrit': 'default',
        };

        return beneficiaries.map((beneficiary) => ({
            id: beneficiary.id,
            applicationCode: beneficiary.applicationCode || `COPA-${beneficiary.id.toString().padStart(4, '0')}`,
            firstName: beneficiary.user?.firstName || '',
            lastName: beneficiary.user?.lastName || '',
            email: beneficiary.user?.email || '',
            registrationDate: beneficiary.createdAt,
            submissionDate: beneficiary.updatedAt || null,
            sector: beneficiary.company?.primarySector?.nameFr || null,
            status: beneficiary.status?.name || 'Inscrit',
            statusColor: statusColors[beneficiary.status?.name || 'Inscrit'] || 'default',
        }));
    }

    // dashboard.service.ts
    async getRegistrationTrendByPeriod(period: string = 'month', editionId?: number): Promise<any[]> {
        // Inscriptions totales
        const registrations = await this.getRegistrationsByPeriod(period, editionId);

        // Profils complets
        const completed = await this.getCompletedProfilesByPeriod(period, editionId);

        // Soumis
        const submitted = await this.getSubmittedBeneficiariesByPeriod(period, editionId);

        // Fusionner les résultats
        const datesMap = new Map();

        registrations.forEach(r => {
            const dateBrute = new Date(r.date);
            const label = this.formatDateLabel(dateBrute, period);
            datesMap.set(label, {
                label,
                dateTri: dateBrute.getTime(),
                registrations: parseInt(r.count),
                completed: 0,
                submitted: 0
            });
        });

        completed.forEach(c => {
            const dateBrute = new Date(c.date);
            const label = this.formatDateLabel(dateBrute, period);
            if (datesMap.has(label)) {
                datesMap.get(label).completed = parseInt(c.count);
            } else {
                datesMap.set(label, {
                    label,
                    dateTri: dateBrute.getTime(),
                    registrations: 0,
                    completed: parseInt(c.count),
                    submitted: 0
                });
            }
        });

        submitted.forEach(s => {
            const dateBrute = new Date(s.date);
            const label = this.formatDateLabel(dateBrute, period);
            if (datesMap.has(label)) {
                datesMap.get(label).submitted = parseInt(s.count);
            } else {
                datesMap.set(label, {
                    label,
                    dateTri: dateBrute.getTime(),
                    registrations: 0,
                    completed: 0,
                    submitted: parseInt(s.count)
                });
            }
        });

        // Trier et filtrer les zéros
        let result = Array.from(datesMap.values())
            .sort((a, b) => a.dateTri - b.dateTri)
            .map(({ label, registrations, completed, submitted }) => ({
                label,
                registrations,
                completed,
                submitted
            }));

        // ✅ Filtrer les entrées où toutes les valeurs sont à 0
        result = result.filter(item =>
            item.registrations > 0 || item.completed > 0 || item.submitted > 0
        );

        return result;
    }

    private async getRegistrationsByPeriod(period: string, editionId?: number): Promise<any[]> {
        const groupBy = this.getGroupByExpression(period, 'b.created_at');
        const qb = this.beneficiaryRepository
            .createQueryBuilder('b')
            .select(`${groupBy} as date`)
            .addSelect('COUNT(*)', 'count')
            .groupBy(groupBy)
            .orderBy('date', 'ASC');
        if (editionId) qb.andWhere('b.copa_edition_id = :editionId', { editionId });
        return qb.getRawMany();
    }

    private async getCompletedProfilesByPeriod(period: string, editionId?: number): Promise<any[]> {
        const groupBy = this.getGroupByExpression(period, 'b.profile_completed_at');
        const qb = this.beneficiaryRepository
            .createQueryBuilder('b')
            .select(`${groupBy} as date`)
            .addSelect('COUNT(*)', 'count')
            .where('b.profile_completion_percentage = :complete', { complete: 100 })
            .groupBy(groupBy)
            .orderBy('date', 'ASC');
        if (editionId) qb.andWhere('b.copa_edition_id = :editionId', { editionId });
        return qb.getRawMany();
    }

    private async getSubmittedBeneficiariesByPeriod(period: string, editionId?: number): Promise<any[]> {
        const groupBy = this.getGroupByExpression(period, 'b.updated_at');
        const qb = this.beneficiaryRepository
            .createQueryBuilder('b')
            .select(`${groupBy} as date`)
            .addSelect('COUNT(*)', 'count')
            .where('b.is_profile_complete = :complete', { complete: true })
            .groupBy(groupBy)
            .orderBy('date', 'ASC');
        if (editionId) qb.andWhere('b.copa_edition_id = :editionId', { editionId });
        return qb.getRawMany();
    }

    private getGroupByExpression(period: string, column: string): string {
        switch (period) {
            case 'day':
                // Grouper par jour de semaine (1-7)
                return `EXTRACT(DOW FROM ${column})`;
            case 'month':
            default:
                return `DATE_TRUNC('month', ${column})`;
        }
    }

    private formatDateLabel(date: Date, period: string): string {
        const d = new Date(date);
        switch (period) {
            case 'day':
                const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
                // Ajuster l'index car getDay() retourne 0 pour dimanche
                let index = d.getDay();
                if (index === 0) index = 7;
                return jours[index - 1];
            case 'month':
            default:
                return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        }
    }

    /**
     * Récupère toutes les données du dashboard en une seule requête
     */
    async getFullDashboardData(editionId?: number) {
        const [
            statsCards,
            candidatesBySector,
            regionalInscriptions,
            genderCategoryAnalysis,
            registrationTrend,
            statusPipeline,
            recentApplications,
        ] = await Promise.all([
            this.getStatsCards(editionId),
            this.getCandidatesBySector(editionId),
            this.getRegionalInscriptions(editionId),
            this.getGenderCategoryAnalysis(editionId),
            this.getRegistrationTrend(12, editionId),
            this.getStatusPipeline(editionId),
            this.getRecentApplications(21, editionId),
        ]);

        return {
            statsCards,
            candidatesBySector,
            regionalInscriptions,
            genderCategoryAnalysis,
            registrationTrend,
            statusPipeline,
            recentApplications,
        };
    }
}