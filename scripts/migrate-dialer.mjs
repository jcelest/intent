import { readFile } from "node:fs/promises";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required.");

const sql = neon(databaseUrl);
const migration = await readFile(new URL("../migrations/002_power_dialer.sql", import.meta.url), "utf8");
const statements = migration
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);
for (const statement of statements) await sql.query(statement);
console.log("Power dialer schema is current.");

if (process.argv.includes("--bootstrap-users")) {
  const scrypt = promisify(scryptCallback);
  const makePassword = () => `${randomBytes(9).toString("base64url")}!7a`;
  const hashPassword = async (password) => {
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, 64);
    return `scrypt:${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
  };

  const accounts = [
    { username: "Intent", displayName: "Intent Owner", role: "owner" },
    { username: "Setter", displayName: "Setter", role: "agent" },
  ];

  for (const account of accounts) {
    const existing = await sql`
      SELECT id FROM dialer_users WHERE LOWER(username) = LOWER(${account.username}) LIMIT 1
    `;
    if (existing.length) {
      console.log(`${account.username}: already exists (password unchanged)`);
      continue;
    }
    const password = makePassword();
    const passwordHash = await hashPassword(password);
    await sql`
      INSERT INTO dialer_users (username, display_name, password_hash, role, must_change_password)
      VALUES (${account.username}, ${account.displayName}, ${passwordHash}, ${account.role}, TRUE)
    `;
    console.log(`${account.username}: ${password}`);
  }
  console.log("Temporary passwords must be changed after first login.");
}
