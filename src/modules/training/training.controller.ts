import {
  Controller, Get, Post, Put, Patch, Body, Param,
  ParseIntPipe, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTrainingDto } from './dto/create-training.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@ApiTags('training')
@Controller('training')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ── Catalogue (public) ───────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liste du catalogue des formations' })
  findAllTrainings() {
    return this.trainingService.findAllTrainings();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Détail d\'une formation' })
  findTrainingById(@Param('id', ParseIntPipe) id: number) {
    return this.trainingService.findTrainingById(id);
  }

  // ── Sessions (public lecture) ─────────────────────────────────────────────

  @Get('sessions/list')
  @Public()
  @ApiOperation({ summary: 'Liste des sessions' })
  findAllSessions(@Query('editionId') editionId?: string) {
    return this.trainingService.findAllSessions(editionId ? +editionId : undefined);
  }

  @Get('sessions/:id')
  @Public()
  @ApiOperation({ summary: 'Détail d\'une session' })
  findSessionById(@Param('id', ParseIntPipe) id: number) {
    return this.trainingService.findSessionById(id);
  }

  // ── Bénéficiaire MPME ─────────────────────────────────────────────────────

  @Post('sessions/:id/enroll')
  @Roles('BENEFICIARY')
  @ApiOperation({ summary: 'S\'inscrire à une session' })
  enrollBeneficiary(
    @Param('id', ParseIntPipe) sessionId: number,
    @CurrentUser() user: any,
  ) {
    return this.trainingService.enrollBeneficiary(sessionId, user.beneficiaryId);
  }

  @Get('my/enrollments')
  @Roles('BENEFICIARY')
  @ApiOperation({ summary: 'Mes formations en cours' })
  getMyEnrollments(@CurrentUser() user: any) {
    return this.trainingService.getMyEnrollments(user.beneficiaryId);
  }

  @Get('my/completed')
  @Roles('BENEFICIARY')
  @ApiOperation({ summary: 'Mes formations terminées' })
  getCompletedEnrollments(@CurrentUser() user: any) {
    return this.trainingService.getCompletedEnrollments(user.beneficiaryId);
  }

  @Get('my/certificates')
  @Roles('BENEFICIARY')
  @ApiOperation({ summary: 'Mes certificats' })
  getMyCertificates(@CurrentUser() user: any) {
    return this.trainingService.getMyCertificates(user.beneficiaryId);
  }

  // ── Formateur ────────────────────────────────────────────────────────────

  @Get('trainer/sessions')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Sessions du formateur connecté' })
  getMyTrainerSessions(@CurrentUser() user: any) {
    return this.trainingService.getTrainerSessions(user.trainerId);
  }

  @Get('trainer/sessions/:sessionId/participants')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Participants d\'une session (formateur)' })
  getTrainerSessionParticipants(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() user: any,
  ) {
    return this.trainingService.getTrainerSessionParticipants(user.trainerId, sessionId);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Créer une formation' })
  createTraining(@Body() dto: CreateTrainingDto) {
    return this.trainingService.createTraining(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Modifier une formation' })
  updateTraining(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateTrainingDto>) {
    return this.trainingService.updateTraining(id, dto);
  }

  @Post('sessions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Créer une session' })
  createSession(@Body() dto: CreateSessionDto) {
    return this.trainingService.createSession(dto);
  }

  @Put('sessions/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Modifier une session' })
  updateSession(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateSessionDto>) {
    return this.trainingService.updateSession(id, dto);
  }

  @Patch('sessions/:id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Changer le statut d\'une session' })
  updateSessionStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.trainingService.updateSessionStatus(id, body.status);
  }

  @Get('sessions/:id/participants')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER', 'TRAINER')
  @ApiOperation({ summary: 'Participants d\'une session (admin)' })
  getSessionParticipants(@Param('id', ParseIntPipe) id: number) {
    return this.trainingService.getSessionParticipants(id);
  }

  @Patch('sessions/:sessionId/participants/:beneficiaryId/attendance')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER', 'TRAINER')
  @ApiOperation({ summary: 'Marquer la présence d\'un participant' })
  markAttendance(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('beneficiaryId', ParseIntPipe) beneficiaryId: number,
    @Body() body: { present: boolean },
  ) {
    return this.trainingService.markAttendance(sessionId, beneficiaryId, body.present);
  }

  @Patch('sessions/:sessionId/participants/:beneficiaryId/certificate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Émettre un certificat' })
  issueCertificate(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('beneficiaryId', ParseIntPipe) beneficiaryId: number,
  ) {
    return this.trainingService.issueCertificate(sessionId, beneficiaryId);
  }

  @Get('admin/trainers')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Liste des formateurs' })
  findAllTrainers() {
    return this.trainingService.findAllTrainers();
  }
}
