import mongoose, { Schema, Document } from 'mongoose';

/**
 * Pickup Type Enum
 * Defines how a pickup was claimed
 */
export type PickupType = 'regular' | 'cherry-pick' | 'intervention';

/**
 * Pickup History Interface
 * Tracks individual pickup events for a customer
 */
export interface IPickupHistory {
  date: Date;
  pickedBy: string; // User ID who performed the pickup
  pickedByName: string; // User name for display
  companyId: string; // Company that claimed the pickup
  companyName: string; // Company name for display
  lotCode: string; // Lot where pickup occurred
  type: PickupType; // How the pickup was claimed
  paymentStatus: string; // e.g., "pending", "paid", "failed"
  webhookSent: boolean; // Whether webhook was successfully sent
  webhookResponse?: string; // Webhook response for debugging
  notes?: string; // Optional notes about the pickup
}

const pickupHistorySchema = new Schema<IPickupHistory>({
  date: { type: Date, required: true, default: Date.now },
  pickedBy: { type: String, required: true },
  pickedByName: { type: String, required: true },
  companyId: { type: String, required: true },
  companyName: { type: String, required: true },
  lotCode: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['regular', 'cherry-pick', 'intervention'],
    required: true 
  },
  paymentStatus: { 
    type: String, 
    required: true, 
    default: 'pending' 
  },
  webhookSent: { type: Boolean, default: false },
  webhookResponse: { type: String },
  notes: { type: String }
}, { _id: true, timestamps: true });

/**
 * Customer Document Interface
 * Represents a waste collection customer
 */
export interface ICustomer extends Document {
  _id: string;
  customerId: string; // Unique customer identifier
  customerName: string;
  address: string;
  phone?: string;
  email?: string;
  
  // Company assignment
  servingCompanyId: string; // Company currently servicing this customer
  servingCompanyName: string; // For display purposes
  ownerCompanyId: string; // Company that "owns" the customer relationship
  ownerCompanyName: string; // For display purposes
  
  // Lot assignment
  lotCode: string; // Which lot the customer is in
  lotName: string; // For display purposes
  
  // Customer type
  customerType: 'residential' | 'commercial' | 'industrial';
  
  // Building linkage (for property enumeration digitalization)
  buildingId?: string; // Linked building ID (null if not linked)
  linkedAt?: Date; // When customer was linked to building
  linkedBy?: string; // User ID who linked customer to building

  // Geographic fields (from ArcGIS enrichment)
  arcgisBuildingId?: string;
  lgaName?: string;
  lgaCode?: string;
  stateCode?: string;
  country?: string;
  wardCode?: string;
  wardName?: string;
  
  // Pickup history
  pickups: IPickupHistory[];
  lastPickupDate?: Date;
  totalPickups: number;
  
  // Status
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who added this customer
}

/**
 * Customer Schema
 * Manages customer data with ownership tracking
 */
const customerSchema = new Schema<ICustomer>({
  customerId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  
  // Company assignment
  servingCompanyId: { type: String, required: true },
  servingCompanyName: { type: String, required: true },
  ownerCompanyId: { type: String, required: true },
  ownerCompanyName: { type: String, required: true },
  
  // Lot assignment
  lotCode: { type: String, required: true },
  lotName: { type: String, required: true },
  
  // Customer type
  customerType: { 
    type: String, 
    enum: ['residential', 'commercial', 'industrial'],
    default: 'residential',
    required: true 
  },
  
  // Building linkage (for property enumeration digitalization)
  buildingId: { type: String }, // Linked building ID (null if not linked)
  linkedAt: { type: Date }, // When customer was linked to building
  linkedBy: { type: String }, // User ID who linked customer to building

  // Geographic fields (from ArcGIS enrichment via backend)
  arcgisBuildingId: { type: String, default: null },
  lgaName: { type: String, default: null },
  lgaCode: { type: String, default: null },
  stateCode: { type: String, default: null },
  country: { type: String, default: null },
  wardCode: { type: String, default: null },
  wardName: { type: String, default: null },
  
  // Pickup history
  pickups: [pickupHistorySchema],
  lastPickupDate: { type: Date },
  totalPickups: { type: Number, default: 0 },
  
  // Status
  active: { type: Boolean, default: true },
  // Backend compatibility aliases (mobile app uses these field names)
  companyId: { type: String }, // Alias for ownerCompanyId - used by mobile app search
  isActive: { type: Boolean }, // Alias for active - used by mobile app search
  phoneNumber: { type: String }, // Alias for phone - used by mobile app search
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true }
}, {
  timestamps: true
});

// Indexes for faster queries
customerSchema.index({ customerId: 1 });
customerSchema.index({ servingCompanyId: 1 });
customerSchema.index({ ownerCompanyId: 1 });
customerSchema.index({ lotCode: 1 });
customerSchema.index({ customerName: 1 });
customerSchema.index({ active: 1 });

// Compound index for common queries
customerSchema.index({ ownerCompanyId: 1, active: 1 });
customerSchema.index({ lotCode: 1, active: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
