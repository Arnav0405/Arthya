import mongoose, { Document, Schema } from 'mongoose';

export interface IGoal extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  icon?: string;
  category: 'savings' | 'purchase' | 'investment' | 'debt' | 'other';
  deadline?: Date;
  status: 'active' | 'completed' | 'cancelled';
  milestones?: {
    amount: number;
    date: Date;
    achieved: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    icon: {
      type: String,
      default: 'star',
    },
    category: {
      type: String,
      enum: ['savings', 'purchase', 'investment', 'debt', 'other'],
      default: 'other',
    },
    deadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    milestones: [
      {
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          required: true,
        },
        achieved: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Auto-update status when target is reached
goalSchema.pre('save', function (next) {
  if (this.currentAmount >= this.targetAmount && this.status === 'active') {
    this.status = 'completed';
  }
  next();
});

export default mongoose.model<IGoal>('Goal', goalSchema);
