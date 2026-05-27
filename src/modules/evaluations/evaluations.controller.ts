import {
  Controller, Get, Post, Put, Body, Param,
  ParseIntPipe, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubmitEvaluationDto } from './dto/submit-evaluation.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@ApiTags('evaluations')
@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  // ── Évaluateur connecté ──────────────────────────────────────────────────

  @Get('my/assignments')
  @Roles('EVALUATOR', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Plans assignés à l\'évaluateur connecté' })
  async getMyAssignments(@CurrentUser() user: any) {
    const evaluatorId = await this.evaluationsService.resolveEvaluatorIdForUser(user.evaluatorId, user.id);
    return this.evaluationsService.findMyAssignments(evaluatorId);
  }

  @Get('my/assignments/:id')
  @Roles('EVALUATOR', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Détail d\'une affectation' })
  findAssignmentById(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.findAssignmentById(id);
  }

  @Get('my/evaluations')
  @Roles('EVALUATOR', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Évaluations soumises par l\'évaluateur connecté' })
  async getMyEvaluations(@CurrentUser() user: any) {
    const evaluatorId = await this.evaluationsService.resolveEvaluatorIdForUser(user.evaluatorId, user.id);
    return this.evaluationsService.findMyEvaluations(evaluatorId);
  }

  @Post()
  @Roles('EVALUATOR', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Soumettre une évaluation' })
  submitEvaluation(@Body() dto: SubmitEvaluationDto, @CurrentUser() user: any) {
    return this.evaluationsService.submitEvaluation(dto, user.evaluatorId, user.id);
  }

  @Put(':id')
  @Roles('EVALUATOR', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Modifier une évaluation' })
  async updateEvaluation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<SubmitEvaluationDto>,
    @CurrentUser() user: any,
  ) {
    const evaluatorId = await this.evaluationsService.resolveEvaluatorIdForUser(user.evaluatorId, user.id);
    return this.evaluationsService.updateEvaluation(id, dto, evaluatorId);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @Get('assignments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Toutes les affectations' })
  findAllAssignments(@Query('editionId') editionId?: string) {
    return this.evaluationsService.findAllAssignments(editionId ? +editionId : undefined);
  }

  @Post('assignments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Affecter un plan à un évaluateur' })
  createAssignment(@Body() dto: CreateAssignmentDto, @CurrentUser() user: any) {
    return this.evaluationsService.createAssignment(dto, user.id);
  }

  @Get('business-plans/:id/gaps')
  @Roles('EVALUATOR', 'SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Moyennes par critère (détection d\'écart) — sans détail individuel' })
  getGapData(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.getGapData(id);
  }

  @Get('business-plans/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Évaluations d\'un plan d\'affaires' })
  findEvaluationsForBusinessPlan(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.findEvaluationsForBusinessPlan(id);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Statistiques des évaluations' })
  getStats(@Query('editionId') editionId?: string) {
    return this.evaluationsService.getEvaluationStats(editionId ? +editionId : undefined);
  }

  @Get('evaluators')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Liste des évaluateurs' })
  findAllEvaluators() {
    return this.evaluationsService.findAllEvaluators();
  }

  @Post('evaluators')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Enregistrer un évaluateur' })
  createEvaluator(@Body() body: { userId: number; expertise?: string }) {
    return this.evaluationsService.createEvaluator(body.userId, body.expertise);
  }
}
