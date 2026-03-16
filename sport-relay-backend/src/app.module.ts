import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductsModule } from './products/products.module';
import { Product } from './products/entities/product.entity';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: 'localhost',
      port: 5434,
      username: 'postgres',
      password: 'root',
      database: 'sport_relay_db',
      models: [Product],
      autoLoadModels: true,
      synchronize: true, // à Désactivez en production !
    }),
    ProductsModule,
  ],
})
export class AppModule {}
