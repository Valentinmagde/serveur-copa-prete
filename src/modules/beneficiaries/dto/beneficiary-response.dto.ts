import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class BeneficiaryResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  user: UserResponseDto;

  @ApiProperty()
  companyId: number;

  @ApiProperty()
  statusId: number;

  @ApiProperty()
  status: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
