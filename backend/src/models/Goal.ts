import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import User from './User';

@Table({
  tableName: 'goals',
  timestamps: true,
  indexes: [{ fields: ['userId'] }],
})
export default class Goal extends Model {
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
    allowNull: true,
  })
  description?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  })
  targetAmount!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: 0,
    },
  })
  currentAmount!: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'star',
  })
  icon?: string;

  @Column({
    type: DataType.ENUM('savings', 'purchase', 'investment', 'debt', 'other'),
    defaultValue: 'other',
  })
  category!: 'savings' | 'purchase' | 'investment' | 'debt' | 'other';

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  deadline?: Date;

  @Column({
    type: DataType.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active',
  })
  status!: 'active' | 'completed' | 'cancelled';

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  milestones?: {
    amount: number;
    date: Date;
    achieved: boolean;
  }[];
}
