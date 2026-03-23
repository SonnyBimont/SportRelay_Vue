import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsInt()
  @Min(1)
  recipientId!: number;

  @IsString()
  @Length(1, 5000)
  content!: string;
}
