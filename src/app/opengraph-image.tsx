import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export const runtime = "edge";

export const alt = `${SITE_NAME} — contractor lead generation for the trades`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #020617 0%, #0f172a 50%, #020617 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            border: "2px solid rgba(34, 211, 238, 0.5)",
            borderRadius: 24,
            background: "rgba(15, 23, 42, 0.8)",
            maxWidth: 1000,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#22d3ee",
              letterSpacing: "-0.02em",
              textShadow: "0 0 40px rgba(34, 211, 238, 0.4)",
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 36,
              fontWeight: 600,
              color: "#f8fafc",
              textAlign: "center",
            }}
          >
            {SITE_TAGLINE}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              color: "#94a3b8",
              textAlign: "center",
              lineHeight: 1.35,
            }}
          >
            Contractor lead generation & revenue systems for the trades
          </div>
          <div style={{ marginTop: 32, fontSize: 20, color: "#64748b" }}>intentrev.net</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
