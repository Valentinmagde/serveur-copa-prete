import { ApiProperty } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  originalFilename: string;

  @ApiProperty()
  fileSizeBytes: number;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  validationStatus: string;

  @ApiProperty()
  uploadedAt: Date;

  @ApiProperty()
  createdAt: Date;
}
