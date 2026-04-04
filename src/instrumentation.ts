/**
 * Runs before other app code on the Node server. Stops gcp-metadata from probing
 * the GCE metadata server on Vercel/Docker (avoids MetadataLookupWarning / UNKNOWN).
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.METADATA_SERVER_DETECTION ?? "").trim()) return;
  process.env.METADATA_SERVER_DETECTION = "none";
}
