import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Offer } from '../offers/entities/offer.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [SequelizeModule.forFeature([Order, Product, User, Offer])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
