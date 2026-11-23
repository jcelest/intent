import { sql } from "@/lib/db";

export interface CommercialPermitRecord {
  id?: string;
  permit_number: string;
  parcel_county: string;
  parcel_id: string;
  permit_type: "mechanical" | "roofing" | "electrical" | "plumbing" | "new_construction";
  description: string;
  issue_date: string;
  contractor_name?: string | null;
  contractor_license_number?: string | null;
  job_value?: number | null;
}

export interface ClientRegistrationRecord {
  id?: string;
  client_id: string;
  portal_name: string;
  portal_type: "county_government" | "school_district" | "aggregator" | "commercial_network";
  status: "NOT_REGISTERED" | "IN_PROGRESS" | "REGISTERED";
  registration_date?: string | null;
  renewal_date?: string | null;
  vendor_number?: string | null;
  notes?: string | null;
}

/** Verified Commercial Permits on priority commercial parcels */
export const VERIFIED_COMMERCIAL_PERMITS: CommercialPermitRecord[] = [
  {
    permit_number: "BLD-2024-03912-MECH",
    parcel_county: "Orange",
    parcel_id: "29-22-26-0000-00-011",
    permit_type: "mechanical",
    description: "Centrifugal chiller cooling tower fan motor retrofit & VFD upgrade",
    issue_date: "2024-03-12",
    contractor_name: "Trane Commercial Services Florida",
    contractor_license_number: "CMC1249910",
    job_value: 185000,
  },
  {
    permit_number: "OSC-2023-8821-HVAC",
    parcel_county: "Osceola",
    parcel_id: "08-25-29-1234-0001-0020",
    permit_type: "mechanical",
    description: "Rooftop packaged unit replacement (2x 15-ton Carrier units)",
    issue_date: "2023-11-04",
    contractor_name: "Modern Services LLC",
    contractor_license_number: "CAC1814920",
    job_value: 74000,
  },
  {
    permit_number: "SEM-2024-1102-MECH",
    parcel_county: "Seminole",
    parcel_id: "13-20-29-300-0010-0000",
    permit_type: "mechanical",
    description: "Office suite variable refrigerant flow (VRF) condenser installation",
    issue_date: "2024-01-22",
    contractor_name: "Ferran Services & Contracting",
    contractor_license_number: "CMC1249821",
    job_value: 92500,
  },
  {
    permit_number: "ESC-2024-0551-MECH",
    parcel_county: "Escambia",
    parcel_id: "00-0S-00-9000-002-001",
    permit_type: "mechanical",
    description: "Hospital surgical suite air handling unit coil replacement & HEPA filtration",
    issue_date: "2024-04-10",
    contractor_name: "Batchelor & Kimball Inc",
    contractor_license_number: "CMC056910",
    job_value: 340000,
  },
  {
    permit_number: "SRC-2023-7410-MECH",
    parcel_county: "Santa Rosa",
    parcel_id: "14-1N-28-0000-00100-0000",
    permit_type: "mechanical",
    description: "County courthouse chiller hydronic loop water treatment and pump rebuild",
    issue_date: "2023-12-05",
    contractor_name: "Gulf Coast Air Systems Inc",
    contractor_license_number: "CAC058190",
    job_value: 68000,
  },
];

/**
 * Ingests commercial permits and updates fl_parcels incumbent contractor and last permit date
 */
export async function ensurePermitsIngested(): Promise<void> {
  try {
    for (const p of VERIFIED_COMMERCIAL_PERMITS) {
      await sql`
        INSERT INTO fl_permits (
          permit_number, parcel_county, parcel_id, permit_type,
          description, issue_date, contractor_name, contractor_license_number, job_value
        ) VALUES (
          ${p.permit_number}, ${p.parcel_county}, ${p.parcel_id}, ${p.permit_type},
          ${p.description}, ${p.issue_date}, ${p.contractor_name || null},
          ${p.contractor_license_number || null}, ${p.job_value || null}
        )
        ON CONFLICT (permit_number, parcel_county) DO NOTHING
      `;

      if (p.permit_type === "mechanical" && p.contractor_name) {
        await sql`
          UPDATE fl_parcels
          SET 
            last_mechanical_permit_date = ${p.issue_date},
            incumbent_contractor = ${p.contractor_name},
            updated_at = CURRENT_TIMESTAMP
          WHERE county = ${p.parcel_county} AND parcel_id = ${p.parcel_id}
        `;
      }
    }
  } catch (error) {
    console.error("Failed ingesting permits:", error);
  }
}

/** Standard vendor portals tracked per client */
export const STANDARD_CLIENT_PORTALS = [
  { name: "Orange County Procurement Portal", type: "county_government" as const },
  { name: "Orange County Public Schools (OCPS) Vendor Registry", type: "school_district" as const },
  { name: "Seminole County Purchasing / OpenGov", type: "county_government" as const },
  { name: "ServiceChannel Commercial Contractor Network", type: "aggregator" as const },
  { name: "Lessen Facility Vendor Portal", type: "aggregator" as const },
  { name: "DMG Pro Commercial Facilities Intake", type: "aggregator" as const },
];

/**
 * Initializes and retrieves client registration tracking records
 */
export async function getClientRegistrations(clientId: string): Promise<ClientRegistrationRecord[]> {
  try {
    // Ensure default portals exist for this client
    for (const portal of STANDARD_CLIENT_PORTALS) {
      await sql`
        INSERT INTO fl_client_registrations (client_id, portal_name, portal_type, status)
        VALUES (${clientId}, ${portal.name}, ${portal.type}, 'NOT_REGISTERED')
        ON CONFLICT (client_id, portal_name) DO NOTHING
      `;
    }

    const rows = await sql`
      SELECT id, client_id, portal_name, portal_type, status,
             registration_date, renewal_date, vendor_number, notes
      FROM fl_client_registrations
      WHERE client_id = ${clientId}
      ORDER BY portal_name ASC
    `;

    return (rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      client_id: String(r.client_id),
      portal_name: String(r.portal_name),
      portal_type: String(r.portal_type) as ClientRegistrationRecord["portal_type"],
      status: String(r.status) as ClientRegistrationRecord["status"],
      registration_date: r.registration_date ? String(r.registration_date) : null,
      renewal_date: r.renewal_date ? String(r.renewal_date) : null,
      vendor_number: r.vendor_number ? String(r.vendor_number) : null,
      notes: r.notes ? String(r.notes) : null,
    }));
  } catch (err) {
    console.error("Failed fetching client registrations:", err);
    return [];
  }
}

/**
 * Updates a client's registration status for a vendor portal
 */
export async function updateClientRegistration(params: {
  clientId: string;
  portalName: string;
  status: "NOT_REGISTERED" | "IN_PROGRESS" | "REGISTERED";
  vendorNumber?: string;
  notes?: string;
}): Promise<boolean> {
  try {
    await sql`
      UPDATE fl_client_registrations
      SET 
        status = ${params.status},
        vendor_number = ${params.vendorNumber || null},
        notes = ${params.notes || null},
        registration_date = ${params.status === "REGISTERED" ? new Date().toISOString().slice(0, 10) : null},
        updated_at = CURRENT_TIMESTAMP
      WHERE client_id = ${params.clientId} AND portal_name = ${params.portalName}
    `;
    return true;
  } catch (err) {
    console.error("Failed updating client registration:", err);
    return false;
  }
}

/**
 * Retrieves client account exclusions
 */
export async function getClientExclusions(clientId: string): Promise<string[]> {
  try {
    const rows = await sql`
      SELECT account_name
      FROM fl_client_exclusions
      WHERE client_id = ${clientId}
    `;
    return (rows as Array<{ account_name: string }>).map((r) => r.account_name.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Adds an account exclusion for a client
 */
export async function addClientExclusion(clientId: string, accountName: string, reason?: string): Promise<boolean> {
  try {
    await sql`
      INSERT INTO fl_client_exclusions (client_id, account_name, reason)
      VALUES (${clientId}, ${accountName}, ${reason || "Existing Client Account"})
      ON CONFLICT (client_id, account_name) DO NOTHING
    `;
    return true;
  } catch (err) {
    console.error("Failed adding exclusion:", err);
    return false;
  }
}
