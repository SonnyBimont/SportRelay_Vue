export class CreateOfferDto {
  productId!: number;
  amount!: number;
  quantity?: number;
  message?: string;
}
