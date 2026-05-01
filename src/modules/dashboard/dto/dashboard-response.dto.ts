import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviousPeriodDto {
    @ApiProperty({ description: 'Nombre total de MPME inscrites (période précédente)', example: 1050 })
    totalMpme: number;

    @ApiProperty({ description: 'Nombre de candidatures complètes (période précédente)', example: 850 })
    totalCandidatures: number;

    @ApiProperty({ description: 'Nombre de plans d\'affaires soumis (période précédente)', example: 400 })
    totalBusinessPlans: number;

    @ApiProperty({ description: 'Nombre de femmes entrepreneurs (période précédente)', example: 380 })
    totalWomen: number;

    @ApiProperty({ description: 'Nombre de femmes entrepreneurs (période précédente)', example: 380 })
    totalRegistratedWomen: number;

    @ApiProperty({ description: 'Nombre de subventions accordées (période précédente)', example: 50 })
    totalSubventionsAccordees: number;

    @ApiProperty({ description: 'Montant total des subventions décaissées (période précédente)', example: 250000000 })
    totalSubventionsDecessees: number;

    @ApiProperty({ description: 'Nombre d\'emplois créés (période précédente)', example: 320 })
    emploisCrees: number;

    @ApiProperty({ description: 'Nombre de candidatures rejetées (période précédente)', example: 25 })
    totalRejected: number;

    @ApiProperty({ description: 'Nombre de candidatures présélectionnées (période précédente)', example: 40 })
    totalPreselected: number;

    @ApiProperty({ description: 'Nombre de candidatures sélectionnées (période précédente)', example: 12 })
    totalSelected: number;

    @ApiProperty({ description: 'Nombre de candidatures enregistrées (période précédente)', example: 60 })
    totalRegistered: number;
}

export class VariationsDto {
    @ApiProperty({ description: 'Variation du nombre de MPME (%)', example: 12.5 })
    totalMpme: number;

    @ApiProperty({ description: 'Variation des candidatures (%)', example: 8.3 })
    totalCandidatures: number;

    @ApiProperty({ description: 'Variation des plans d\'affaires (%)', example: 15.2 })
    totalBusinessPlans: number;

    @ApiProperty({ description: 'Variation du nombre de femmes (%)', example: 10.1 })
    totalWomen: number;

    @ApiProperty({ description: 'Variation du nombre de femmes (%)', example: 10.1 })
    totalRegistratedWomen: number;

    @ApiProperty({ description: 'Variation des subventions accordées (%)', example: 20.0 })
    totalSubventionsAccordees: number;

    @ApiProperty({ description: 'Variation des montants décaissés (%)', example: 18.5 })
    totalSubventionsDecessees: number;

    @ApiProperty({ description: 'Variation des emplois créés (%)', example: 15.0 })
    emploisCrees: number;

    @ApiProperty({ description: 'Variation du nombre de candidatures rejetées (%)', example: 20.0 })
    totalRejected: number;

    @ApiProperty({ description: 'Variation du nombre de candidatures présélectionnées (%)', example: 12.5 })
    totalPreselected: number;

    @ApiProperty({ description: 'Variation du nombre de candidatures sélectionnées (%)', example: 25.0 })
    totalSelected: number;

    @ApiProperty({ description: 'Variation du nombre de candidatures enregistrées (%)', example: 10.0 })
    totalRegistered: number;
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

    @ApiProperty({ description: 'Nombre de femmes entrepreneurs', example: 432 })
    totalRegistratedWomen: number;

    @ApiProperty({ description: 'Nombre de subventions accordées', example: 75 })
    totalSubventionsAccordees: number;

    @ApiProperty({ description: 'Montant total des subventions décaissées (BIF)', example: 450000000 })
    totalSubventionsDecessees: number;

    @ApiProperty({ description: 'Nombre d\'emplois créés', example: 500 })
    emploisCrees: number;

    @ApiProperty({
        description: 'Données de la période précédente pour comparaison',
        type: PreviousPeriodDto,
    })
    previousPeriod: PreviousPeriodDto;

    @ApiProperty({ description: 'Variations en pourcentage par rapport à la période précédente', type: VariationsDto, required: false })
    variations?: VariationsDto;

    @ApiProperty({ description: 'Nombre de candidatures rejetées', example: 30 })
    totalRejected: number;

    @ApiProperty({ description: 'Nombre de candidatures présélectionnées', example: 50 })
    totalPreselected: number;

    @ApiProperty({ description: 'Nombre de candidatures sélectionnées', example: 15 })
    totalSelected: number;

    @ApiProperty({ description: 'Nombre de candidatures enregistrées', example: 80 })
    totalRegistered: number;
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