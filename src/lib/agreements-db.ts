import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type AgreementRecord = {
  id: string;
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  packageId: string;
  addons: string[];
  amountCents: number;
  monthlyCents: number;
  agreementVersion: string;
  agreementHash: string;
  agreementHtml: string;
  ipAddress: string;
  userAgent: string;
  acceptedAt: string;
  status: "pending_payment" | "payment_completed" | "abandoned";
};

const DATA_FILE = path.join(process.cwd(), "data", "agreements.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }
}

export async function saveAgreementRecord(record: AgreementRecord) {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const records: AgreementRecord[] = JSON.parse(raw);
  records.push(record);
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2));
}

export async function updateAgreementStatus(id: string, status: AgreementRecord["status"]) {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const records: AgreementRecord[] = JSON.parse(raw);
  const record = records.find(r => r.id === id);
  if (record) {
    record.status = status;
    await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2));
  }
}

export async function getAgreementRecord(id: string): Promise<AgreementRecord | undefined> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const records: AgreementRecord[] = JSON.parse(raw);
  return records.find(r => r.id === id);
}

export function hashAgreementText(html: string): string {
  return crypto.createHash("sha256").update(html).digest("hex");
}
