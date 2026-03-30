import { router, adminProcedure } from '../_core/trpc';
import { Customer, ICustomer } from '../models/Customer';
import { Company } from '../models/Company';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * Customers Router
 * Handles customer management with ownership tracking and bulk operations
 */
export const customersRouter = router({
  /**
   * List customers with filtering
   * Franchisor sees all customers (own + franchisees)
   * Franchisee sees only their own customers
   */
  list: adminProcedure
    .input(z.object({
      companyId: z.string().optional(), // Filter by company
      lotCode: z.string().optional(), // Filter by lot
      active: z.boolean().optional(), // Filter by status
      search: z.string().optional(), // Search by name/address
      page: z.number().default(1),
      limit: z.number().default(50),
      arcgisBuildingId: z.string().optional(), // Filter by ArcGIS polygon ID
    }))
    .query(async ({ input, ctx }) => {
      const { companyId, lotCode, active, search, page, limit, arcgisBuildingId } = input;
      
      // Build query filter
      const filter: any = {};
      
      // If specific company requested, filter by that
      if (companyId) {
        const company = await Company.findOne({ companyId });
        if (!company) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Company not found'
          });
        }
        
        // If franchisor, show own + franchisee customers
        if (company.companyType === 'franchisor') {
          const franchisees = await Company.find({ parentCompanyId: companyId });
          const franchiseeIds = franchisees.map(f => f.companyId);
          filter.ownerCompanyId = { $in: [companyId, ...franchiseeIds] };
        } else {
          filter.ownerCompanyId = companyId;
        }
      }
      
      if (lotCode) {
        filter.lotCode = lotCode;
      }
      
      if (active !== undefined) {
        filter.active = active;
      }
      
      if (search) {
        filter.$or = [
          { customerName: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      // ArcGIS Building ID filter — exact match for polygon-level queries
      if (arcgisBuildingId) {
        filter.arcgisBuildingId = arcgisBuildingId;
      }
      
      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [customers, total] = await Promise.all([
        Customer.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Customer.countDocuments(filter)
      ]);
      
      return {
        customers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }),

  /**
   * Get single customer by ID
   */
  getById: adminProcedure
    .input(z.object({
      customerId: z.string()
    }))
    .query(async ({ input }) => {
      const customer = await Customer.findOne({ customerId: input.customerId });
      
      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      return customer;
    }),

  /**
   * Create new customer
   */
  create: adminProcedure
    .input(z.object({
      customerName: z.string().min(1),
      address: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      lotCode: z.string(),
      customerType: z.enum(['residential', 'commercial']).default('residential'),
      ownerCompanyId: z.string() // Company that owns this customer
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify lot exists and get lot name
      const activeLots = require('../../shared/active_lots.json');
      const lot = activeLots.find((l: any) => l.Lot_ID === input.lotCode);
      
      if (!lot) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid lot code'
        });
      }
      
      // Verify owner company exists
      const ownerCompany = await Company.findOne({ companyId: input.ownerCompanyId });
      
      if (!ownerCompany) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Owner company not found'
        });
      }
      
      // Generate unique customer ID
      const customerId = `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Create customer
      const customer = await Customer.create({
        customerId,
        customerName: input.customerName,
        address: input.address,
        phone: input.phone,
        email: input.email,
        lotCode: input.lotCode,
        lotName: lot.ward_name || `Lot ${input.lotCode}`,
        customerType: input.customerType,
        servingCompanyId: input.ownerCompanyId, // Initially same as owner
        servingCompanyName: ownerCompany.companyName,
        ownerCompanyId: input.ownerCompanyId,
        ownerCompanyName: ownerCompany.companyName,
        pickups: [],
        totalPickups: 0,
        active: true,
        createdBy: ctx.user?.id || 'system'
      });
      
      return customer;
    }),

  /**
   * Update customer
   */
  update: adminProcedure
    .input(z.object({
      customerId: z.string(),
      customerName: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      lotCode: z.string().optional(),
      customerType: z.enum(['residential', 'commercial']).optional(),
      active: z.boolean().optional()
    }))
    .mutation(async ({ input }) => {
      const { customerId, ...updates } = input;
      
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      // If lot code changed, update lot name
      if (updates.lotCode && updates.lotCode !== customer.lotCode) {
        const activeLots = require('../../shared/active_lots.json');
        const lot = activeLots.find((l: any) => l.Lot_ID === updates.lotCode);
        
        if (!lot) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid lot code'
          });
        }
        
        (updates as any).lotName = lot.ward_name || `Lot ${updates.lotCode}`;
      }
      
      // Update customer
      Object.assign(customer, updates);
      await customer.save();
      
      return customer;
    }),

  /**
   * Delete customer (soft delete)
   */
  delete: adminProcedure
    .input(z.object({
      customerId: z.string()
    }))
    .mutation(async ({ input }) => {
      const customer = await Customer.findOne({ customerId: input.customerId });
      
      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      customer.active = false;
      await customer.save();
      
      return { success: true };
    }),

  /**
   * Transfer customer ownership
   * Used when franchisor intervenes or transfers back to franchisee
   */
  transfer: adminProcedure
    .input(z.object({
      customerId: z.string(),
      newOwnerCompanyId: z.string()
    }))
    .mutation(async ({ input }) => {
      const customer = await Customer.findOne({ customerId: input.customerId });
      
      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found'
        });
      }
      
      const newOwner = await Company.findOne({ companyId: input.newOwnerCompanyId });
      
      if (!newOwner) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New owner company not found'
        });
      }
      
      // Update ownership
      customer.ownerCompanyId = newOwner.companyId;
      customer.ownerCompanyName = newOwner.companyName;
      customer.servingCompanyId = newOwner.companyId;
      customer.servingCompanyName = newOwner.companyName;
      
      await customer.save();
      
      return customer;
    }),

  /**
   * Bulk upload customers from CSV
   */
  bulkUpload: adminProcedure
    .input(z.object({
      customers: z.array(z.object({
        customerName: z.string(),
        address: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        lotCode: z.string(),
        customerType: z.enum(['residential', 'commercial']).optional()
      })),
      ownerCompanyId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { customers: customersData, ownerCompanyId } = input;
      
      // Verify owner company
      const ownerCompany = await Company.findOne({ companyId: ownerCompanyId });
      
      if (!ownerCompany) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Owner company not found'
        });
      }
      
      // Load active lots
      const activeLots = require('../../shared/active_lots.json');
      
      const results = {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [] as string[]
      };
      
      for (const customerData of customersData) {
        try {
          // Validate lot
          const lot = activeLots.find((l: any) => l.Lot_ID === customerData.lotCode);
          
          if (!lot) {
            results.failed++;
            results.errors.push(`Invalid lot code: ${customerData.lotCode} for ${customerData.customerName}`);
            continue;
          }
          
          // Check if customer exists (by name + address)
          const existing = await Customer.findOne({
            customerName: customerData.customerName,
            address: customerData.address
          });
          
          if (existing) {
            // Update existing customer
            existing.phone = customerData.phone || existing.phone;
            existing.email = customerData.email || existing.email;
            existing.lotCode = customerData.lotCode;
            existing.lotName = lot.ward_name || `Lot ${customerData.lotCode}`;
            existing.customerType = customerData.customerType || existing.customerType;
            
            await existing.save();
            results.updated++;
          } else {
            // Create new customer
            const customerId = `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            await Customer.create({
              customerId,
              customerName: customerData.customerName,
              address: customerData.address,
              phone: customerData.phone,
              email: customerData.email,
              lotCode: customerData.lotCode,
              lotName: lot.ward_name || `Lot ${customerData.lotCode}`,
              customerType: customerData.customerType || 'residential',
              servingCompanyId: ownerCompanyId,
              servingCompanyName: ownerCompany.companyName,
              ownerCompanyId: ownerCompanyId,
              ownerCompanyName: ownerCompany.companyName,
              pickups: [],
              totalPickups: 0,
              active: true,
              createdBy: ctx.user?.id || 'system'
            });
            
            results.created++;
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Error processing ${customerData.customerName}: ${error.message}`);
        }
      }
      
      return results;
    }),

  /**
   * Get customer statistics for a company
   */
  stats: adminProcedure
    .input(z.object({
      companyId: z.string()
    }))
    .query(async ({ input }) => {
      const company = await Company.findOne({ companyId: input.companyId });
      
      if (!company) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Company not found'
        });
      }
      
      // Build filter based on company type
      let filter: any = {};
      
      if (company.companyType === 'franchisor') {
        const franchisees = await Company.find({ parentCompanyId: input.companyId });
        const franchiseeIds = franchisees.map(f => f.companyId);
        filter.ownerCompanyId = { $in: [input.companyId, ...franchiseeIds] };
      } else {
        filter.ownerCompanyId = input.companyId;
      }
      
      const [total, active, residential, commercial] = await Promise.all([
        Customer.countDocuments(filter),
        Customer.countDocuments({ ...filter, active: true }),
        Customer.countDocuments({ ...filter, customerType: 'residential' }),
        Customer.countDocuments({ ...filter, customerType: 'commercial' })
      ]);
      
      return {
        total,
        active,
        inactive: total - active,
        residential,
        commercial
      };
    })
});
