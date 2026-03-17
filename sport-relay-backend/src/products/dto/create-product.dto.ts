export class CreateProductDto {
  name!: string;
  description!: string;
  price!: number;
  condition?: string;
  category!: string;
  stock?: number;
  imageUrl!: string;
}
