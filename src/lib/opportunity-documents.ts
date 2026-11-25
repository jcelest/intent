import { createHash } from "node:crypto";
import JSZip from "jszip";
// @ts-expect-error pdf-parse direct path avoids index.js debug execution
import pdf from "pdf-parse/lib/pdf-parse.js";
import { sql } from "@/lib/db";
import { getOpportunityDetail } from "@/lib/opportunity-hub";

type Row = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<Row[]> };
const queryDb = (query: string, params: unknown[] = []) =>
  (sql as unknown as Queryable).query(query, params);

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export function plainHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractDocx(buffer: Buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const xml = await archive.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("DOCX document.xml is missing");
  return xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function extractXlsx(buffer: Buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const sharedXml = await archive.file("xl/sharedStrings.xml")?.async("string");
  const shared = sharedXml
    ? Array.from(sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/gi), (item) =>
        decodeXml(Array.from(item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi), (text) => text[1]).join("")))
    : [];
  const sheetNames = Object.keys(archive.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort();
  const rows: string[] = [];
  for (const sheetName of sheetNames) {
    const xml = await archive.file(sheetName)?.async("string");
    if (!xml) continue;
    for (const row of Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/gi))) {
      const values = Array.from(row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/gi), (cell) => {
        const raw = cell[2].match(/<v[^>]*>([\s\S]*?)<\/v>/i)?.[1]
          || cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/i)?.[1] || "";
        return /\bt=["']s["']/i.test(cell[1]) ? shared[Number(raw)] || raw : decodeXml(raw);
      }).filter(Boolean);
      if (values.length) rows.push(values.join("\t"));
    }
  }
  if (!rows.length) throw new Error("XLSX workbook contained no readable cells");
  return rows.join("\n");
}

async function extractText(buffer: Buffer, contentType: string, url: string, title: string) {
  const lower = `${contentType} ${url} ${title}`.toLowerCase();
  const declared = contentType.toLowerCase();
  const isHtml = declared.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(buffer.subarray(0, 200).toString("utf8"));
  if (isHtml) {
    return { status: "unsupported", text: null };
  }
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-" || declared.includes("application/pdf")) {
    return { status: "extracted", text: (await pdf(buffer)).text.trim() };
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && (lower.includes("wordprocessingml") || lower.includes(".docx"))) {
    return { status: "extracted", text: await extractDocx(buffer) };
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && (lower.includes("spreadsheetml") || lower.includes(".xlsx"))) {
    return { status: "extracted", text: await extractXlsx(buffer) };
  }
  if (/text\/|json|xml|csv/.test(lower)) {
    return { status: "extracted", text: buffer.toString("utf8").trim() };
  }
  return { status: "unsupported", text: null };
}

export interface DocumentFetchOptions {
  limit?: number;
  sourceIds?: string[];
  maxPerSource?: number;
}

export async function requeueFailedOpportunityDocuments(sourceIds: string[] = []) {
  const rows = await queryDb(
    `UPDATE oi_source_documents SET extraction_status='pending', extraction_error=NULL,
       fetched_at=NULL, updated_at=CURRENT_TIMESTAMP
     WHERE is_current=TRUE AND extraction_status='failed'
       AND ($1::text[] = '{}'::text[] OR source_id=ANY($1::text[]))
     RETURNING id`,
    [sourceIds.filter(Boolean)],
  );
  return rows.length;
}

export async function fetchPendingOpportunityDocuments(options: number | DocumentFetchOptions = 25) {
  const requested = typeof options === "number" ? { limit: options } : options;
  const limit = Math.min(100, Math.max(1, requested.limit || 25));
  const sourceIds = requested.sourceIds?.filter(Boolean) || [];
  const maxPerSource = Math.min(50, Math.max(1, requested.maxPerSource || 10));
  const documents = await queryDb(
    `WITH candidates AS (
       SELECT document.*,
              row_number() OVER (
                PARTITION BY source_id
                ORDER BY CASE extraction_status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 WHEN 'extracted' THEN 2 ELSE 3 END,
                         published_at DESC NULLS LAST, created_at
              ) AS source_rank
       FROM oi_source_documents document
       WHERE is_current=TRUE
         AND ($2::text[] = '{}'::text[] OR source_id = ANY($2::text[]))
         AND (
           extraction_status='pending'
           OR (extraction_status='failed' AND fetched_at < CURRENT_TIMESTAMP - INTERVAL '6 hours')
           OR (extraction_status='extracted' AND fetched_at < CURRENT_TIMESTAMP - INTERVAL '24 hours')
           OR (extraction_status='unsupported' AND fetched_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
         )
     )
     SELECT * FROM candidates WHERE source_rank <= $3
     ORDER BY CASE extraction_status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 WHEN 'extracted' THEN 2 ELSE 3 END,
              source_rank, published_at DESC NULLS LAST
     LIMIT $1`,
    [limit, sourceIds, maxPerSource],
  );
  let fetched = 0;
  let extracted = 0;
  let unchanged = 0;
  let failed = 0;
  let versioned = 0;
  for (const document of documents) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain,*/*",
        "User-Agent": "Intent-Opportunity-Documents/1.0",
      };
      if (document.http_etag) headers["If-None-Match"] = String(document.http_etag);
      if (document.http_last_modified) headers["If-Modified-Since"] = String(document.http_last_modified);
      const response = await fetch(String(document.document_url), {
        headers, cache: "no-store", signal: AbortSignal.timeout(45_000),
      });
      if (response.status === 304) {
        unchanged += 1;
        await queryDb("UPDATE oi_source_documents SET fetched_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [document.id]);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_DOCUMENT_BYTES) {
        await queryDb(
          "UPDATE oi_source_documents SET extraction_status='too_large', extraction_error=$2, fetched_at=CURRENT_TIMESTAMP, byte_size=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
          [document.id, `Document exceeds ${MAX_DOCUMENT_BYTES} byte limit`, declaredLength],
        );
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_DOCUMENT_BYTES) throw new Error("Document exceeded download size limit");
      const buffer = Buffer.from(arrayBuffer);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      if (document.sha256 && document.sha256 === sha256 && document.extraction_status !== "pending") {
        unchanged += 1;
        await queryDb(
          "UPDATE oi_source_documents SET fetched_at=CURRENT_TIMESTAMP, http_etag=$2, http_last_modified=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
          [document.id, response.headers.get("etag"), response.headers.get("last-modified")],
        );
        continue;
      }
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const result = await extractText(buffer, contentType, String(document.document_url), String(document.title || ""));
      const scopedText = document.metadata && typeof document.metadata === "object"
        ? (document.metadata as Row).scopedText
        : null;
      if (typeof scopedText === "string" && scopedText.trim()) result.text = scopedText.trim();
      if (result.text) result.text = result.text.replace(/\u0000/g, "");
      if (document.sha256) {
        const nextVersion = Number(document.version_number || 1) + 1;
        await queryDb("UPDATE oi_source_documents SET is_current=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [document.id]);
        await queryDb(
          `INSERT INTO oi_source_documents (
            source_id, opportunity_id, procurement_record_id, source_record_id, document_url,
            title, document_type, version_label, version_number, content_type, http_etag,
            http_last_modified, sha256, byte_size, original_content, extracted_text,
            extraction_status, fetched_at, is_current, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP,TRUE,$18::jsonb)`,
          [document.source_id, document.opportunity_id, document.procurement_record_id,
            document.source_record_id, document.document_url, document.title, document.document_type,
            document.version_label, nextVersion, contentType, response.headers.get("etag"),
            response.headers.get("last-modified"), sha256, buffer.length, buffer, result.text,
            result.status, JSON.stringify(document.metadata || {})],
        );
        versioned += 1;
      } else {
        await queryDb(
          `UPDATE oi_source_documents SET content_type=$2, http_etag=$3, http_last_modified=$4,
           sha256=$5, byte_size=$6, original_content=$7, extracted_text=$8,
           extraction_status=$9, extraction_error=NULL, fetched_at=CURRENT_TIMESTAMP,
           updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [document.id, contentType, response.headers.get("etag"), response.headers.get("last-modified"),
            sha256, buffer.length, buffer, result.text, result.status],
        );
      }
      fetched += 1;
      if (result.status === "extracted") extracted += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await queryDb(
        "UPDATE oi_source_documents SET extraction_status='failed', extraction_error=$2, fetched_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [document.id, message.slice(0, 1000)],
      );
    }
  }
  return { seen: documents.length, fetched, extracted, unchanged, failed, versioned };
}

function excerpt(text: string, terms: string[]) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const position = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, position - 180);
  return normalized.slice(start, start + 700);
}

export async function buildOpportunityBrief(opportunityId: string, question?: string) {
  const detail = await getOpportunityDetail(opportunityId);
  if (!detail?.opportunity) return null;
  const opportunity = detail.opportunity as unknown as Row;
  const terms = (question || "requirements eligibility deadline value submit contact scope")
    .toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2).slice(0, 12);
  const documents = await queryDb(
    `SELECT id, title, document_type, version_number, document_url, published_at, extracted_text
     FROM oi_source_documents WHERE opportunity_id=$1 AND is_current=TRUE
     ORDER BY published_at DESC NULLS LAST, title LIMIT 20`,
    [opportunityId],
  );
  const citations = documents.map((document) => ({
    documentId: document.id,
    title: document.title,
    type: document.document_type,
    version: document.version_number,
    url: document.document_url,
    publishedAt: document.published_at,
    excerpt: document.extracted_text ? excerpt(String(document.extracted_text), terms) : null,
  }));
  const evidence = Array.isArray(detail.evidence) ? detail.evidence : [];
  const procurement = Array.isArray(detail.procurement) ? detail.procurement[0] as Row | undefined : undefined;
  const extractedDocuments = citations.filter((citation) => citation.excerpt);
  const requirements = {
    licenses: Array.isArray(procurement?.required_licenses) ? procurement.required_licenses : [],
    certifications: Array.isArray(procurement?.required_certifications) ? procurement.required_certifications : [],
    mandatorySiteVisit: procurement?.mandatory_site_visit || null,
    contact: procurement?.procurement_contact || null,
    submissionDeadline: procurement?.submission_deadline || opportunity.procurementDeadline || null,
  };
  return {
    opportunityId,
    title: opportunity.title,
    classification: opportunity.classification,
    status: opportunity.status,
    deadline: opportunity.procurementDeadline,
    documentedValue: opportunity.documentedValue,
    estimatedValue: opportunity.estimatedValue,
    valueEstimationMethodology: opportunity.valueEstimationMethodology,
    geography: {
      address: opportunity.address, city: opportunity.city, county: opportunity.county,
      scope: opportunity.geographicScopeType,
    },
    pursuit: {
      originalSource: opportunity.sourceUrl,
      sourceDocument: opportunity.sourceDocumentUrl,
      solicitationNumber: procurement?.solicitation_number || null,
      purchasingOrganization: procurement?.purchasing_organization || null,
      requirements,
      nextSteps: [
        "Open the original source and confirm the status and submission deadline.",
        "Review every current solicitation document and amendment listed in the citations.",
        "Confirm mandatory licenses, certifications, site visits, and submission method in the original scope.",
        "Register with the issuing portal before its vendor-registration cutoff, if required.",
      ],
    },
    answerMode: "deterministic_source_grounded",
    sourceGrounding: {
      currentDocuments: citations.length,
      extractedDocuments: extractedDocuments.length,
      hasOriginalScope: Boolean(procurement?.scope_of_work),
      verifiedAt: opportunity.lastVerifiedAt || null,
    },
    question: question || null,
    warning: opportunity.classification === "confirmed"
      ? "Confirmed means an authoritative source documents purchasing activity; it does not guarantee eligibility or award."
      : "This is a timing, asset, or relationship signal and is not confirmed purchasing demand.",
    citations,
    evidence,
  };
}
