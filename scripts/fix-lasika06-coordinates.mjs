/**
 * fix-lasika06-coordinates.mjs
 * Task 9 from GitHub Normalisation Report (April 10, 2026)
 *
 * Repairs bad-coordinate LASIKA06 formsubmission records by querying
 * the Nigeria_Building_Footprints ArcGIS feature service for each record's
 * arcgisBuildingId and writing back the correct lat/lon.
 *
 * BLOCKED: Requires LASIKA06 buildings to be published to Nigeria_Building_Footprints.
 * The GIS team must publish LASIKA06 before this script will recover coordinates.
 *
 * Environment variables:
 *   MONGODB_URI   - required (default: mongodb://localhost:27017/arcgis)
 *   DRY_RUN       - optional, default false. Set to 'true' to preview without writing.
 *   LOT_CODE      - optional, default 'LASIKA06'
 *   BATCH_SIZE    - optional, default 50
 *
 * Dry run (preview only):
 *   DRY_RUN=true MONGODB_URI=mongodb://localhost:27017/arcgis node scripts/fix-lasika06-coordinates.mjs
 *
 * Live run:
 *   MONGODB_URI=mongodb://localhost:27017/arcgis node scripts/fix-lasika06-coordinates.mjs
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arcgis';
const DRY_RUN = process.env.DRY_RUN === 'true';
const LOT_CODE = process.env.LOT_CODE || 'LASIKA06';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10);

// ArcGIS Nigeria_Building_Footprints feature service URL
const ARCGIS_LAYER_URL =
  'https://services7.arcgis.com/IkktFdUAcY3WrH25/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0/query';

const client = new MongoClient(MONGODB_URI);

async function fetchBuildingCoordinates(arcgisBuildingId) {
  const params = new URLSearchParams({
    where: `building_id = '${arcgisBuildingId}'`,
    outFields: 'building_id,latitude,longitude',
    returnGeometry: 'true',
    geometryType: 'esriGeometryPolygon',
    outSR: '4326',
    f: 'json',
  });

  const url = `${ARCGIS_LAYER_URL}?${params}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}`);

  const data = await response.json();
  if (!data.features || data.features.length === 0) return null;

  const feature = data.features[0];

  // Prefer explicit lat/lon attributes
  if (feature.attributes?.latitude && feature.attributes?.longitude) {
    return {
      latitude: parseFloat(feature.attributes.latitude),
      longitude: parseFloat(feature.attributes.longitude),
    };
  }

  // Fall back to polygon centroid
  if (feature.geometry?.rings?.length > 0) {
    const ring = feature.geometry.rings[0];
    const sumLon = ring.reduce((s, p) => s + p[0], 0);
    const sumLat = ring.reduce((s, p) => s + p[1], 0);
    return {
      latitude: sumLat / ring.length,
      longitude: sumLon / ring.length,
    };
  }

  return null;
}

async function run() {
  await client.connect();
  const db = client.db();
  const submissions = db.collection('formsubmissions');

  console.log(`\n=== LASIKA06 Coordinate Recovery Script ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}`);
  console.log(`Lot Code: ${LOT_CODE}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Database: ${MONGODB_URI}\n`);

  // Find records in LASIKA06 with missing or zero coordinates
  const badRecords = await submissions.find({
    lotCode: LOT_CODE,
    arcgisBuildingId: { $exists: true, $ne: null },
    $or: [
      { latitude: null },
      { latitude: 0 },
      { latitude: { $exists: false } },
    ],
  }).limit(BATCH_SIZE).toArray();

  console.log(`Found ${badRecords.length} records with missing/zero coordinates in lot ${LOT_CODE}`);

  if (badRecords.length === 0) {
    console.log('Nothing to fix. Exiting.\n');
    await client.close();
    return;
  }

  let recovered = 0;
  let quarantined = 0;
  let failed = 0;

  for (const record of badRecords) {
    try {
      const coords = await fetchBuildingCoordinates(record.arcgisBuildingId);

      if (!coords) {
        // ArcGIS returned no match — quarantine for manual review
        console.log(`  ✗ No ArcGIS match for building ${record.arcgisBuildingId} — quarantining`);
        if (!DRY_RUN) {
          await submissions.updateOne(
            { _id: record._id },
            { $set: { coordinateStatus: 'quarantined' } }
          );
        }
        quarantined++;
        continue;
      }

      console.log(
        `  ${DRY_RUN ? '→ Would fix' : '✓ Fixed'} ${record.arcgisBuildingId}: ` +
        `(${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)})`
      );

      if (!DRY_RUN) {
        await submissions.updateOne(
          { _id: record._id },
          {
            $set: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              coordinateStatus: 'recovered',
            },
          }
        );
      }
      recovered++;
    } catch (err) {
      console.log(`  ✗ Error processing ${record.arcgisBuildingId}: ${err.message}`);
      failed++;
    }

    // Small delay to avoid hammering ArcGIS
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Recovered:   ${recovered}`);
  console.log(`Quarantined: ${quarantined} (no ArcGIS match — manual review needed)`);
  console.log(`Failed:      ${failed} (errors)`);
  console.log(`\nNOTE: If ArcGIS returned 0 results for all records, LASIKA06 buildings`);
  console.log(`have not yet been published to Nigeria_Building_Footprints.`);
  console.log(`Contact the GIS team to publish LASIKA06 before re-running this script.\n`);

  await client.close();
}

run().catch(err => {
  console.error('Script failed:', err);
  client.close();
  process.exit(1);
});
