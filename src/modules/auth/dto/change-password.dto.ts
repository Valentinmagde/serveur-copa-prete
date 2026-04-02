import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty()
    @IsString()
    currentPassword: string;

    @ApiProperty()
    @IsString()
    @MinLength(8)
    @Matches(
        /[A-Z]/,
        { message: 'Le mot de passe doit contenir au moins une majuscule' },
    )
    @Matches(
        /[0-9]/,
        { message: 'Le mot de passe doit contenir au moins un chiffre' },
    )
    newPassword: string;
}
