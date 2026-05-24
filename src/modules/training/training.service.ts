import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Training } from './entities/training.entity';
import { TrainingSession } from './entities/training-session.entity';
import { Trainer } from './entities/trainer.entity';
import { TrainingParticipation } from './entities/training-participation.entity';
import { CreateTrainingDto } from './dto/create-training.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(Training)
    private readonly trainingRepository: Repository<Training>,
    @InjectRepository(TrainingSession)
    private readonly sessionRepository: Repository<TrainingSession>,
    @InjectRepository(Trainer)
    private readonly trainerRepository: Repository<Trainer>,
    @InjectRepository(TrainingParticipation)
    private readonly participationRepository: Repository<TrainingParticipation>,
  ) {}

  // ── Catalogue ────────────────────────────────────────────────────────────

  async findAllTrainings(): Promise<Training[]> {
    return this.trainingRepository.find({
      where: { isActive: true },
      relations: ['sessions'],
      order: { code: 'ASC' },
    });
  }

  async findTrainingById(id: number): Promise<Training> {
    const training = await this.trainingRepository.findOne({
      where: { id },
      relations: ['sessions', 'sessions.primaryTrainer', 'sessions.primaryTrainer.user'],
    });
    if (!training) throw new NotFoundException(`Formation ${id} introuvable`);
    return training;
  }

  async createTraining(dto: CreateTrainingDto): Promise<Training> {
    const exists = await this.trainingRepository.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Code formation "${dto.code}" déjà utilisé`);
    const training = this.trainingRepository.create(dto);
    return this.trainingRepository.save(training);
  }

  async updateTraining(id: number, dto: Partial<CreateTrainingDto>): Promise<Training> {
    const training = await this.findTrainingById(id);
    Object.assign(training, dto);
    return this.trainingRepository.save(training);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  async findAllSessions(editionId?: number): Promise<TrainingSession[]> {
    const qb = this.sessionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.training', 'training')
      .leftJoinAndSelect('s.primaryTrainer', 'trainer')
      .leftJoinAndSelect('trainer.user', 'trainerUser')
      .orderBy('s.startDate', 'ASC');

    if (editionId) qb.where('s.copaEditionId = :editionId', { editionId });

    return qb.getMany();
  }

  async findSessionById(id: number): Promise<TrainingSession> {
    const session = await this.sessionRepository.findOne({
      where: { id },
      relations: ['training', 'primaryTrainer', 'primaryTrainer.user', 'participations'],
    });
    if (!session) throw new NotFoundException(`Session ${id} introuvable`);
    return session;
  }

  async createSession(dto: CreateSessionDto): Promise<TrainingSession> {
    const training = await this.trainingRepository.findOne({ where: { id: dto.trainingId } });
    if (!training) throw new NotFoundException(`Formation ${dto.trainingId} introuvable`);

    const sessionCode = `SESSION-${dto.trainingId}-${Date.now()}`;
    const session = this.sessionRepository.create({
      ...dto,
      sessionCode,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : undefined,
    });
    return this.sessionRepository.save(session);
  }

  async updateSession(id: number, dto: Partial<CreateSessionDto>): Promise<TrainingSession> {
    const session = await this.findSessionById(id);
    Object.assign(session, dto);
    return this.sessionRepository.save(session);
  }

  async updateSessionStatus(id: number, status: string): Promise<TrainingSession> {
    const session = await this.findSessionById(id);
    session.status = status;
    return this.sessionRepository.save(session);
  }

  // ── Inscriptions bénéficiaires ────────────────────────────────────────────

  async enrollBeneficiary(sessionId: number, beneficiaryId: number): Promise<TrainingParticipation> {
    const session = await this.findSessionById(sessionId);

    if (session.status !== 'PLANNED' && session.status !== 'OPEN') {
      throw new BadRequestException('Les inscriptions pour cette session sont fermées');
    }
    if (session.registrationDeadline && new Date() > session.registrationDeadline) {
      throw new BadRequestException('La date limite d\'inscription est dépassée');
    }
    if (session.maxCapacity && session.currentEnrollment >= session.maxCapacity) {
      throw new BadRequestException('La session est complète');
    }

    const existing = await this.participationRepository.findOne({
      where: { sessionId, beneficiaryId },
    });
    if (existing) throw new ConflictException('Vous êtes déjà inscrit à cette session');

    const participation = this.participationRepository.create({ sessionId, beneficiaryId });
    const saved = await this.participationRepository.save(participation);

    session.currentEnrollment += 1;
    await this.sessionRepository.save(session);

    return saved;
  }

  async getMyEnrollments(beneficiaryId: number): Promise<TrainingParticipation[]> {
    return this.participationRepository.find({
      where: { beneficiaryId },
      relations: ['session', 'session.training'],
      order: { registrationDate: 'DESC' },
    });
  }

  async getCompletedEnrollments(beneficiaryId: number): Promise<TrainingParticipation[]> {
    return this.participationRepository.find({
      where: { beneficiaryId, hasValidated: true },
      relations: ['session', 'session.training'],
      order: { certificateObtainedAt: 'DESC' },
    });
  }

  async getMyCertificates(beneficiaryId: number): Promise<TrainingParticipation[]> {
    return this.participationRepository.find({
      where: { beneficiaryId, certificateObtained: true },
      relations: ['session', 'session.training'],
      order: { certificateObtainedAt: 'DESC' },
    });
  }

  // ── Admin : participants d'une session ────────────────────────────────────

  async getSessionParticipants(sessionId: number): Promise<TrainingParticipation[]> {
    await this.findSessionById(sessionId);
    return this.participationRepository.find({
      where: { sessionId },
      relations: ['beneficiary', 'beneficiary.user'],
      order: { registrationDate: 'ASC' },
    });
  }

  async markAttendance(
    sessionId: number,
    beneficiaryId: number,
    present: boolean,
  ): Promise<TrainingParticipation> {
    const participation = await this.participationRepository.findOne({
      where: { sessionId, beneficiaryId },
    });
    if (!participation) throw new NotFoundException('Participation introuvable');

    participation.attendanceStatus = present ? 'ATTENDED' : 'ABSENT';
    if (present) participation.attendanceDate = new Date();
    return this.participationRepository.save(participation);
  }

  async issueCertificate(sessionId: number, beneficiaryId: number): Promise<TrainingParticipation> {
    const participation = await this.participationRepository.findOne({
      where: { sessionId, beneficiaryId },
    });
    if (!participation) throw new NotFoundException('Participation introuvable');
    if (participation.certificateObtained) throw new ConflictException('Certificat déjà émis');

    participation.hasValidated = true;
    participation.certificateObtained = true;
    participation.certificateObtainedAt = new Date();
    return this.participationRepository.save(participation);
  }

  // ── Formateurs ────────────────────────────────────────────────────────────

  async findAllTrainers(): Promise<Trainer[]> {
    return this.trainerRepository.find({
      where: { isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTrainerSessions(trainerId: number): Promise<TrainingSession[]> {
    return this.sessionRepository.find({
      where: { primaryTrainerId: trainerId },
      relations: ['training', 'participations'],
      order: { startDate: 'ASC' },
    });
  }

  async getTrainerSessionParticipants(trainerId: number, sessionId: number): Promise<TrainingParticipation[]> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, primaryTrainerId: trainerId },
    });
    if (!session) throw new NotFoundException('Session introuvable ou accès non autorisé');
    return this.getSessionParticipants(sessionId);
  }
}
