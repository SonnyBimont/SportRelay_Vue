import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(5, 3000)
  description!: string;

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  price!: number;

  @IsOptional()
  @IsIn(['neuf', 'occasion', 'reconditionne', 'reconditionné'])
  condition?: string;

  @IsString()
  @Length(2, 80)
  category!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  stock?: number;

  @Matches(/^(https?:\/\/[^\s]+|\/uploads\/[^\s]+)$/i, {
    message:
      'imageUrl must be an http(s) URL or a /uploads/... path',
  })
  imageUrl!: string;
}
