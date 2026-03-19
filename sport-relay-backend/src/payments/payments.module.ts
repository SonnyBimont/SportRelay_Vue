import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [PaymentsController],
  providers: [],
})
export class PaymentsModule {}
