import mongoose, { Schema, Document } from 'mongoose';

export interface IFormSubmission extends Document {
  formId: string;
  supervisorId: string;
  firstPhoto?: string;
  secondPhoto?: string;
  firstPhotoUrl?: string;
  secondPhotoUrl?: string;
  customerType: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
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
  // Geographic fields — API contract v1.3.0
  arcgisBuildingId?: string;
  lotCode?: string;
  lgaName?: string;
  lgaCode?: string;
  wardName?: string;
  wardCode?: string;
  stateCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
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
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },
  customerAddress: { type: String },
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
  // Geographic fields — API contract v1.3.0
  arcgisBuildingId: { type: String },
  lotCode: { type: String },
  lgaName: { type: String },
  lgaCode: { type: String },
  wardName: { type: String },
  wardCode: { type: String },
  stateCode: { type: String },
  country: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

export const FormSubmission = mongoose.models.FormSubmission || mongoose.model<IFormSubmission>('FormSubmission', FormSubmissionSchema, 'formsubmissions');
