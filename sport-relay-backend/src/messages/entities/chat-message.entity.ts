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

@Table
export class ChatMessage extends Model {
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
  declare senderId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare recipientId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare content: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare readAt: Date | null;

  @BelongsTo(() => Product, { foreignKey: 'productId', as: 'product' })
  declare product: Product;

  @BelongsTo(() => User, { foreignKey: 'senderId', as: 'sender' })
  declare sender: User;

  @BelongsTo(() => User, { foreignKey: 'recipientId', as: 'recipient' })
  declare recipient: User;
}
