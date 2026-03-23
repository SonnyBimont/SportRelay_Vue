import { IsInt, Min } from 'class-validator';

export class MarkConversationReadDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsInt()
  @Min(1)
  withUserId!: number;
}
