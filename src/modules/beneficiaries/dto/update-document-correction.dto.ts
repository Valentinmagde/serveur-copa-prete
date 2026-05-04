import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDocumentCorrectionDto {
  @IsOptional()
  @IsBoolean()
  documentCorrectionAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  documentsCorrected?: boolean;

  @IsOptional()
  @IsBoolean()
  hasSubmitDocumentsCorrected?: boolean;
}
