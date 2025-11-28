import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import User from './User';

@Table({
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isRead', 'createdAt'] },
  ],
})
export default class Notification extends Model {
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
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  message!: string;

  @Column({
    type: DataType.ENUM('info', 'warning', 'success', 'alert'),
    defaultValue: 'info',
  })
  type!: 'info' | 'warning' | 'success' | 'alert';

  @Column({
    type: DataType.ENUM('transaction', 'goal', 'coaching', 'system'),
    allowNull: false,
  })
  category!: 'transaction' | 'goal' | 'coaching' | 'system';

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isRead!: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  actionUrl?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  metadata?: Record<string, any>;
}
