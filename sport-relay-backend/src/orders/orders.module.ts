import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [SequelizeModule.forFeature([Order, Product, User])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
