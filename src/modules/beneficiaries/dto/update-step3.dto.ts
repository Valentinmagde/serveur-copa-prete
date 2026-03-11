import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateStep3Dto {
  // ===== INFORMATIONS SUR LE PROJET =====
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectTitle?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectObjective?: string; // Nouveau champ

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  projectSectors?: string[]; // Nouveau champ - ['milk', 'poultry', 'fish', etc.]

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  otherSector?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mainActivities?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productsServices?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessIdea?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetClients?: string; // Nouveau champ

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  clientScope?: string[]; // Nouveau champ - ['local', 'national', 'eastAfrica', 'international']

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasCompetitors?: boolean; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  competitorNames?: string; // Nouveau champ

  // ===== EMPLOYÉS PRÉVUS =====
  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedEmployeesFemale?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedEmployeesMale?: number; // Nouveau champ

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedPermanentEmployees?: number; // Nouveau champ

  // ===== AUTRES INFORMATIONS =====
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isNewIdea?: boolean; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  climateActions?: string; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inclusionActions?: string; // Nouveau champ

  // ===== BUDGET =====
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasEstimatedCost?: boolean; // Nouveau champ

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.hasEstimatedCost === true)
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalProjectCost?: number; // Nouveau champ

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.hasEstimatedCost === true)
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedSubsidyAmount?: number; // Nouveau champ

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mainExpenses?: string; // Nouveau champ

  // ===== CONSENTEMENTS (existants) =====
  @ApiProperty({
    description: "Acceptation des Conditions Générales d'Utilisation",
    example: true,
  })
  @IsBoolean()
  acceptCGU: boolean;

  @ApiProperty({
    description: 'Acceptation de la Politique de Confidentialité',
    example: true,
  })
  @IsBoolean()
  acceptPrivacyPolicy: boolean;

  @ApiProperty({
    description: "Certification de l'exactitude des informations",
    example: true,
  })
  @IsBoolean()
  certifyAccuracy: boolean;

  @ApiProperty({
    description: 'Opt-in pour recevoir des notifications',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  optInNotifications?: boolean;

  @ApiProperty({
    description: 'Profil complet et soumis à la validation',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isProfileCompleted?: boolean;
}
