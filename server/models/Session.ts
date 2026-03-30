import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: string;
  lotCode: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
  };
  startTime: Date;
  endTime?: Date;
  notes: string;
  status: 'active' | 'ended';
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    lotCode: {
      type: String,
      required: true,
      index: true,
    },
    startLocation: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },
    endLocation: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding active sessions by user
SessionSchema.index({ userId: 1, status: 1 });

// Index for querying sessions by lot
SessionSchema.index({ lotCode: 1, startTime: -1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
