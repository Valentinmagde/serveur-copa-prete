import { ApiProperty } from '@nestjs/swagger';

export class BusinessPlanResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  referenceNumber: string;

  @ApiProperty()
  projectTitle: string;

  @ApiProperty()
  projectDescription: string;

  @ApiProperty()
  requestedFundingAmount: number;

  @ApiProperty()
  statusId: number;

  @ApiProperty()
  status: any;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
