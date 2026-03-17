import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { ChatMessage } from '../../messages/entities/chat-message.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

@Table
export class Product extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare sellerId: number | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare price: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'occasion', // 'neuf', 'occasion', 'reconditionné'
  })
  declare condition: string;

  @Column(DataType.STRING)
  declare category: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
  })
  declare stock: number;

  @Column(DataType.STRING)
  declare imageUrl: string;

  @BelongsTo(() => User, { foreignKey: 'sellerId', as: 'seller' })
  declare seller: User;

  @HasMany(() => Order, { foreignKey: 'productId', as: 'orders' })
  declare orders: Order[];

  @HasMany(() => Offer, { foreignKey: 'productId', as: 'offers' })
  declare offers: Offer[];

  @HasMany(() => ChatMessage, { foreignKey: 'productId', as: 'messages' })
  declare messages: ChatMessage[];
}
