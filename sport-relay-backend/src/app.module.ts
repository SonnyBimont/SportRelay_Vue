import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { Order } from './orders/entities/order.entity';
import { Product } from './products/entities/product.entity';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    SequelizeModule.forRootAsync({
      useFactory: () => {
        const useSqliteFallback =
          (process.env.DB_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite';

        if (useSqliteFallback) {
          return {
            dialect: 'sqlite' as const,
            storage: process.env.DB_STORAGE ?? 'dev.sqlite',
            models: [User, Product, Order],
            autoLoadModels: true,
            synchronize: true,
            logging: false,
          };
        }

        return {
          dialect: 'postgres' as const,
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5434),
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'root',
          database: process.env.DB_NAME ?? 'sport_relay_db',
          models: [User, Product, Order],
          autoLoadModels: true,
          synchronize: true,
        };
      },
    }),
    UsersModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
  ],
})
export class AppModule {}
