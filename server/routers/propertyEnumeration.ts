import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getMongoDb } from "../mongodb";
import { Types } from "mongoose";
const { ObjectId } = Types;

/**
 * Property Enumeration Router
 * 
 * Provides endpoints for property enumeration management:
 * - Buildings management
 * - Enumeration sessions tracking
 * - Property analytics
 * - ArcGIS sync monitoring
 */

export const propertyEnumerationRouter = router({
  /**
   * Get all buildings with pagination and filters
   */
  getBuildings: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        companyId: z.string().optional(),
        lotCode: z.string().optional(),
        propertyType: z.string().optional(),
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        syncStatus: z.enum(["synced", "pending", "all"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection("buildings");

      const { page, limit, companyId, lotCode, propertyType, search, startDate, endDate, syncStatus } = input;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { isActive: true };

      // Role-based filtering
      if (ctx.user.role === "user" && ctx.user.companyId) {
        query.companyId = ctx.user.companyId;
      } else if (companyId) {
        query.companyId = companyId;
      }

      if (lotCode) {
        query.lotCode = lotCode;
      }

      if (propertyType) {
        query.propertyType = propertyType;
      }

      if (search) {
        query.$or = [
          { buildingId: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
          { buildingName: { $regex: search, $options: "i" } },
          { arcgisBuildingId: { $regex: search, $options: "i" } },
        ];
      }

      if (startDate || endDate) {
        query.enumeratedAt = {};
        if (startDate) query.enumeratedAt.$gte = new Date(startDate);
        if (endDate) query.enumeratedAt.$lte = new Date(endDate);
      }

      if (syncStatus && syncStatus !== "all") {
        query.syncedToArcGIS = syncStatus === "synced";
      }

      // Execute query
      const [buildings, total] = await Promise.all([
        buildingsCollection
          .find(query)
          .sort({ enumeratedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        buildingsCollection.countDocuments(query),
      ]);

      // Get enumerator details
      const usersCollection = db.collection("users");
      const enumeratorIds = [...new Set(buildings.map((b: any) => b.enumeratorId).filter(Boolean))];
      const enumerators = await usersCollection
        .find({ _id: { $in: enumeratorIds } })
        .project({ fullName: 1, email: 1 })
        .toArray();

      const enumeratorMap = new Map(enumerators.map((e: any) => [e._id.toString(), e]));

      // Enrich buildings with enumerator info
      const enrichedBuildings = buildings.map((building: any) => ({
        ...building,
        _id: building._id.toString(),
        enumerator: building.enumeratorId
          ? enumeratorMap.get(building.enumeratorId.toString())
          : null,
      }));

      return {
        buildings: enrichedBuildings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }),

  /**
   * Get building details by ID
   */
  getBuildingById: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection("buildings");
      const building = await buildingsCollection.findOne({
        _id: new ObjectId(input.buildingId),
      });

      if (!building) {
        throw new Error("Building not found");
      }

      // Role-based access control
      if (ctx.user.role === "user" && building.companyId !== ctx.user.companyId) {
        throw new Error("Access denied");
      }

      // Get enumerator details
      if (building.enumeratorId) {
        const usersCollection = db.collection("users");
        const enumerator = await usersCollection.findOne(
          { _id: building.enumeratorId },
          { projection: { fullName: 1, email: 1, phone: 1 } }
        );
        building.enumerator = enumerator;
      }

      // Get linked customers
      if (building.linkedCustomerIds && building.linkedCustomerIds.length > 0) {
        const customersCollection = db.collection("customers");
        const customers = await customersCollection
          .find({ customerId: { $in: building.linkedCustomerIds } })
          .toArray();
        building.linkedCustomers = customers;
      }

      return {
        ...building,
        _id: building._id.toString(),
      };
    }),

  /**
   * Get enumeration sessions with pagination and filters
   */
  getSessions: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        companyId: z.string().optional(),
        lotCode: z.string().optional(),
        userId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getMongoDb();
      const sessionsCollection = db.collection("enumerationsessions");

      const { page, limit, companyId, lotCode, userId, startDate, endDate, isActive } = input;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      // Role-based filtering
      if (ctx.user.role === "user" && ctx.user.companyId) {
        query.companyId = ctx.user.companyId;
      } else if (companyId) {
        query.companyId = companyId;
      }

      if (lotCode) {
        query.lotCode = lotCode;
      }

      if (userId) {
        query.userId = new ObjectId(userId);
      }

      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
      }

      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      // Execute query
      const [sessions, total] = await Promise.all([
        sessionsCollection
          .find(query)
          .sort({ startTime: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        sessionsCollection.countDocuments(query),
      ]);

      // Get user details
      const usersCollection = db.collection("users");
      const userIds = [...new Set(sessions.map((s: any) => s.userId).filter(Boolean))];
      const users = await usersCollection
        .find({ _id: { $in: userIds } })
        .project({ fullName: 1, email: 1 })
        .toArray();

      const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

      // Enrich sessions with user info
      const enrichedSessions = sessions.map((session: any) => ({
        ...session,
        _id: session._id.toString(),
        user: session.userId ? userMap.get(session.userId.toString()) : null,
      }));

      return {
        sessions: enrichedSessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }),

  /**
   * Get property enumeration analytics overview
   */
  getAnalyticsOverview: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection("buildings");
      const sessionsCollection = db.collection("enumerationsessions");
      const customersCollection = db.collection("customers");

      const { companyId, startDate, endDate } = input;

      // Build base query
      const query: any = { isActive: true };

      // Role-based filtering
      if (ctx.user.role === "user" && ctx.user.companyId) {
        query.companyId = ctx.user.companyId;
      } else if (companyId) {
        query.companyId = companyId;
      }

      // Date range filter
      if (startDate || endDate) {
        query.enumeratedAt = {};
        if (startDate) query.enumeratedAt.$gte = new Date(startDate);
        if (endDate) query.enumeratedAt.$lte = new Date(endDate);
      }

      // Get total buildings
      const totalBuildings = await buildingsCollection.countDocuments(query);

      // Get buildings by property type
      const buildingsByType = await buildingsCollection
        .aggregate([
          { $match: query },
          { $group: { _id: "$propertyType", count: { $sum: 1 } } },
        ])
        .toArray();

      // Get buildings by company
      const buildingsByCompany = await buildingsCollection
        .aggregate([
          { $match: query },
          { $group: { _id: "$companyId", count: { $sum: 1 } } },
        ])
        .toArray();

      // Get buildings by lot
      const buildingsByLot = await buildingsCollection
        .aggregate([
          { $match: query },
          { $group: { _id: "$lotCode", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
        .toArray();

      // Get ArcGIS sync status
      const syncedBuildings = await buildingsCollection.countDocuments({
        ...query,
        syncedToArcGIS: true,
      });
      const pendingSyncBuildings = totalBuildings - syncedBuildings;

      // Get total sessions
      const sessionQuery: any = {};
      if (ctx.user.role === "user" && ctx.user.companyId) {
        sessionQuery.companyId = ctx.user.companyId;
      } else if (companyId) {
        sessionQuery.companyId = companyId;
      }
      if (startDate || endDate) {
        sessionQuery.startTime = {};
        if (startDate) sessionQuery.startTime.$gte = new Date(startDate);
        if (endDate) sessionQuery.startTime.$lte = new Date(endDate);
      }

      const totalSessions = await sessionsCollection.countDocuments(sessionQuery);
      const activeSessions = await sessionsCollection.countDocuments({
        ...sessionQuery,
        isActive: true,
      });

      // Get customer linking stats
      const customerQuery: any = {};
      if (ctx.user.role === "user" && ctx.user.companyId) {
        customerQuery.companyId = ctx.user.companyId;
      } else if (companyId) {
        customerQuery.companyId = companyId;
      }

      const totalCustomers = await customersCollection.countDocuments(customerQuery);
      const linkedCustomers = await customersCollection.countDocuments({
        ...customerQuery,
        isDigitalized: true,
      });

      // Get daily enumeration trend (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyTrend = await buildingsCollection
        .aggregate([
          {
            $match: {
              ...query,
              enumeratedAt: { $gte: thirtyDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$enumeratedAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      return {
        summary: {
          totalBuildings,
          syncedBuildings,
          pendingSyncBuildings,
          totalSessions,
          activeSessions,
          totalCustomers,
          linkedCustomers,
          unlinkCustomers: totalCustomers - linkedCustomers,
        },
        buildingsByType: buildingsByType.map((item: any) => ({
          type: item._id,
          count: item.count,
        })),
        buildingsByCompany: buildingsByCompany.map((item: any) => ({
          companyId: item._id,
          count: item.count,
        })),
        buildingsByLot: buildingsByLot.map((item: any) => ({
          lotCode: item._id,
          count: item.count,
        })),
        dailyTrend: dailyTrend.map((item: any) => ({
          date: item._id,
          count: item.count,
        })),
      };
    }),

  /**
   * Get enumerator performance metrics
   */
  getEnumeratorPerformance: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection("buildings");
      const sessionsCollection = db.collection("enumerationsessions");

      const { companyId, startDate, endDate } = input;

      // Build base query
      const query: any = { isActive: true };

      // Role-based filtering
      if (ctx.user.role === "user" && ctx.user.companyId) {
        query.companyId = ctx.user.companyId;
      } else if (companyId) {
        query.companyId = companyId;
      }

      // Date range filter
      if (startDate || endDate) {
        query.enumeratedAt = {};
        if (startDate) query.enumeratedAt.$gte = new Date(startDate);
        if (endDate) query.enumeratedAt.$lte = new Date(endDate);
      }

      // Get buildings by enumerator
      const buildingsByEnumerator = await buildingsCollection
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: "$enumeratorId",
              buildingsEnumerated: { $sum: 1 },
            },
          },
          { $sort: { buildingsEnumerated: -1 } },
        ])
        .toArray();

      // Get user details
      const usersCollection = db.collection("users");
      const enumeratorIds = buildingsByEnumerator
        .map((item: any) => item._id)
        .filter(Boolean);
      const users = await usersCollection
        .find({ _id: { $in: enumeratorIds } })
        .project({ fullName: 1, email: 1 })
        .toArray();

      const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

      // Get session stats by enumerator
      const sessionQuery: any = {};
      if (ctx.user.role === "user" && ctx.user.companyId) {
        sessionQuery.companyId = ctx.user.companyId;
      } else if (companyId) {
        sessionQuery.companyId = companyId;
      }
      if (startDate || endDate) {
        sessionQuery.startTime = {};
        if (startDate) sessionQuery.startTime.$gte = new Date(startDate);
        if (endDate) sessionQuery.startTime.$lte = new Date(endDate);
      }

      const sessionsByEnumerator = await sessionsCollection
        .aggregate([
          { $match: sessionQuery },
          {
            $group: {
              _id: "$userId",
              totalSessions: { $sum: 1 },
              totalDuration: { $sum: "$durationMinutes" },
            },
          },
        ])
        .toArray();

      const sessionMap = new Map(
        sessionsByEnumerator.map((item: any) => [item._id.toString(), item])
      );

      // Combine data
      const performance = buildingsByEnumerator.map((item: any) => {
        const enumeratorId = item._id.toString();
        const user = userMap.get(enumeratorId);
        const sessions = sessionMap.get(enumeratorId);

        return {
          enumeratorId,
          enumeratorName: user?.fullName || "Unknown",
          enumeratorEmail: user?.email || "",
          buildingsEnumerated: item.buildingsEnumerated,
          totalSessions: sessions?.totalSessions || 0,
          totalDuration: sessions?.totalDuration || 0,
          avgBuildingsPerSession:
            sessions?.totalSessions > 0
              ? Math.round((item.buildingsEnumerated / sessions.totalSessions) * 10) / 10
              : 0,
        };
      });

      return performance;
    }),

  /**
   * Export buildings to CSV
   */
  exportBuildings: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        lotCode: z.string().optional(),
        propertyType: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection("buildings");

      const { companyId, lotCode, propertyType, startDate, endDate } = input;

      // Build query
      const query: any = { isActive: true };

      // Role-based filtering
      if (ctx.user.role === "user" && ctx.user.companyId) {
        query.companyId = ctx.user.companyId;
      } else if (companyId) {
        query.companyId = companyId;
      }

      if (lotCode) {
        query.lotCode = lotCode;
      }

      if (propertyType) {
        query.propertyType = propertyType;
      }

      if (startDate || endDate) {
        query.enumeratedAt = {};
        if (startDate) query.enumeratedAt.$gte = new Date(startDate);
        if (endDate) query.enumeratedAt.$lte = new Date(endDate);
      }

      // Get all buildings (no pagination for export)
      const buildings = await buildingsCollection
        .find(query)
        .sort({ enumeratedAt: -1 })
        .toArray();

      // Get enumerator details
      const usersCollection = db.collection("users");
      const enumeratorIds = [...new Set(buildings.map((b: any) => b.enumeratorId).filter(Boolean))];
      const enumerators = await usersCollection
        .find({ _id: { $in: enumeratorIds } })
        .project({ fullName: 1, email: 1 })
        .toArray();

      const enumeratorMap = new Map(enumerators.map((e: any) => [e._id.toString(), e]));

      // Format for CSV
      const csvData = buildings.map((building: any) => {
        const enumerator = building.enumeratorId
          ? enumeratorMap.get(building.enumeratorId.toString())
          : null;

        return {
          buildingId: building.buildingId,
          companyId: building.companyId,
          lotCode: building.lotCode,
          address: building.address,
          buildingName: building.buildingName || "",
          propertyType: building.propertyType,
          numberOfUnits: building.numberOfUnits,
          gpsLatitude: building.gpsLatitude,
          gpsLongitude: building.gpsLongitude,
          enumeratorName: enumerator?.fullName || "",
          enumeratorEmail: enumerator?.email || "",
          enumeratedAt: building.enumeratedAt,
          arcgisBuildingId: building.arcgisBuildingId || "",
          syncedToArcGIS: building.syncedToArcGIS ? "Yes" : "No",
          notes: building.notes || "",
        };
      });

      return csvData;
    }),

  /**
   * Update building fields (admin override)
   * Allows admins to manually set arcgisBuildingId and other editable fields
   */
  updateBuilding: protectedProcedure
    .input(
      z.object({
        buildingId: z.string(), // MongoDB _id
        arcgisBuildingId: z.string().optional().nullable(),
        address: z.string().optional(),
        buildingName: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        propertyType: z.string().optional(),
        numberOfUnits: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only admins can update buildings from the dashboard
      if (ctx.user.role !== "admin") {
        throw new Error("Access denied: admin role required");
      }

      const db = await getMongoDb();
      const buildingsCollection = db.collection("buildings");

      // Find building by MongoDB _id
      const building = await buildingsCollection.findOne({
        _id: new ObjectId(input.buildingId),
      });

      if (!building) {
        throw new Error("Building not found");
      }

      // Build update object — only include fields that were provided
      const updateFields: Record<string, any> = {
        lastUpdatedAt: new Date(),
      };

      if (input.arcgisBuildingId !== undefined) {
        updateFields.arcgisBuildingId = input.arcgisBuildingId || null;
      }
      if (input.address !== undefined) {
        updateFields.address = input.address;
      }
      if (input.buildingName !== undefined) {
        updateFields.buildingName = input.buildingName || null;
      }
      if (input.notes !== undefined) {
        updateFields.notes = input.notes || null;
      }
      if (input.propertyType !== undefined) {
        updateFields.propertyType = input.propertyType;
      }
      if (input.numberOfUnits !== undefined) {
        updateFields.numberOfUnits = input.numberOfUnits;
      }

      await buildingsCollection.updateOne(
        { _id: new ObjectId(input.buildingId) },
        { $set: updateFields }
      );

      const updated = await buildingsCollection.findOne({
        _id: new ObjectId(input.buildingId),
      });

      return {
        ...updated,
        _id: updated!._id.toString(),
      };
    }),

  /**
   * C1: Get geographic fields for a specific building
   * Returns lga_name, lga_code, state_code, country, ward_code, ward_name
   * for display and filtering in the Admin Dashboard.
   */
  getBuildingGeoFields: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ input }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection('buildings');
      const building = await buildingsCollection.findOne(
        { _id: new ObjectId(input.buildingId) },
        { projection: { lgaName: 1, lgaCode: 1, stateCode: 1, country: 1, wardCode: 1, wardName: 1, arcgisBuildingId: 1 } }
      );
      return {
        _id: building._id.toString(),
        lgaName:   building.lgaName   || null,
        lgaCode:   building.lgaCode   || null,
        stateCode: building.stateCode || null,
        country:   building.country   || null,
        wardCode:  building.wardCode  || null,
        wardName:  building.wardName  || null,
        arcgisBuildingId: building.arcgisBuildingId || null,
      };
    }),

  /**
   * C2: Admin-only endpoint to trigger geographic backfill for buildings
   * that are missing lgaName. Processes up to  buildings per call.
   * Calls the Node.js backend backfill API endpoint.
   */
  triggerGeoBackfill: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(100) }))
    .mutation(async ({ input }) => {
      const db = await getMongoDb();
      const buildingsCollection = db.collection('buildings');
      // Find buildings with arcgisBuildingId but missing lgaName
      const buildings = await buildingsCollection
        .find(
          { arcgisBuildingId: { $exists: true, $ne: null }, lgaName: { $in: [null, undefined, ''] } },
          { projection: { _id: 1, arcgisBuildingId: 1 } }
        )
        .limit(input.limit)
        .toArray();

      let enriched = 0;
      let failed = 0;

      for (const building of buildings) {
        try {
          // Call the upwork.kowope.xyz backend enrichment endpoint
          const response = await fetch(
            `https://upwork.kowope.xyz/api/v1/property-enumeration/geo-enrich/${building.arcgisBuildingId}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.geo) {
              await buildingsCollection.updateOne(
                { _id: building._id },
                { $set: {
                  lgaName:   data.geo.lga_name   || null,
                  lgaCode:   data.geo.lga_code   || null,
                  stateCode: data.geo.state_code || null,
                  country:   data.geo.country    || null,
                  wardCode:  data.geo.ward_code  || null,
                  wardName:  data.geo.ward_name  || null,
                }}
              );
              enriched++;
            }
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      return {
        total: buildings.length,
        enriched,
        failed,
        message: `Backfill complete: ${enriched} enriched, ${failed} failed out of ${buildings.length} buildings`,
      };
    }),
});