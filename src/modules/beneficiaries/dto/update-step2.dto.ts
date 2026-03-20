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
  IsBoolean,
  IsEmail,
} from 'class-validator';

export class UpdateStep2Dto {
  @ApiProperty({
    description: "L'entreprise existe-t-elle déjà ?",
    enum: ['yes', 'no'],
    example: 'yes',
  })
  @IsIn(['yes', 'no'])
  companyExists: string;

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
  activityDescription?: string;

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

  @ApiProperty({
    description: "Type d'entreprise",
    enum: ['formal', 'informal', 'project'],
    example: 'formal',
  })
  @IsIn(['formal', 'informal', 'project'])
  companyStatus: string;

  // Adresse de l'entreprise (si différente)
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyNeighborhood?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyZone?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  companyProvinceId?: number; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  companyCommuneId?: number; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyPhone?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsEmail()
  companyEmail?: string; // Nouveau champ

  // Statut juridique (pour formelles)
  @ApiProperty({
    enum: ['snc', 'scs', 'sprl', 'su', 'sa', 'coop', 'other'],
    required: false,
  })
  @IsOptional()
  @IsIn(['snc', 'scs', 'sprl', 'su', 'sa', 'coop', 'other'])
  legalStatus?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalStatusOther?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  affiliatedToCGA?: boolean; // Nouveau champ - Affilié à un Centre de Gestion Agréé

  // Effectifs détaillés
  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  femaleEmployees?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maleEmployees?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  refugeeEmployees?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  batwaEmployees?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  disabledEmployees?: number; // Nouveau champ

  // Associés
  @ApiProperty({
    enum: ['solo', '2', '3', 'other'],
    required: false,
  })
  @IsOptional()
  @IsIn(['solo', '2', '3', 'other'])
  associatesCount?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  associatesCountOther?: string; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  femalePartners?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  malePartners?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  refugeePartners?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  batwaPartners?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  disabledPartners?: number; // Nouveau champ

  // Informations bancaires
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasBankAccount?: boolean; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasBankCredit?: boolean; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bankCreditAmount?: number; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  companyAddressIsDifferent?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  totalEmployees?: number;

  // Indicateurs (existants)
  @ApiProperty({
    description: 'Entreprise dirigée par une femme ?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isWomanLed?: boolean;

  @ApiProperty({
    description: 'Entreprise dirigée par un réfugié ?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRefugeeLed?: boolean;

  @ApiProperty({
    description: 'Entreprise à impact climatique positif ?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hasClimateImpact?: boolean;
}
