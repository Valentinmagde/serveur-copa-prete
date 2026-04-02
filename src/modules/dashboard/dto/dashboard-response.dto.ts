import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviousPeriodDto {
    @ApiProperty({ description: 'Total MPME de la période précédente', example: 850 })
    totalMpme: number;

    @ApiProperty({ description: 'Total candidatures de la période précédente', example: 650 })
    totalCandidatures: number;

    @ApiProperty({ description: 'Total plans d\'affaires de la période précédente', example: 350 })
    totalBusinessPlans: number;

    @ApiProperty({ description: 'Total femmes de la période précédente', example: 380 })
    totalWomen: number;
}

export class StatsCardsResponseDto {
    @ApiProperty({ description: 'Nombre total de MPME inscrites', example: 1234 })
    totalMpme: number;

    @ApiProperty({ description: 'Nombre de candidatures complètes (profil à 100%)', example: 987 })
    totalCandidatures: number;

    @ApiProperty({ description: 'Nombre de plans d\'affaires soumis', example: 456 })
    totalBusinessPlans: number;

    @ApiProperty({ description: 'Nombre de femmes entrepreneurs', example: 432 })
    totalWomen: number;

    @ApiProperty({ description: 'Données de la période précédente pour comparaison', type: PreviousPeriodDto })
    previousPeriod: PreviousPeriodDto;
}

export class SectorDataDto {
    @ApiProperty({ description: 'Nom du secteur d\'activité', example: 'Agriculture' })
    sector: string;

    @ApiProperty({ description: 'Nombre total de candidatures dans ce secteur', example: 145 })
    total: number;

    @ApiProperty({ description: 'Nombre de femmes candidates', example: 67 })
    women: number;

    @ApiProperty({ description: 'Nombre d\'hommes candidats', example: 78 })
    men: number;

    @ApiProperty({ description: 'Nombre de réfugiés candidats', example: 23 })
    refugees: number;
}

export class CommuneDataDto {
    @ApiProperty({ description: 'Nom de la commune', example: 'Mukaza' })
    name: string;

    @ApiProperty({ description: 'Nombre d\'inscriptions dans la commune', example: 98 })
    inscriptions: number;
}

export class RegionalDataDto {
    @ApiProperty({ description: 'Nom de la province', example: 'Bujumbura Mairie' })
    province: string;

    @ApiProperty({ description: 'Nombre total d\'inscriptions dans la province', example: 245 })
    inscriptions: number;

    @ApiProperty({ description: 'Liste des communes avec leurs inscriptions', type: [CommuneDataDto] })
    communes: CommuneDataDto[];
}

export class GenderDataDto {
    @ApiProperty({ description: 'Genre (Femmes/Hommes)', example: 'Femmes' })
    gender: string;

    @ApiProperty({ description: 'Nombre de candidats de ce genre', example: 432 })
    count: number;

    @ApiProperty({ description: 'Pourcentage du total', example: 43.2 })
    percentage: number;
}

export class CategoryDataDto {
    @ApiProperty({ description: 'Catégorie (Burundais/Réfugiés)', example: 'Burundais' })
    category: string;

    @ApiProperty({ description: 'Nombre de candidats dans cette catégorie', example: 880 })
    count: number;

    @ApiProperty({ description: 'Pourcentage du total', example: 88.0 })
    percentage: number;
}

export class GenderCategoryDataDto {
    @ApiProperty({ description: 'Données par genre', type: [GenderDataDto] })
    genderData: GenderDataDto[];

    @ApiProperty({ description: 'Données par catégorie', type: [CategoryDataDto] })
    categoryData: CategoryDataDto[];
}

export class TrendDataDto {
    @ApiProperty({ description: 'Mois (format court)', example: 'Jan' })
    month: string;

    @ApiProperty({ description: 'Nombre d\'inscriptions ce mois', example: 85 })
    registrations: number;

    @ApiProperty({ description: 'Nombre de profils complets ce mois', example: 62 })
    completed: number;

    @ApiProperty({ description: 'Nombre de plans soumis ce mois', example: 34 })
    submitted: number;
}

export class StatusDataDto {
    @ApiProperty({ description: 'Nom du statut', example: 'En attente' })
    status: string;

    @ApiProperty({ description: 'Nombre de candidatures avec ce statut', example: 234 })
    count: number;

    @ApiProperty({ description: 'Pourcentage du total', example: 23.4 })
    percentage: number;

    @ApiProperty({ description: 'Couleur associée au statut (code hexadécimal)', example: '#94a3b8' })
    color: string;
}

export class RecentApplicationDto {
    @ApiProperty({ description: 'ID du bénéficiaire', example: 1 })
    id: number;

    @ApiProperty({ description: 'Code candidature', example: 'COPA-2026-0001' })
    applicationCode: string;

    @ApiProperty({ description: 'Prénom du candidat', example: 'Jean' })
    firstName: string;

    @ApiProperty({ description: 'Nom du candidat', example: 'Nduwimana' })
    lastName: string;

    @ApiProperty({ description: 'Email du candidat', example: 'jean.nduwimana@example.com' })
    email: string;

    @ApiProperty({ description: 'Date d\'inscription', example: '2026-01-15T10:30:00.000Z' })
    registrationDate: Date;

    @ApiPropertyOptional({ description: 'Date de soumission de la candidature', example: '2026-02-20T14:45:00.000Z', nullable: true })
    submissionDate: Date | null;

    @ApiPropertyOptional({ description: 'Secteur d\'activité', example: 'Agriculture', nullable: true })
    sector: string | null;

    @ApiPropertyOptional({ description: 'Statut de la candidature', example: 'En attente', nullable: true })
    status: string | null;

    @ApiProperty({ description: 'Couleur du statut (pour affichage)', example: 'warning' })
    statusColor: string;
}

// DTO pour la réponse complète du dashboard
export class FullDashboardDataDto {
    @ApiProperty({ description: 'Statistiques des cartes', type: StatsCardsResponseDto })
    statsCards: StatsCardsResponseDto;

    @ApiProperty({ description: 'Candidatures par secteur', type: [SectorDataDto] })
    candidatesBySector: SectorDataDto[];

    @ApiProperty({ description: 'Inscriptions par région', type: [RegionalDataDto] })
    regionalInscriptions: RegionalDataDto[];

    @ApiProperty({ description: 'Analyse par genre et catégorie', type: GenderCategoryDataDto })
    genderCategoryAnalysis: GenderCategoryDataDto;

    @ApiProperty({ description: 'Évolution des inscriptions', type: [TrendDataDto] })
    registrationTrend: TrendDataDto[];

    @ApiProperty({ description: 'Pipeline par statut', type: [StatusDataDto] })
    statusPipeline: StatusDataDto[];

    @ApiProperty({ description: 'Dernières candidatures', type: [RecentApplicationDto] })
    recentApplications: RecentApplicationDto[];
}