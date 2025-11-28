import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import User from './User';

@Table({
  tableName: 'cards',
  timestamps: true,
  indexes: [{ fields: ['userId'] }],
})
export default class Card extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  cardNumber!: string;

  @Column({
    type: DataType.ENUM('paypal', 'payeer', 'debit', 'credit'),
    allowNull: false,
  })
  cardType!: 'paypal' | 'payeer' | 'debit' | 'credit';

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  cardholderName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  expiryDate!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  cvv?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: 0,
    },
  })
  balance!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  creditLimit?: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isPrimary!: boolean;
}
