import { sql } from "@/lib/db";

async function run() {
  console.log("Applying fl_management_firms migration...");

  await sql`
    CREATE TABLE IF NOT EXISTS fl_management_firms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      dba TEXT,
      firm_type VARCHAR(60) NOT NULL DEFAULT 'commercial_property_management',
      license_number VARCHAR(50),
      license_type VARCHAR(100),
      status VARCHAR(50) DEFAULT 'ACTIVE',
      address TEXT NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(10) DEFAULT 'FL',
      zip_code VARCHAR(20),
      county VARCHAR(100) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      website TEXT,
      qualifier_name TEXT,
      managed_properties_count INTEGER DEFAULT 1,
      managed_portfolio_sqft BIGINT,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'FL_DOR_CADASTRAL',
      evidence_url TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_fl_mgmt_firms_county ON fl_management_firms (county)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fl_mgmt_firms_coords ON fl_management_firms (latitude, longitude)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fl_mgmt_firms_type ON fl_management_firms (firm_type)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_fl_mgmt_firms_dedup ON fl_management_firms (name, county, address)`;

  console.log("Migration complete!");
}

run().catch(console.error).finally(() => process.exit(0));
