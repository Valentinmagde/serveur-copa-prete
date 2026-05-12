import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ example: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  anonymous: boolean;

  @ApiProperty({ required: false, example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: 'jean@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '+257 123 456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Demande d\'information' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Votre message ici...' })
  @IsNotEmpty()
  @IsString()
  message: string;
}
