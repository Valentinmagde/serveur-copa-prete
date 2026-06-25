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
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getStatsCards(@Query('editionId') editionId?: string) {
        return this.dashboardService.getStatsCards(editionId ? +editionId : undefined);
    }

    @Get('sectors')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les candidatures par secteur' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getCandidatesBySector(@Query('editionId') editionId?: string) {
        return this.dashboardService.getCandidatesBySector(editionId ? +editionId : undefined);
    }

    @Get('regions')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les inscriptions par région' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getRegionalInscriptions(@Query('editionId') editionId?: string) {
        return this.dashboardService.getRegionalInscriptions(editionId ? +editionId : undefined);
    }

    @Get('gender-category')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère l\'analyse par genre et catégorie' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getGenderCategoryAnalysis(@Query('editionId') editionId?: string) {
        return this.dashboardService.getGenderCategoryAnalysis(editionId ? +editionId : undefined);
    }

    @Get('trend')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère l\'évolution des inscriptions' })
    @ApiQuery({ name: 'months', required: false, type: Number, description: 'Nombre de mois à afficher' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getRegistrationTrend(@Query('months') months?: number, @Query('editionId') editionId?: string) {
        return this.dashboardService.getRegistrationTrend(months || 12, editionId ? +editionId : undefined);
    }

    @Get('pipeline')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère le pipeline par statut' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getStatusPipeline(@Query('editionId') editionId?: string) {
        return this.dashboardService.getStatusPipeline(editionId ? +editionId : undefined);
    }

    @Get('recent-applications')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère les dernières candidatures' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de résultats' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getRecentApplications(@Query('limit') limit?: number, @Query('editionId') editionId?: string) {
        return this.dashboardService.getRecentApplications(limit || 21, editionId ? +editionId : undefined);
    }

    @Get('full')
    @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
    @ApiOperation({ summary: 'Récupère toutes les données du dashboard' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getFullDashboardData(@Query('editionId') editionId?: string) {
        return this.dashboardService.getFullDashboardData(editionId ? +editionId : undefined);
    }

    @Get('company-status')
    @ApiOperation({ summary: 'Analyse par statut d\'entreprise (Formel/Informel)' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getCompanyStatusAnalysis(@Query('editionId') editionId?: string) {
        return this.dashboardService.getCompanyStatusAnalysis(editionId ? +editionId : undefined);
    }

    @Get('trend/:period')
    @ApiOperation({ summary: 'Évolution des inscriptions par période (jour/semaine/mois)' })
    @ApiQuery({ name: 'editionId', required: false, type: Number, description: 'Filtrer par édition COPA' })
    async getRegistrationTrendByPeriod(@Param('period') period: string, @Query('editionId') editionId?: string) {
        return this.dashboardService.getRegistrationTrendByPeriod(period, editionId ? +editionId : undefined);
    }
}