import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Public()
    @Get('stats')
    // @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les statistiques des cartes' })
    async getStatsCards() {
        return this.dashboardService.getStatsCards();
    }

    @Get('sectors')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les candidatures par secteur' })
    async getCandidatesBySector() {
        return this.dashboardService.getCandidatesBySector();
    }

    @Get('regions')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les inscriptions par région' })
    async getRegionalInscriptions() {
        return this.dashboardService.getRegionalInscriptions();
    }

    @Get('gender-category')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère l\'analyse par genre et catégorie' })
    async getGenderCategoryAnalysis() {
        return this.dashboardService.getGenderCategoryAnalysis();
    }

    @Get('trend')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère l\'évolution des inscriptions' })
    @ApiQuery({ name: 'months', required: false, type: Number, description: 'Nombre de mois à afficher' })
    async getRegistrationTrend(@Query('months') months?: number) {
        return this.dashboardService.getRegistrationTrend(months || 12);
    }

    @Get('pipeline')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère le pipeline par statut' })
    async getStatusPipeline() {
        return this.dashboardService.getStatusPipeline();
    }

    @Get('recent-applications')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les dernières candidatures' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de résultats' })
    async getRecentApplications(@Query('limit') limit?: number) {
        return this.dashboardService.getRecentApplications(limit || 21);
    }

    @Get('full')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère toutes les données du dashboard' })
    async getFullDashboardData() {
        return this.dashboardService.getFullDashboardData();
    }

    @Get('company-status')
    @ApiOperation({ summary: 'Analyse par statut d\'entreprise (Formel/Informel)' })
    async getCompanyStatusAnalysis() {
        return this.dashboardService.getCompanyStatusAnalysis();
    }

    @Get('trend/:period')
    @ApiOperation({ summary: 'Évolution des inscriptions par période (jour/semaine/mois)' })
    async getRegistrationTrendByPeriod(@Param('period') period: string) {
        return this.dashboardService.getRegistrationTrendByPeriod(period);
    }
}