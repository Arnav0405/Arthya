import mongoose, { Document, Schema } from 'mongoose';

export interface ICard extends Document {
  userId: mongoose.Types.ObjectId;
  cardNumber: string;
  cardType: 'paypal' | 'payeer' | 'debit' | 'credit';
  cardholderName: string;
  expiryDate: string;
  cvv?: string;
  balance: number;
  creditLimit?: number;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const cardSchema = new Schema<ICard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cardNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cardType: {
      type: String,
      enum: ['paypal', 'payeer', 'debit', 'credit'],
      required: true,
    },
    cardholderName: {
      type: String,
      required: true,
      trim: true,
    },
    expiryDate: {
      type: String,
      required: true,
    },
    cvv: {
      type: String,
      select: false,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditLimit: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ICard>('Card', cardSchema);
