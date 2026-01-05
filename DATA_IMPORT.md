# Airport Data Import Guide

This guide explains how to import airport and runway data from OurAirports into your Supabase database.

## Prerequisites

1. **Supabase project** with the schema applied (`supabase/schema.sql`)
2. **Service role key** from Supabase (for write access)
3. **Node.js** and dependencies installed

## Step 1: Download OurAirports Data

Download the latest CSV files from OurAirports:

```bash
# Create data directory
mkdir -p data

# Download airports
curl -o data/airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv

# Download runways
curl -o data/runways.csv https://davidmegginson.github.io/ourairports-data/runways.csv
```

**Data size:**
- airports.csv: ~14 MB (~65,000 airports)
- runways.csv: ~4 MB (~45,000 runway ends)

## Step 2: Get Supabase Service Key

1. Go to your Supabase project dashboard
2. Click **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key)
4. Add to `.env.local`:

```bash
# Add this to .env.local
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **WARNING:** The service role key bypasses Row Level Security. Keep it secret!

## Step 3: Run Import Script

```bash
# Install dependencies if needed
npm install csv-parser

# Run import
npm run import:airports
```

**What it does:**
- Filters airports to only include those with ICAO codes (4 letters)
- Imports ~15,000 airports worldwide
- Imports ~40,000 runway ends
- Uses batch inserts (1000 at a time) for performance
- Takes 2-5 minutes to complete

**Example output:**
```
🚀 Starting OurAirports data import...

📥 Importing airports from ./data/airports.csv...
✅ Parsed 15,234 airports with ICAO codes
   Imported 1000/15234
   Imported 2000/15234
   ...
   Imported 15234/15234
✅ Airport import complete!

📥 Importing runways from ./data/runways.csv...
✅ Parsed 42,156 runway ends
   Imported 1000/42156
   ...
   Imported 42156/42156
✅ Runway import complete!

🎉 Import complete!
   15234 airports imported
   42156 runway ends imported
```

## Step 4: Verify Import

Check in Supabase dashboard:

```sql
-- Count airports
SELECT COUNT(*) FROM airports;
-- Should return ~15,000

-- Count runways
SELECT COUNT(*) FROM runways;
-- Should return ~40,000

-- Test a specific airport
SELECT * FROM airports WHERE icao = 'KJFK';

-- Get runways for an airport
SELECT * FROM runways WHERE airport_icao = 'KJFK';
```

## US-Only Import (Optional)

If you only want US airports to reduce database size:

Edit `scripts/import-airports.ts` and change line 36:

```typescript
// Add country filter
if (row.ident && row.ident.length === 4 && row.iso_country === 'US') {
```

This reduces to:
- ~5,000 US airports
- ~15,000 US runway ends
- ~5-7 MB total database size

## Updating Data

OurAirports data is updated regularly. To refresh:

```bash
# Re-download CSVs
rm -rf data
mkdir data
curl -o data/airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
curl -o data/runways.csv https://davidmegginson.github.io/ourairports-data/runways.csv

# Re-run import (upserts will update existing records)
npm run import:airports
```

## Troubleshooting

**Error: SUPABASE_SERVICE_KEY not set**
- Add the service role key to `.env.local`
- Make sure it's the service_role key, not anon key

**Error: ./data/airports.csv not found**
- Download the CSV files first (see Step 1)

**Error: permission denied**
- Verify your Supabase project has the tables created (run schema.sql)
- Check that the service role key is correct

**Import is slow**
- Normal! 15,000 airports takes 2-5 minutes
- Batch size is 1000 to balance speed and reliability

## Database Size

After import:
- **Full worldwide data**: ~25-30 MB
- **US only**: ~5-7 MB
- Well within Supabase free tier (500 MB limit)

## Data License

OurAirports data is **public domain** (no restrictions).
Source: https://ourairports.com/data/

## Next Steps

After importing, the Performance page will be able to:
- Search airports by ICAO code
- Display runway information automatically
- Calculate wind components for runway selection
- Show field elevation and conditions

No API calls needed - all data is local in Supabase!
