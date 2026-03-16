import { Column, Model, Table, DataType } from 'sequelize-typescript';

@Table
export class Product extends Model {
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
}
