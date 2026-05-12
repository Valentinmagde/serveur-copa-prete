import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
@ApiTags('contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Public()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactsService.findAll({
      search,
      status: status as any,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.findById(id);
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.markAsRead(id);
  }

  @Post(':id/respond')
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  respond(
    @Param('id', ParseIntPipe) id: number,
    @Body('response') response: string,
  ) {
    return this.contactsService.respond(id, response);
  }

  @Patch(':id/close')
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  close(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.close(id);
  }
}
