import type { OfferStatus } from '../entities/offer.entity';

export class UpdateOfferStatusDto {
  status!: Exclude<OfferStatus, 'cancelled'>;
  sellerResponse?: string;
}
