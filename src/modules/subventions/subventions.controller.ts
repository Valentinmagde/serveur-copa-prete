import {
  Controller, Get, Post, Patch, Body, Param,
  ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubventionsService } from './subventions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSubventionDto } from './dto/create-subvention.dto';

@ApiTags('subventions')
@Controller('subventions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubventionsController {
  constructor(private readonly subventionsService: SubventionsService) {}

  // ── Bénéficiaire MPME ─────────────────────────────────────────────────────

  @Get('my')
  @Roles('BENEFICIARY')
  @ApiOperation({ summary: 'Ma subvention' })
  getMySubvention(@CurrentUser() user: any) {
    return this.subventionsService.findByBeneficiaryId(user.beneficiaryId);
  }

  @Patch(':id/tranches/:trancheNumber/request')
  @Roles('BENEFICIARY')
  @ApiOperation({ summary: 'Demander la libération d\'une tranche' })
  requestTranche(
    @Param('id', ParseIntPipe) id: number,
    @Param('trancheNumber', ParseIntPipe) trancheNumber: number,
    @CurrentUser() user: any,
  ) {
    return this.subventionsService.requestTranche(id, trancheNumber, user.beneficiaryId);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Liste de toutes les subventions' })
  findAll() {
    return this.subventionsService.findAll();
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Statistiques du portefeuille' })
  getPortfolioStats() {
    return this.subventionsService.getPortfolioStats();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Détail d\'une subvention' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.subventionsService.findById(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Créer une subvention pour un lauréat' })
  create(@Body() dto: CreateSubventionDto, @CurrentUser() user: any) {
    return this.subventionsService.create(dto, user.id);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une subvention' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { statusCode: string },
    @CurrentUser() user: any,
  ) {
    return this.subventionsService.updateStatus(id, body.statusCode, user.id);
  }

  @Patch(':id/tranches/:trancheId/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Approuver et libérer une tranche' })
  approveTranche(
    @Param('id', ParseIntPipe) id: number,
    @Param('trancheId', ParseIntPipe) trancheId: number,
    @CurrentUser() user: any,
  ) {
    return this.subventionsService.approveTranche(id, trancheId, user.id);
  }
}
