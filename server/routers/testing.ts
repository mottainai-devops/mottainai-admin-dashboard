import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';

const BACKEND_API_URL = 'http://172.232.24.180:3000';
const ARCGIS_BASE_URL = 'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/New_Footprints_gdb_b1422/FeatureServer/0';
const ARCGIS_API_KEY = 'AAPTxy8BH1VEsoebNVZXo8HurDkT4HeplNOm_pLCsV2-wHXD7esJFqWCGo3oDxTaOVO68fIzhjQ4gSKqccl-uynuHunhlN5t3E_x5N010mOKYQRyFm3vYXqvila3dJ3Ax81DMK2WyxFt6mqhwzxdkdhmm7USv7-cQi07L_22-MTRC95Rns1BHueP3kR_yXyAyh1WEFAm9Q7KFELPkRpT_5cjWvbDo2rWZhtHOb5xFr_7bOA.AT1_n5wNkDcc';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration: number;
  details?: any;
}

/**
 * Testing router for backend API and integration health checks
 */
export const testingRouter = router({
  /**
   * Test company API endpoint
   */
  testCompanyAPI: protectedProcedure.query(async (): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BACKEND_API_URL}/companies/active`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        return {
          name: 'Company API',
          status: 'fail',
          message: `HTTP ${response.status}: ${response.statusText}`,
          duration,
        };
      }

      const data = await response.json();
      
      if (!data.success || !Array.isArray(data.data)) {
        return {
          name: 'Company API',
          status: 'fail',
          message: 'Invalid response format',
          duration,
          details: data,
        };
      }

      return {
        name: 'Company API',
        status: 'pass',
        message: `Successfully fetched ${data.data.length} companies`,
        duration,
        details: {
          companyCount: data.data.length,
          companies: data.data.map((c: any) => ({
            id: c.companyId,
            name: c.companyName,
            lots: c.operationalLots.length,
          })),
        },
      };
    } catch (error) {
      return {
        name: 'Company API',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }),

  /**
   * Test ArcGIS Feature Service
   */
  testArcGIS: protectedProcedure
    .input(z.object({
      lat: z.number().default(6.5244), // Lagos, Nigeria
      lon: z.number().default(3.3792),
    }))
    .query(async ({ input }): Promise<TestResult> => {
      const startTime = Date.now();
      
      try {
        const geometry = encodeURIComponent(JSON.stringify({
          x: input.lon,
          y: input.lat,
          spatialReference: { wkid: 4326 },
        }));

        const url = `${ARCGIS_BASE_URL}/query?` +
          `geometry=${geometry}` +
          `&geometryType=esriGeometryPoint` +
          `&distance=5000` +
          `&units=esriSRUnit_Meter` +
          `&spatialRel=esriSpatialRelIntersects` +
          `&outFields=building_id,business_name,cust_phone,customer_email,address,Zone,socio_economic_groups` +
          `&returnGeometry=true` +
          `&f=json` +
          `&token=${ARCGIS_API_KEY}`;

        const response = await fetch(url, {
          method: 'GET',
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          return {
            name: 'ArcGIS Feature Service',
            status: 'fail',
            message: `HTTP ${response.status}: ${response.statusText}`,
            duration,
          };
        }

        const data = await response.json();

        if (data.error) {
          return {
            name: 'ArcGIS Feature Service',
            status: 'fail',
            message: data.error.message || 'ArcGIS API error',
            duration,
            details: data.error,
          };
        }

        if (!data.features || !Array.isArray(data.features)) {
          return {
            name: 'ArcGIS Feature Service',
            status: 'warning',
            message: 'No features found in response',
            duration,
            details: data,
          };
        }

        return {
          name: 'ArcGIS Feature Service',
          status: 'pass',
          message: `Found ${data.features.length} building polygons`,
          duration,
          details: {
            featureCount: data.features.length,
            sampleFeatures: data.features.slice(0, 3).map((f: any) => ({
              buildingId: f.attributes?.building_id,
              businessName: f.attributes?.business_name,
              address: f.attributes?.address,
              hasGeometry: !!f.geometry,
            })),
          },
        };
      } catch (error) {
        return {
          name: 'ArcGIS Feature Service',
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        };
      }
    }),

  /**
   * Test webhook endpoint
   */
  testWebhook: protectedProcedure
    .input(z.object({
      webhookUrl: z.string().url(),
    }))
    .mutation(async ({ input }): Promise<TestResult> => {
      const startTime = Date.now();
      
      try {
        // Create test payload
        const testPayload = {
          formId: 'TEST_FORM',
          supervisorId: 'TEST_SUPERVISOR',
          customerType: 'PAYT',
          binType: '10 CBM SKIP BIN',
          binQuantity: 1,
          buildingId: 'TEST_BUILDING',
          pickUpDate: new Date().toISOString(),
          userId: 'TEST_USER',
          latitude: 6.5244,
          longitude: 3.3792,
          createdAt: new Date().toISOString(),
          _test: true, // Flag to indicate this is a test submission
        };

        const response = await fetch(input.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload),
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          return {
            name: 'Webhook Test',
            status: 'fail',
            message: `HTTP ${response.status}: ${response.statusText}`,
            duration,
          };
        }

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        return {
          name: 'Webhook Test',
          status: 'pass',
          message: 'Webhook accepted test payload',
          duration,
          details: {
            url: input.webhookUrl,
            response: responseData,
          },
        };
      } catch (error) {
        return {
          name: 'Webhook Test',
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        };
      }
    }),

  /**
   * Run all tests
   */
  runAllTests: protectedProcedure.query(async ({ ctx }) => {
    const results: TestResult[] = [];

    // Test 1: Company API
    try {
      const companyTest = await testingRouter.createCaller(ctx).testCompanyAPI();
      results.push(companyTest);
    } catch (error) {
      results.push({
        name: 'Company API',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Test execution failed',
        duration: 0,
      });
    }

    // Test 2: ArcGIS
    try {
      const arcgisTest = await testingRouter.createCaller(ctx).testArcGIS({ lat: 6.5244, lon: 3.3792 });
      results.push(arcgisTest);
    } catch (error) {
      results.push({
        name: 'ArcGIS Feature Service',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Test execution failed',
        duration: 0,
      });
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      warnings: results.filter(r => r.status === 'warning').length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    };

    return {
      summary,
      results,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Get system health status
   */
  getSystemHealth: publicProcedure.query(async () => {
    const checks = [];

    // Check backend API
    try {
      const response = await fetch(`${BACKEND_API_URL}/companies/active`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      checks.push({
        service: 'Backend API',
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: 0,
      });
    } catch {
      checks.push({
        service: 'Backend API',
        status: 'unhealthy',
        responseTime: 0,
      });
    }

    // Check ArcGIS
    try {
      const response = await fetch(`${ARCGIS_BASE_URL}?f=json&token=${ARCGIS_API_KEY}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      checks.push({
        service: 'ArcGIS',
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: 0,
      });
    } catch {
      checks.push({
        service: 'ArcGIS',
        status: 'unhealthy',
        responseTime: 0,
      });
    }

    const allHealthy = checks.every(c => c.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }),
});
