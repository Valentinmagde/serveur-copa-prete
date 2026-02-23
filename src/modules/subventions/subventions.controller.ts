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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubventionsService } from './subventions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('subventions')
@Controller('subventions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubventionsController {
  constructor(private readonly subventionsService: SubventionsService) {}
}
