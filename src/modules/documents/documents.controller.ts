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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentFilterDto } from './dto/document-filter.dto';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
    @CurrentUser() user,
  ) {
    return this.documentsService.upload(file, uploadDto, user.id, user.ip);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async findAll(@Query() filterDto: DocumentFilterDto) {
    return this.documentsService.findAll(filterDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentsService.findById(+id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string) {
    return this.documentsService.download(+id);
  }

  @Post(':id/validate')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async validate(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user,
  ) {
    return this.documentsService.validate(+id, user.id, comment);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async reject(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user,
  ) {
    return this.documentsService.reject(+id, user.id, comment);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async delete(@Param('id') id: string) {
    await this.documentsService.delete(+id);
    return { message: 'Document deleted successfully' };
  }

  @Get('types/list')
  async getDocumentTypes(@Query('requiredFor') requiredFor?: string) {
    return this.documentsService.getDocumentTypes(requiredFor);
  }

  @Get('entity/:entityType/:entityId')
  async getDocumentsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.documentsService.getDocumentsByEntity(entityType, +entityId);
  }
}
