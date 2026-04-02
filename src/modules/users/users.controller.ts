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
  HttpStatus,
  HttpCode,
  ValidationPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserFilterDto } from './dto/user-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserConsentDto } from './dto/user-consent.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  async findAll(@Query() filterDto: UserFilterDto) {
    return this.usersService.findAll(filterDto);
  }

  @Get('admin-staff')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER')
  @ApiOperation({
    summary: 'Liste des utilisateurs staff (rôles admin/internes)',
  })
  async findAdminStaff(@Query() filterDto: UserFilterDto) {
    return this.usersService.findAllWithFilters(filterDto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getProfile(@CurrentUser() user) {
    return this.usersService.findById(user.id, [
      'gender',
      'primaryAddress',
      'beneficiary',
      'beneficiary.company',
    ]);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(+id, ['gender', 'primaryAddress']);
  }

  /**
   * Créer un nouvel utilisateur (admin seulement)
   */
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  async createUser(
    @Body(new ValidationPipe()) createUserDto: CreateUserDto,
    @CurrentUser() currentUser: any,
  ): Promise<UserResponseDto> {
    return this.usersService.createUserWithRole(createUserDto, currentUser.id);
  }

  /**
   * Créer plusieurs utilisateurs (admin seulement)
   */
  @Post('bulk')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Créer plusieurs utilisateurs' })
  @ApiResponse({ status: 201, type: [UserResponseDto] })
  async createMultipleUsers(
    @Body(new ValidationPipe()) createUsersDto: CreateUserDto[],
    @CurrentUser() currentUser: any,
  ): Promise<UserResponseDto[]> {
    return this.usersService.createMultipleUsers(
      createUsersDto,
      currentUser.id,
    );
  }
  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  async delete(@Param('id') id: string) {
    await this.usersService.delete(+id);
  }

  @Post(':id/roles')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  async assignRole(
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    await this.usersService.assignRole(+id, assignRoleDto.roleCode);
    return { message: 'Role assigned successfully' };
  }

  @Delete(':id/roles/:roleCode')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 204, description: 'Role removed' })
  async removeRole(
    @Param('id') id: string,
    @Param('roleCode') roleCode: string,
  ) {
    await this.usersService.removeRole(+id, roleCode);
  }

  @Get(':id/roles')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiResponse({ status: 200 })
  async getUserRoles(@Param('id') id: string) {
    const roles = await this.usersService.getUserRoles(+id);
    return { roles };
  }

  @Post(':id/consents')
  @ApiOperation({ summary: 'Save user consent' })
  @ApiResponse({ status: 201 })
  async saveConsent(
    @Param('id') id: string,
    @Body() consentDto: UserConsentDto,
    @CurrentUser() user,
  ) {
    return this.usersService.saveConsent(
      +id,
      consentDto.consentTypeId,
      consentDto.value,
      user.ip,
      user.userAgent,
    );
  }

  @Get(':id/consents')
  @ApiOperation({ summary: 'Get user consents' })
  @ApiResponse({ status: 200 })
  async getUserConsents(@Param('id') id: string) {
    return this.usersService.getUserConsents(+id);
  }

  @Post(':id/block')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Block user' })
  @ApiResponse({ status: 200 })
  async blockUser(@Param('id') id: string) {
    return this.usersService.toggleUserBlock(+id, true);
  }

  @Post(':id/unblock')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Unblock user' })
  @ApiResponse({ status: 200 })
  async unblockUser(@Param('id') id: string) {
    return this.usersService.toggleUserBlock(+id, false);
  }

  @Post(':id/verify')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Verify user' })
  @ApiResponse({ status: 200 })
  async verifyUser(@Param('id') id: string) {
    return this.usersService.verifyUser(+id);
  }

  /**
   * Uploader un avatar pour l'utilisateur connecté
   */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: `Uploader un avatar pour l'utilisateur connecté` })
  @ApiResponse({ status: 200, description: 'Avatar uploadé avec succès' })
  async uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return this.usersService.uploadAvatar(user.id, file);
  }

  /**
   * Supprimer l'avatar de l'utilisateur connecté
   */
  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: `Supprimer l'avatar de l'utilisateur connecté` })
  async deleteMyAvatar(@CurrentUser() user) {
    await this.usersService.deleteAvatar(user.id);
    return { message: 'Avatar supprimé avec succès' };
  }

  /**
   * Mettre à jour son propre profil
   */
  @Put('me')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mettre à jour son propre profil' })
  async updateMyProfile(
    @CurrentUser() user,
    @Body() updateDto: UpdateUserDto,
    @UploadedFile() avatarFile?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(user.id, updateDto, avatarFile);
  }

  /**
   * Uploader un avatar pour un utilisateur spécifique (admin seulement)
   */
  @Post(':id/avatar')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader un avatar pour un utilisateur (admin)' })
  async uploadUserAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return this.usersService.uploadAvatar(+id, file);
  }

  /**
   * Supprimer l'avatar d'un utilisateur (admin seulement)
   */
  @Delete(':id/avatar')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: `Supprimer l'avatar d'un utilisateur (admin)` })
  async deleteUserAvatar(@Param('id') id: string) {
    await this.usersService.deleteAvatar(+id);
    return { message: 'Avatar supprimé avec succès' };
  }
}
