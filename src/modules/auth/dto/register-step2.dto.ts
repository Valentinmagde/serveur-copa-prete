import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  ValidateIf,
  IsNumber,
  Matches,
} from 'class-validator';

export class RegistrationStep2Dto {
  @ApiProperty({
    description: "L'entreprise existe-t-elle déjà ?",
    enum: ['yes', 'no'],
    example: 'yes',
  })
  @IsIn(['yes', 'no'])
  companyExists: string; // 'yes' ou 'no'

  // Champs conditionnels - UNIQUEMENT si companyExists = 'yes'
  @ApiProperty({ required: false, example: 'ABC SARL' })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsString()
  @MinLength(2)
  companyName?: string;

  @ApiProperty({ required: false, example: '123456789' })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsString()
  @Matches(/^\d{9,13}$/, {
    message: 'NIF doit contenir entre 9 et 13 chiffres',
  })
  nif?: string;

  @ApiProperty({ required: false, example: 2020 })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  creationYear?: number;

  @ApiProperty({
    required: false,
    description: "Secteur d'activité principal",
    example: 5,
  })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsInt()
  sectorId?: number;

  @ApiProperty({
    required: false,
    example: 'Entreprise spécialisée dans la transformation agricole...',
  })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsString()
  @MinLength(20)
  description?: string;

  @ApiProperty({ required: false, example: 5 })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsInt()
  @Min(0)
  employeeCount?: number;

  @ApiProperty({
    required: false,
    description: "Chiffre d'affaires annuel en BIF",
    example: 15000000,
  })
  @ValidateIf((o) => o.companyExists === 'yes')
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  // Informations complémentaires pour la fenêtre de candidature
  @ApiProperty({
    description: "Type d'entreprise",
    enum: ['formal', 'informal'],
    example: 'formal',
  })
  @IsIn(['formal', 'informal'])
  companyType: string; // 'formal' ou 'informal'

  @ApiProperty({
    description: 'Entreprise dirigée par une femme ?',
    default: false,
  })
  @IsOptional()
  isWomanLed?: boolean;

  @ApiProperty({
    description: 'Entreprise dirigée par un réfugié ?',
    default: false,
  })
  @IsOptional()
  isRefugeeLed?: boolean;

  @ApiProperty({
    description: 'Entreprise à impact climatique positif ?',
    default: false,
  })
  @IsOptional()
  hasClimateImpact?: boolean;
}
