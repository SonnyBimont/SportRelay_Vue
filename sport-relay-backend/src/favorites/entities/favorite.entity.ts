import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Index,
  Model,
  Table,
} from 'sequelize-typescript';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';

@Table
export class Favorite extends Model {
  @Index({ name: 'favorites_user_product_unique', unique: true })
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare userId: number;

  @Index({ name: 'favorites_user_product_unique', unique: true })
  @ForeignKey(() => Product)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare productId: number;

  @BelongsTo(() => User, { foreignKey: 'userId', as: 'user' })
  declare user: User;

  @BelongsTo(() => Product, { foreignKey: 'productId', as: 'product' })
  declare product: Product;
}
