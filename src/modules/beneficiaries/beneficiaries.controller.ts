import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BeneficiariesService } from './beneficiaries.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BeneficiaryFilterDto } from './dto/beneficiary-filter.dto';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('beneficiaries')
@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) { }

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

  @Get(':id/candidature')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  async getCompleteBeneficiaryData(@Param('id') id: string) {
    return this.beneficiariesService.getCompleteBeneficiaryData(+id);
  }

  @Get('user/:userId')
  // @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  async findByUserId(@Param('userId') userId: string) {
    return this.beneficiariesService.findByUserId(+userId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async create(@Body() createDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(createDto);
  }

  @Put(':id')
  // @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiHeader({
    name: 'x-forwarded-for',
    description: 'Client IP address',
    required: false,
    schema: { default: '127.0.0.1' },
  })
  @ApiHeader({
    name: 'user-agent',
    description: 'User agent header',
    required: false,
    schema: { default: 'Swagger-UI' },
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Headers('x-forwarded-for') ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.beneficiariesService.update(
      id,
      updateDto,
      ipAddress,
      userAgent,
    );
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

  @Post(':id/preselect')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Présélectionner un bénéficiaire' })
  async preselect(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user,
  ) {
    return this.beneficiariesService.preselect(+id, comment, user.id);
  }

  @Post(':id/select')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Sélectionner définitivement un bénéficiaire' })
  async select(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user,
  ) {
    return this.beneficiariesService.select(+id, comment, user.id);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Rejeter un bénéficiaire' })
  async reject(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user,
  ) {
    return this.beneficiariesService.reject(+id, comment, user.id);
  }

  @Patch(':id/submit-correction')
  @ApiOperation({ summary: 'Soumettre la correction de documents' })
  @ApiParam({ name: 'id', type: Number })
  async submitDocumentCorrection(@Param('id', ParseIntPipe) id: number) {
    return this.beneficiariesService.submitDocumentCorrection(id);
  }

  @Patch(':id/comment')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({ summary: 'Modifier le commentaire de statut' })
  @ApiParam({ name: 'id', type: Number })
  async updateComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.beneficiariesService.updateComment(id, dto);
  }
}
