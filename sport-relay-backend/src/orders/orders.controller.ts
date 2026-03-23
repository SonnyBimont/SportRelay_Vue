import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles('buyer', 'seller', 'admin')
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.sub, dto);
  }

  @Roles('buyer', 'seller', 'admin')
  @Get('my')
  myOrders(@CurrentUser() user: JwtUser) {
    return this.ordersService.findMyOrders(user.sub);
  }

  @Roles('seller', 'admin')
  @Get('sales')
  sales(@CurrentUser() user: JwtUser) {
    return this.ordersService.findSalesForSeller(user.sub);
  }
}
