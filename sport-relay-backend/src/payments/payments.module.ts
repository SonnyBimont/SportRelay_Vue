import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { Offer } from '../offers/entities/offer.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    AuthModule,
    RealtimeModule,
    SequelizeModule.forFeature([Product, Offer, Order]),
  ],
  controllers: [PaymentsController],
  providers: [],
})
export class PaymentsModule {}
