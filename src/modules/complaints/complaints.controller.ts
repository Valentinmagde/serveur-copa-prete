import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ComplaintsService } from './complaints.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@ApiTags('complaints')
@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @Public()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  async create(
    @Body() createComplaintDto: CreateComplaintDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    return this.complaintsService.create(createComplaintDto, files || [], ip);
  }

  @Get()
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  findAll(@Query('editionId') editionId?: string) {
    return this.complaintsService.findAll(editionId ? +editionId : undefined);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.complaintsService.findById(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { statusCode: string; response?: string },
  ) {
    return this.complaintsService.updateStatus(id, body.statusCode, body.response);
  }
}
