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
  ParseIntPipe,
  DefaultValuePipe,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MarkReadDto } from './dto/mark-read.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  // ==================== ENDPOINTS PUBLICS ====================
  @Post('contact')
  @Public()
  async submitContact(@Body() contactData: any, @Req() req: any) {
    const result = await this.notificationsService.sendContactNotification(
      {
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        subject: contactData.subject,
        message: contactData.message,
      },
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id,
      },
    );

    if (!result.success) {
      throw new BadRequestException("Erreur lors de l'envoi du message");
    }

    return {
      success: true,
      message: 'Message envoyé avec succès',
      reference: result.supportNotificationId,
    };
  }

  //   @Public()
  //   @Post('webhook/sms')
  //   @HttpCode(HttpStatus.OK)
  //   @ApiOperation({ summary: 'Webhook pour statut SMS (Twilio)' })
  //   async smsWebhook(@Body() payload: any) {
  //     return this.notificationsService.handleSmsStatusCallback(payload);
  //   }

  //   @Public()
  //   @Post('webhook/email')
  //   @HttpCode(HttpStatus.OK)
  //   @ApiOperation({ summary: 'Webhook pour statut email (SendGrid)' })
  //   async emailWebhook(@Body() payload: any) {
  //     return this.notificationsService.handleEmailStatusCallback(payload);
  //   }

  // ==================== ENDPOINTS UTILISATEUR ====================

  //   @Get('my')
  //   @ApiOperation({ summary: 'Récupérer mes notifications' })
  //   @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  //   async getMyNotifications(
  //     @CurrentUser() user,
  //     @Query() filter: NotificationFilterDto,
  //   ) {
  //     filter.userId = user.id.toString();
  //     return this.notificationsService.getUserNotifications(filter);
  //   }

  @Get('my/unread/count')
  @ApiOperation({ summary: 'Compter mes notifications non lues' })
  @ApiResponse({ status: 200 })
  async countMyUnread(@CurrentUser() user) {
    const count = await this.notificationsService.countUnreadByUser(user.id);
    return { unreadCount: count };
  }

  @Put('my/read')
  @ApiOperation({ summary: 'Marquer mes notifications comme lues' })
  @ApiResponse({ status: 200 })
  async markMyAsRead(@CurrentUser() user, @Body() markReadDto: MarkReadDto) {
    if (markReadDto.markAll) {
      await this.notificationsService.markAllAsReadByUser(user.id);
    } else if (markReadDto.notificationIds?.length) {
      await this.notificationsService.markAsRead(
        markReadDto.notificationIds,
        user.id,
      );
    }
    return { message: 'Notifications marquées comme lues' };
  }

  @Put('my/:id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200 })
  async markOneAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user,
  ) {
    await this.notificationsService.markAsRead([id], user.id);
    return { message: 'Notification marquée comme lue' };
  }

  @Delete('my/:id')
  @ApiOperation({ summary: 'Supprimer une notification' })
  @ApiParam({ name: 'id', type: Number })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user,
  ) {
    await this.notificationsService.deleteUserNotification(id, user.id);
  }

  // ==================== ENDPOINTS ADMIN ====================

  @Post('send/preselected/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Envoyer un email de présélection' })
  async sendPreselectedEmail(
    @Param('id', ParseIntPipe) id: number,
    // @Body('comment') comment: string,
  ) {
    return this.notificationsService.sendPreselectedEmail(id);
  }

  @Post('send/rejected/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Envoyer un email de rejet' })
  async sendRejectedEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    return this.notificationsService.sendRejectedEmail(id);
  }

  @Post('send/batch')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: `Envoi groupé d'emails` })
  async sendBatchEmails(
    @Body()
    dto: {
      type: 'PRESELECTION' | 'REJECTION';
      beneficiaryIds: number[];
      message: string;
    },
  ) {
    return this.notificationsService.sendBatchEmails(dto);
  }

  @Get('history/preselect-reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({
    summary: `Historique des notifications de présélection et rejet`,
  })
  async getPreselectRejectHistory(@Query() filter: NotificationFilterDto) {
    return this.notificationsService.getPreselectRejectHistory(filter);
  }

  @Get('candidates')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({
    summary: 'Récupérer la liste des candidats pour envoi groupé',
  })
  async getCandidatesForNotification(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.notificationsService.getCandidatesForNotification(
      status,
      search,
    );
  }

  @Post('send/batch/auto')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Envoi groupé automatique d\'emails (présélection/rejet/sélection)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['PRESELECTION', 'REJECTION', 'SELECTION'] },
        beneficiaryIds: { type: 'array', items: { type: 'number' } },
      },
      required: ['type', 'beneficiaryIds'],
    },
  })
  async sendBatchAutoEmails(
    @Body() dto: { type: 'PRESELECTION' | 'REJECTION' | 'SELECTION'; beneficiaryIds: number[] },
  ) {
    return this.notificationsService.sendBatchAutoEmails(dto.type, dto.beneficiaryIds);
  }

  //   @Get('admin/all')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Récupérer toutes les notifications (admin)' })
  //   @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  //   async getAllNotifications(@Query() filter: NotificationFilterDto) {
  //     return this.notificationsService.getAllNotifications(filter);
  //   }

  //   @Get('admin/stats')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Statistiques des notifications' })
  //   @ApiResponse({ status: 200 })
  //   async getStats() {
  //     return this.notificationsService.getNotificationStats();
  //   }

  @Post('send')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Envoyer un message manuel (email, SMS ou les deux)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['INDIVIDUAL', 'BULK'] },
        channel: { type: 'string', enum: ['EMAIL', 'SMS', 'BOTH'], default: 'EMAIL' },
        beneficiaryIds: { type: 'array', items: { type: 'number' } },
        subject: { type: 'string' },
        message: { type: 'string' },
        useAutoTemplate: { type: 'boolean', default: false },
      },
      required: ['type', 'beneficiaryIds', 'message'],
    },
  })
  async sendManualNotification(@Body() dto: {
    type: 'INDIVIDUAL' | 'BULK';
    channel?: 'EMAIL' | 'SMS' | 'BOTH';
    beneficiaryIds: number[];
    subject?: string;
    message: string;
    useAutoTemplate?: boolean;
  }) {
    const channel = dto.channel ?? 'EMAIL';

    if (channel === 'SMS') {
      return this.notificationsService.sendManualSms({
        beneficiaryIds: dto.beneficiaryIds,
        message: dto.message,
      });
    }

    if (channel === 'BOTH') {
      const [emailResults, smsResults] = await Promise.all([
        this.notificationsService.sendManualEmail({ ...dto, subject: dto.subject ?? '' }),
        this.notificationsService.sendManualSms({ beneficiaryIds: dto.beneficiaryIds, message: dto.message }),
      ]);
      return { email: emailResults, sms: smsResults, total: dto.beneficiaryIds.length };
    }

    return this.notificationsService.sendManualEmail({ ...dto, subject: dto.subject ?? '' });
  }

  //   @Post('admin/send/bulk')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Envoyer des notifications en masse' })
  //   @ApiResponse({ status: 201 })
  //   async sendBulkNotifications(@Body() bulkDto: SendBulkDto) {
  //     return this.notificationsService.sendBulkNotifications(bulkDto);
  //   }

  //   @Post('admin/send/template/:templateName')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Envoyer une notification basée sur un template' })
  //   @ApiParam({ name: 'templateName', type: String })
  //   async sendTemplateNotification(
  //     @Param('templateName') templateName: string,
  //     @Body() data: any,
  //   ) {
  //     return this.notificationsService.sendTemplateNotification(
  //       templateName,
  //       data,
  //     );
  //   }

  //   @Get('admin/:id')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Récupérer une notification par ID' })
  //   @ApiParam({ name: 'id', type: Number })
  //   @ApiResponse({ status: 200, type: NotificationResponseDto })
  //   async getNotification(@Param('id', ParseIntPipe) id: number) {
  //     return this.notificationsService.getNotificationById(id);
  //   }

  //   @Put('admin/:id')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Mettre à jour une notification' })
  //   @ApiParam({ name: 'id', type: Number })
  //   async updateNotification(
  //     @Param('id', ParseIntPipe) id: number,
  //     @Body() updateDto: UpdateNotificationDto,
  //   ) {
  //     return this.notificationsService.updateNotification(id, updateDto);
  //   }

  //   @Delete('admin/:id')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Supprimer une notification' })
  //   @ApiParam({ name: 'id', type: Number })
  //   @HttpCode(HttpStatus.NO_CONTENT)
  //   async deleteNotification(@Param('id', ParseIntPipe) id: number) {
  //     await this.notificationsService.deleteNotification(id);
  //   }

    @Post(':id/resend')
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Renvoyer une notification' })
    @ApiParam({ name: 'id', type: Number })
    async resendNotification(@Param('id', ParseIntPipe) id: number) {
      return this.notificationsService.resendNotification(id);
    }

  @Get('admin/templates/list')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Lister tous les templates disponibles' })
  async listTemplates() {
    return this.notificationsService.listTemplates();
  }

  //   @Get('admin/user/:userId/history')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: "Historique des notifications d'un utilisateur" })
  //   @ApiParam({ name: 'userId', type: Number })
  //   async getUserNotificationHistory(
  //     @Param('userId', ParseIntPipe) userId: number,
  //     @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  //   ) {
  //     return this.notificationsService.getUserNotificationHistory(userId, limit);
  //   }

  // ==================== ENDPOINTS DE TEST ====================

  @Public()
  @Post('test/sms')
  // @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: "Tester l'envoi de SMS" })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', example: '+33612345678' },
        message: { type: 'string', example: 'Ceci est un SMS de test' },
      },
      required: ['to', 'message'],
    },
  })
  async testSms(@Body() data: { to: string; message: string }) {
    return this.notificationsService.testSms(data.to, data.message);
  }

  @Public()
  @Post('test/email')
  //@Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: "Tester l'envoi d'email" })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', example: 'user@example.com' },
        subject: { type: 'string', example: 'Test Email', nullable: true },
        message: {
          type: 'string',
          example: 'Ceci est un email de test',
          nullable: true,
        },
      },
      required: ['to'],
    },
  })
  async testEmail(
    @Body() data: { to: string; subject?: string; message?: string },
  ) {
    return this.notificationsService.testEmail(data);
  }

  @Public()
  @Post('test/brevo')
  @ApiOperation({ summary: "Tester l'envoi d'email via Brevo" })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', example: 'user@example.com' },
        subject: { type: 'string', example: 'Test Email', nullable: true },
        message: {
          type: 'string',
          example: 'Ceci est un email de test',
          nullable: true,
        },
      },
      required: ['to'],
    },
  })
  async testBrevo(
    @Body() data: { to: string; subject?: string; message?: string },
  ) {
    return this.notificationsService.testBrevo(data);
  }

  @Get('test/connection')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Tester les connexions' })
  async testConnections() {
    return this.notificationsService.testConnections();
  }
}
