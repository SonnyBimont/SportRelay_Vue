import type { OfferStatus } from '../entities/offer.entity';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateOfferStatusDto {
  @IsIn(['pending', 'accepted', 'rejected'])
  status!: Exclude<OfferStatus, 'cancelled'>;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  sellerResponse?: string;
}
