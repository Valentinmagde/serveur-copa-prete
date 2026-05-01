import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferenceService } from './reference.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('reference')
@Controller('reference')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('genders')
  @Public()
  @ApiOperation({ summary: 'Get all genders' })
  @ApiResponse({ status: 200 })
  async getGenders() {
    return this.referenceService.getGenders();
  }

  @Get('provinces')
  @Public()
  @ApiOperation({ summary: 'Get all provinces' })
  @ApiResponse({ status: 200 })
  async getProvinces() {
    return this.referenceService.getProvinces();
  }

  @Get('provinces/:provinceId/communes')
  @Public()
  @ApiOperation({ summary: 'Get communes by province' })
  @ApiResponse({ status: 200 })
  async getCommunes(@Param('provinceId') provinceId: string) {
    return this.referenceService.getCommunesByProvince(+provinceId);
  }

  @Get('business-sectors')
  @Public()
  @ApiOperation({ summary: 'Get business sectors' })
  @ApiResponse({ status: 200 })
  async getBusinessSectors(@Query('eligible') eligible?: string) {
    return this.referenceService.getBusinessSectors(eligible === 'true');
  }

  @Get('legal-forms')
  @Public()
  @ApiOperation({ summary: 'Get legal forms' })
  @ApiResponse({ status: 200 })
  async getLegalForms() {
    return this.referenceService.getLegalForms();
  }

  @Get('document-types')
  @ApiOperation({ summary: 'Get document types' })
  @ApiResponse({ status: 200 })
  async getDocumentTypes() {
    return this.referenceService.getDocumentTypes();
  }

  @Get('complaint-types')
  @ApiOperation({ summary: 'Get complaint types' })
  @ApiResponse({ status: 200 })
  async getComplaintTypes() {
    return this.referenceService.getComplaintTypes();
  }

  @Get('statuses/:entityType')
  @ApiOperation({ summary: 'Get statuses by entity type' })
  @ApiResponse({ status: 200 })
  async getStatuses(@Param('entityType') entityType: string) {
    return this.referenceService.getStatusesByEntityType(entityType);
  }

  @Public()
  @Get('copa-editions')
  @ApiOperation({ summary: 'Get COPA editions' })
  @ApiResponse({ status: 200 })
  async getCopaEditions(@Query('active') active?: string) {
    return this.referenceService.getCopaEditions(active === 'true');
  }

  @Public()
  @Get('copa-editions/current')
  @ApiOperation({ summary: 'Get current active COPA edition' })
  @ApiResponse({ status: 200 })
  async getCurrentCopaEdition() {
    return this.referenceService.getCurrentCopaEditions();
  }

  @Public()
  @Get('copa-phases')
  @ApiOperation({ summary: 'Get COPA phases' })
  @ApiResponse({ status: 200 })
  async getCopaPhases(@Query('active') active?: string) {
    return this.referenceService.getCopaPhases(active === 'true');
  }

  @Public()
  @Get('copa-phases/current')
  @ApiOperation({ summary: 'Get current active COPA phases' })
  @ApiResponse({ status: 200 })
  async getCurrentCopaPhase() {
    return this.referenceService.getCurrentCopaPhases();
  }

  @Get('copa-phases/edition/:editionId')
  @ApiOperation({ summary: 'Get phases for a specific edition (admin)' })
  async getPhasesByEdition(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.referenceService.getPhasesByEdition(editionId);
  }

  @Post('copa-phases/:id/toggle')
  @ApiOperation({ summary: 'Toggle phase active status (admin)' })
  async togglePhase(@Param('id', ParseIntPipe) id: number) {
    return this.referenceService.togglePhase(id);
  }

  @Patch('copa-phases/:id/dates')
  @ApiOperation({ summary: 'Update phase start/end dates (admin)' })
  async updatePhaseDates(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { startDate: string; endDate: string },
  ) {
    return this.referenceService.updatePhaseDates(id, body.startDate, body.endDate);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get roles' })
  @ApiResponse({ status: 200 })
  async getRoles() {
    return this.referenceService.getRoles();
  }

  @Get('consent-types')
  @ApiOperation({ summary: 'Get consent types' })
  @ApiResponse({ status: 200 })
  async getConsentTypes() {
    return this.referenceService.getConsentTypes();
  }

  @Get('training-section-types')
  @ApiOperation({ summary: 'Get business plan section types' })
  @ApiResponse({ status: 200 })
  async getBusinessPlanSectionTypes() {
    return this.referenceService.getBusinessPlanSectionTypes();
  }
}
