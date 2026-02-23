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
import { BeneficiariesService } from './beneficiaries.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BeneficiaryFilterDto } from './dto/beneficiary-filter.dto';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('beneficiaries')
@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  async findAll(@Query() filterDto: BeneficiaryFilterDto) {
    return this.beneficiariesService.findAll(filterDto);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  async findOne(@Param('id') id: string) {
    return this.beneficiariesService.findById(+id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async create(@Body() createDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(createDto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBeneficiaryDto,
  ) {
    return this.beneficiariesService.update(+id, updateDto);
  }

  @Post(':id/validate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  async validate(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user,
  ) {
    return this.beneficiariesService.validate(+id, { comment }, user.id);
  }
}
