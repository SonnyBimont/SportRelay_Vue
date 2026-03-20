import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity?: number;
}
