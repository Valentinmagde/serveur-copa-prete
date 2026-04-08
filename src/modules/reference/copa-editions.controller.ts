import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CopaEditionsService } from './copa-editions.service';

@ApiTags('copa-editions')
@Controller('reference/copa-editions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CopaEditionsController {
    constructor(private readonly editionsService: CopaEditionsService) { }

    @Get('admin')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Récupérer toutes les éditions' })
    async findAll() {
        return this.editionsService.findAll();
    }

    @Get('active')
    @ApiOperation({ summary: 'Récupérer l\'édition active' })
    async findActive() {
        return this.editionsService.findActive();
    }

    @Get('current')
    @ApiOperation({ summary: 'Récupérer l\'édition en cours' })
    async findCurrent() {
        return this.editionsService.findCurrent();
    }

    @Get('stats')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Récupérer les statistiques' })
    async getStats() {
        return this.editionsService.getStats();
    }

    @Get('open-registration')
    @ApiOperation({ summary: 'Récupérer les éditions avec inscriptions ouvertes' })
    async findOpenForRegistration() {
        return this.editionsService.findOpenForRegistration();
    }

    @Get('year/:year')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Récupérer les éditions par année' })
    async findByYear(@Param('year') year: string) {
        return this.editionsService.findByYear(+year);
    }

    @Get('check-registration')
    @ApiOperation({ summary: 'Vérifier si les inscriptions sont ouvertes' })
    async isRegistrationOpen(@Query('editionId') editionId?: string) {
        const isOpen = await this.editionsService.isRegistrationOpen(editionId ? +editionId : undefined);
        return { isOpen };
    }

    @Get('check-submission')
    @ApiOperation({ summary: 'Vérifier si les soumissions sont ouvertes' })
    async isSubmissionOpen(@Query('editionId') editionId?: string) {
        const isOpen = await this.editionsService.isSubmissionOpen(editionId ? +editionId : undefined);
        return { isOpen };
    }

    @Get(':id')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Récupérer une édition par ID' })
    async findById(@Param('id') id: string) {
        return this.editionsService.findById(+id);
    }

    @Get('code/:code')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Récupérer une édition par code' })
    async findByCode(@Param('code') code: string) {
        return this.editionsService.findByCode(code);
    }

    @Post()
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Créer une nouvelle édition' })
    async create(@Body() data: any) {
        this.editionsService.validateDates(data);
        return this.editionsService.create(data);
    }

    @Post(':id/activate')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Activer une édition' })
    async activate(@Param('id') id: string) {
        return this.editionsService.activate(+id);
    }

    @Post(':id/deactivate')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Désactiver une édition' })
    async deactivate(@Param('id') id: string) {
        return this.editionsService.deactivate(+id);
    }

    @Post(':id/duplicate')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Dupliquer une édition pour une nouvelle année' })
    async duplicate(@Param('id') id: string, @Body('year') year: number) {
        return this.editionsService.duplicate(+id, year);
    }

    @Put(':id')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Mettre à jour une édition' })
    async update(@Param('id') id: string, @Body() data: any) {
        this.editionsService.validateDates(data);
        return this.editionsService.update(+id, data);
    }

    @Delete(':id')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Supprimer une édition' })
    async delete(@Param('id') id: string) {
        await this.editionsService.delete(+id);
    }

    @Delete(':id/soft')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Désactiver une édition (soft delete)' })
    async softDelete(@Param('id') id: string) {
        return this.editionsService.softDelete(+id);
    }
}