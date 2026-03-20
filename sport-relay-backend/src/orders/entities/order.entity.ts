import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled';

@Table
export class Order extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare buyerId: number;

  @ForeignKey(() => Product)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare productId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  declare quantity: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare totalPrice: number;

  @Column({
    type: DataType.ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled'),
    defaultValue: 'pending',
  })
  declare status: OrderStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare stripeSessionId: string | null;

  @BelongsTo(() => User, { foreignKey: 'buyerId', as: 'buyer' })
  declare buyer: User;

  @BelongsTo(() => Product, { foreignKey: 'productId', as: 'product' })
  declare product: Product;
}
