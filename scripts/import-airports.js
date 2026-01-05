/**
 * Import OurAirports data into Supabase (JavaScript version)
 *
 * Prerequisites:
 * 1. Download CSVs and place in ./data/:
 *    - airports.csv
 *    - runways.csv
 * 2. Set SUPABASE_SERVICE_KEY in .env.local
 *
 * Usage:
 *   node scripts/import-airports.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';

// Load .env.local explicitly (dotenv defaults to .env only)
dotenv.config({ path: '.env.local' });

// Debug: Check what dotenv loaded
console.log('🔍 Environment variables loaded:');
console.log(`   VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? 'SET ✓' : 'NOT SET ✗'}`);
console.log(`   SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? 'SET ✓ (length: ' + process.env.SUPABASE_SERVICE_KEY.length + ')' : 'NOT SET ✗'}`);
console.log('');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service role key for imports
);

async function importAirports() {
  console.log('📥 Importing airports from ./data/airports.csv...');

  const airports = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream('./data/airports.csv')
      .pipe(csv())
      .on('data', (row) => {
        // Filter: only include airports with ICAO codes (4 letters)
        if (row.ident && row.ident.length === 4 && row.ident.match(/^[A-Z]{4}$/)) {
          airports.push({
            icao: row.ident,
            name: row.name,
            iata: row.iata_code || null,
            type: row.type,
            latitude_deg: parseFloat(row.latitude_deg) || null,
            longitude_deg: parseFloat(row.longitude_deg) || null,
            elevation_ft: parseInt(row.elevation_ft) || null,
            municipality: row.municipality,
            region: row.iso_region,
            country: row.iso_country,
          });
        }
      })
      .on('end', async () => {
        console.log(`✅ Parsed ${airports.length} airports with ICAO codes`);

        try {
          // Batch insert (1000 at a time)
          for (let i = 0; i < airports.length; i += 1000) {
            const batch = airports.slice(i, i + 1000);
            const { error } = await supabase
              .from('airports')
              .upsert(batch);

            if (error) {
              console.error('❌ Import error:', error);
              reject(error);
              return;
            }

            console.log(`   Imported ${Math.min(i + 1000, airports.length)}/${airports.length}`);
          }

          console.log('✅ Airport import complete!\n');
          resolve(airports.length);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function importRunways() {
  console.log('📥 Importing runways from ./data/runways.csv...');

  const runways = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream('./data/runways.csv')
      .pipe(csv())
      .on('data', (row) => {
        // Only import if airport exists (has ICAO code)
        if (!row.airport_ident || row.airport_ident.length !== 4) return;

        // Parse surface type
        const surface = row.surface?.toUpperCase() || 'UNK';

        // Add low end (e.g., "09")
        if (row.le_ident) {
          runways.push({
            airport_icao: row.airport_ident,
            identifier: row.le_ident,
            heading_deg: parseInt(row.le_heading_degT) || null,
            length_ft: parseInt(row.length_ft) || null,
            width_ft: parseInt(row.width_ft) || null,
            surface: surface,
            displaced_threshold_ft: parseInt(row.le_displaced_threshold_ft) || null,
            is_closed: row.closed === '1',
          });
        }

        // Add high end if different (e.g., "27")
        if (row.he_ident && row.he_ident !== row.le_ident) {
          runways.push({
            airport_icao: row.airport_ident,
            identifier: row.he_ident,
            heading_deg: parseInt(row.he_heading_degT) || null,
            length_ft: parseInt(row.length_ft) || null,
            width_ft: parseInt(row.width_ft) || null,
            surface: surface,
            displaced_threshold_ft: parseInt(row.he_displaced_threshold_ft) || null,
            is_closed: row.closed === '1',
          });
        }
      })
      .on('end', async () => {
        console.log(`✅ Parsed ${runways.length} runway ends`);

        try {
          // Batch insert
          for (let i = 0; i < runways.length; i += 1000) {
            const batch = runways.slice(i, i + 1000);
            const { error } = await supabase
              .from('runways')
              .upsert(batch, { onConflict: 'airport_icao,identifier' });

            if (error) {
              console.error('❌ Import error:', error);
              reject(error);
              return;
            }

            console.log(`   Imported ${Math.min(i + 1000, runways.length)}/${runways.length}`);
          }

          console.log('✅ Runway import complete!\n');
          resolve(runways.length);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('🚀 Starting OurAirports data import...\n');

  // Check environment variables
  if (!process.env.VITE_SUPABASE_URL) {
    console.error('❌ VITE_SUPABASE_URL not set in environment');
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY not set in environment');
    console.error('   Get this from your Supabase project settings → API → service_role key');
    process.exit(1);
  }

  // Check data files exist
  if (!fs.existsSync('./data/airports.csv')) {
    console.error('❌ ./data/airports.csv not found');
    console.error('   Download from: https://davidmegginson.github.io/ourairports-data/airports.csv');
    process.exit(1);
  }

  if (!fs.existsSync('./data/runways.csv')) {
    console.error('❌ ./data/runways.csv not found');
    console.error('   Download from: https://davidmegginson.github.io/ourairports-data/runways.csv');
    process.exit(1);
  }

  try {
    const airportCount = await importAirports();
    const runwayCount = await importRunways();

    console.log('🎉 Import complete!');
    console.log(`   ${airportCount} airports imported`);
    console.log(`   ${runwayCount} runway ends imported`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

main();
