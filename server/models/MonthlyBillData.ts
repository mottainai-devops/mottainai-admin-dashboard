import mongoose, { Schema, Document } from 'mongoose';

export interface IMonthlyBillData extends Document {
  userId: string;
  month: string;
  status: string; // "true" or "false" as string
  amount: number;
  quantity: number;
  nameBin: string;
  splitCode: string;
  buildingId: string;
  quickbookInvoices?: string;
  transcationId?: string;
  isMonthly: boolean;
}

const MonthlyBillDataSchema = new Schema<IMonthlyBillData>({
  userId: { type: String, required: true },
  month: { type: String, required: true },
  status: { type: String, required: true },
  amount: { type: Number, required: true },
  quantity: { type: Number, required: true },
  nameBin: { type: String, required: true },
  splitCode: { type: String, required: true },
  buildingId: { type: String, required: true },
  quickbookInvoices: { type: String },
  transcationId: { type: String },
  isMonthly: { type: Boolean, required: true },
});

export const MonthlyBillData = mongoose.model<IMonthlyBillData>('MonthlyBillData', MonthlyBillDataSchema, 'monthlybilldatas');
