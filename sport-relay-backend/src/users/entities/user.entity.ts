import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';

export type UserRole = 'buyer' | 'seller' | 'admin';

@Table
export class User extends Model {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare passwordHash: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare displayName: string;

  @Column({
    type: DataType.ENUM('buyer', 'seller', 'admin'),
    defaultValue: 'buyer',
  })
  declare role: UserRole;

  @HasMany(() => Product, { foreignKey: 'sellerId', as: 'productsForSale' })
  declare productsForSale: Product[];

  @HasMany(() => Order, { foreignKey: 'buyerId', as: 'orders' })
  declare orders: Order[];
}
