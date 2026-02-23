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
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SendBulkDto } from './dto/send-bulk.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ==================== ENDPOINTS PUBLICS ====================

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

  //   @Post('admin/send')
  //   @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  //   @ApiOperation({ summary: 'Envoyer une notification' })
  //   @ApiResponse({ status: 201 })
  //   async sendNotification(@Body() createDto: CreateNotificationDto) {
  //     return this.notificationsService.sendNotification(createDto);
  //   }

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

  //   @Post('admin/resend/:id')
  //   @Roles('SUPER_ADMIN', 'ADMIN')
  //   @ApiOperation({ summary: 'Renvoyer une notification' })
  //   @ApiParam({ name: 'id', type: Number })
  //   async resendNotification(@Param('id', ParseIntPipe) id: number) {
  //     return this.notificationsService.resendNotification(id);
  //   }

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
  async testEmail(@Body() data: { to: string; subject?: string, message?: string }) {
    return this.notificationsService.testEmail(data);
  }

  @Get('test/connection')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Tester les connexions' })
  async testConnections() {
    return this.notificationsService.testConnections();
  }
}
