import mongoose, { Schema, Document } from 'mongoose';

export interface IFormSubmission extends Document {
  formId: string;
  supervisorId: string;
  firstPhoto?: string;
  secondPhoto?: string;
  firstPhotoUrl?: string;
  secondPhotoUrl?: string;
  customerType: string;
  socioClass?: string;
  binType: string;
  wheelieBinType?: string;
  binQuantity: number;
  buildingId: string;
  pickUpDate: string;
  pickupDate?: Date;
  incidentReport?: string;
  userId: string;
  amount?: number;
  companyId?: string;
  companyName?: string;
  zohoInvoiceId?: string;
  zohoSyncStatus?: string;
  createdAt: Date;
  updatedAt?: Date;
}

const FormSubmissionSchema = new Schema<IFormSubmission>({
  formId: { type: String, required: true },
  supervisorId: { type: String },
  firstPhoto: { type: String },
  secondPhoto: { type: String },
  firstPhotoUrl: { type: String },
  secondPhotoUrl: { type: String },
  customerType: { type: String, required: true },
  socioClass: { type: String },
  binType: { type: String, required: true },
  wheelieBinType: { type: String },
  binQuantity: { type: Number, required: true },
  buildingId: { type: String, required: true },
  pickUpDate: { type: String, required: true },
  pickupDate: { type: Date },
  incidentReport: { type: String },
  userId: { type: String, required: true },
  amount: { type: Number },
  companyId: { type: String },
  companyName: { type: String },
  zohoInvoiceId: { type: String },
  zohoSyncStatus: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

export const FormSubmission = mongoose.models.FormSubmission || mongoose.model<IFormSubmission>('FormSubmission', FormSubmissionSchema, 'formsubmissions');
