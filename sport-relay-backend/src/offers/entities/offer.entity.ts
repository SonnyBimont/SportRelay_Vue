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

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'paid';

@Table
export class Offer extends Model {
  @ForeignKey(() => Product)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare productId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare buyerId: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  declare quantity: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare message: string | null;

  @Column({
    type: DataType.ENUM('pending', 'accepted', 'rejected', 'cancelled', 'paid'),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: OfferStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare sellerResponse: string | null;

  @BelongsTo(() => Product, { foreignKey: 'productId', as: 'product' })
  declare product: Product;

  @BelongsTo(() => User, { foreignKey: 'buyerId', as: 'buyer' })
  declare buyer: User;
}
