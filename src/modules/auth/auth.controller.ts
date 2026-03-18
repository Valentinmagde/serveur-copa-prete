import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { Throttle } from '@nestjs/throttler';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { RegistrationStep1Dto } from './dto/register-step1.dto';
import { RegistrationMpmeDto } from './dto/register-mpme.dto';
import { ValidateResetTokenDto } from './entities/validate-reset-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new beneficiary' })
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
  @ApiResponse({
    status: 201,
    description: 'Beneficiary successfully registered',
  })
  async register(
    @Body() registerDto: any,
    @Headers('x-forwarded-for') ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  @Public()
  @Post('register-mpme')
  @ApiOperation({ summary: 'Register a new beneficiary' })
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
  @ApiResponse({
    status: 201,
    description: 'Beneficiary successfully registered',
  })
  async registerMpme(
    @Body() registerDto: RegistrationMpmeDto,
    @Headers('x-forwarded-for') ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.registerMpme(registerDto, ipAddress, userAgent);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Request() req) {
    // Les informations d'IP et user-agent sont déjà capturées dans la stratégie locale
    return this.authService.login(req.user, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  async logout(
    @CurrentUser() user,
    @Body('refreshToken') refreshToken: string,
  ) {
    return this.authService.logout(user.id, refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // @Public()
  // @Post('reset-password')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Reset password with token' })
  // async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
  //   return this.authService.resetPassword(
  //     resetPasswordDto.token,
  //     resetPasswordDto.newPassword,
  //   );
  // }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user) {
    return this.authService.getProfile(user.id);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  // @Throttle(5, 60) // 5 tentatives par minute
  @ApiOperation({ summary: "Vérifier l'email avec un token" })
  @ApiResponse({ status: 200, description: 'Email vérifié avec succès' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    await this.authService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.token,
    );

    return {
      success: true,
      message: 'Email vérifié avec succès',
    };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  // @Throttle(3, 300) // 3 tentatives toutes les 5 minutes
  @ApiOperation({ summary: "Renvoyer l'email de vérification" })
  @ApiResponse({ status: 200, description: 'Email renvoyé avec succès' })
  @ApiResponse({ status: 400, description: 'Email déjà vérifié' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    await this.authService.resendVerification(resendDto.email);

    return {
      success: true,
      message: 'Email de vérification renvoyé avec succès',
    };
  }

  @Public()
  @Post('validate-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate reset token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  async validateResetToken(@Body() validateTokenDto: ValidateResetTokenDto) {
    const isValid = await this.authService.validateResetToken(
      validateTokenDto.token,
      validateTokenDto.email,
    );

    return {
      valid: isValid,
      message: isValid ? 'Token valide' : 'Token invalide ou expiré',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password successfully reset',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token or weak password',
  })
  @ApiHeader({
    name: 'x-forwarded-for',
    description: 'Client IP address',
    required: false,
  })
  @ApiHeader({
    name: 'user-agent',
    description: 'User agent header',
    required: false,
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Headers('x-forwarded-for') ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      ipAddress,
      userAgent,
    );
  }
}
