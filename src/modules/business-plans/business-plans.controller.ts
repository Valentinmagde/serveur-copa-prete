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
import { BusinessPlansService } from './business-plans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessPlanFilterDto } from './dto/business-plan-filter.dto';
import { CreateBusinessPlanDto } from './dto/create-business-plan.dto';
import { UpdateBusinessPlanDto } from './dto/update-business-plan.dto';
import { SubmitBusinessPlanDto } from './dto/submit-business-plan.dto';


@ApiTags('business-plans')
@Controller('business-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BusinessPlansController {
  constructor(private readonly businessPlansService: BusinessPlansService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER', 'EVALUATOR')
  async findAll(@Query() filterDto: BusinessPlanFilterDto) {
    return this.businessPlansService.findAll(filterDto);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER', 'EVALUATOR', 'BENEFICIARY')
  async findOne(@Param('id') id: string) {
    return this.businessPlansService.findById(+id);
  }

  @Post()
  @Roles('BENEFICIARY')
  async create(@Body() createDto: CreateBusinessPlanDto, @CurrentUser() user) {
    return this.businessPlansService.create(createDto, user.id);
  }

  @Put(':id')
  @Roles('BENEFICIARY')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBusinessPlanDto,
    @CurrentUser() user,
  ) {
    return this.businessPlansService.update(+id, updateDto, user.id);
  }

  @Post(':id/submit')
  @Roles('BENEFICIARY')
  async submit(
    @Param('id') id: string,
    @Body() submitDto: SubmitBusinessPlanDto,
    @CurrentUser() user,
  ) {
    return this.businessPlansService.submit(+id, submitDto, user.id);
  }

  @Get(':id/sections')
  @Roles('BENEFICIARY', 'EVALUATOR', 'ADMIN')
  async getSections(@Param('id') id: string) {
    return this.businessPlansService.getSections(+id);
  }

  @Get(':id/evaluation-summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER', 'EVALUATOR')
  async getEvaluationSummary(@Param('id') id: string) {
    return this.businessPlansService.getEvaluationSummary(+id);
  }
}
