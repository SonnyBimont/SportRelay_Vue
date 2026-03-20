import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateOfferDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity?: number;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  message?: string;
}
