# Intent LeadNet — System Architecture & Feature Overview

## 1. Executive Summary & Architecture
**Intent LeadNet** is a plug-and-play revenue capture and speed-to-lead software system built specifically for home service contractors (HVAC, Plumbing, Electrical, Roofing, General Contracting).

The architecture consists of two interconnected applications:
1. **Marketing & Onboarding App (`Intent`)**: Handles product marketing, SEO landing pages, Stripe payments for productized sprints and add-ons, and automated DocuSign agreement signing via JWT impersonation.
2. **Client LeadNet Web App (`intent-revenue-capture`)**: A standalone, mobile-first Progressive Web App (PWA) given to trade contractors to capture missed calls, process third-party leads, manage dispatches, track pipeline value, and reactivate dormant customer lists.

---

## 2. Core Platform Capabilities

### Missed-Call Auto-Recovery & SMS Intake
- **Twilio Call Tracking**: Inbound calls route through a dedicated tracking number while forwarding directly to the contractor's existing phone.
- **Instant SMS Text-Back**: If a call is missed or unanswered, Twilio automatically fires an instant SMS to the homeowner containing a branded priority intake link.
- **Intake Form & Revenue Attribution**: Homeowners input job details, address, urgency, and equipment age. Intake submissions automatically calculate estimated job values based on 2026 mid-market trade averages.
- **Technician & Owner Alerts**: Instant SMS notifications are pushed to the business owner or on-call dispatch technician with lead details and a link to the dashboard.

### Post-Job Google Review Booster
- Automated SMS engine to request 5-star Google reviews after job completion, utilizing direct Google search deep-links for maximum conversion.

### Dispatch Dashboard & Analytics
- **Live Metrics**: Real-time stats on missed calls caught, intake form conversion rates, booked pipeline value, and review requests sent.
- **Interactive Time Horizon Chart**: Compares performance across 7-day, monthly, quarterly, and yearly windows with baseline deltas.
- **Interactive KPI Cards**: Clicking any top KPI dynamically updates the chart series to focus on that specific metric.

---

## 3. Newly Added Features

### A. Angi & Google LSA Speed-to-Lead Auto-Replies
- **Plug-and-Play Webhook Endpoints**:
  - `/api/webhooks/angi` — Ingestion for Angi / HomeAdvisor leads.
  - `/api/webhooks/google-lsa` — Ingestion for Google Local Services Ads leads.
  - `/api/webhooks/inbound-lead` — Universal webhook for Meta (Facebook), Yelp, Thumbtack, or custom CRMs.
- **Zero-Latency Auto-Replies**: Instantly fires a customized SMS via Twilio to the lead, acknowledging their request and capturing priority details before competitors respond.
- **Simultaneous On-Call Alerts**: Pushes an immediate alert to the owner/technician with lead source badges (e.g., `[ANGI]`, `[GOOGLE LSA]`).
- **Templatable & Secure**: Configurable via environment variables with secret token authentication.

### A. LiveWire (Real-Time Inbound Capture & Speed-to-Lead)
- **Sub-3-Second Missed Call Text-Back**: Instantly texts callers who abandon or miss a call with a branded priority intake link.
- **Angi & Google LSA Speed-to-Lead Webhooks**: Directly ingests lead webhooks and fires instant personalized SMS responses to the homeowner within seconds.
- **Owner & Tech Dispatch Alerts**: Real-time SMS alerts dispatched to the technician/owner with estimated ticket values, address, customer details, and direct intake links.
- **Dynamic KPI Pipeline**: Interactive delta KPI metrics, revenue charting, and conversion tables.

### B. RevSurge (Dormant Database Activation Engine)
- **Dormant Customer Campaigns**: Allows contractors to generate immediate booked revenue by running SMS reactivation campaigns to past customer databases.
- **Trade-Specific Presets**: Built-in, high-converting offer templates tailored to specific trades:
  - *HVAC*: AC Tune-Up specials, system replacement rebate audits, indoor air quality duct checks.
  - *Plumbing*: Water heater flush, drain clearing specials, whole-home plumbing audits.
  - *Roofing*: Post-storm drone inspections, seasonal gutter & valley leak sealing, full re-roof insurance audits.
  - *Electrical*: Panel safety inspections, EV charger installations, generator interlocks.
  - *General/Remodel*: VIP seasonal maintenance, kitchen & bath 3D consultations, hurricane window/door credits.
- **CSV / Text Audience Parser**: Uploads customer phone lists, validates E.164 phone formats, deduplicates contacts, and flags errors.
- **10DLC-Safe Drip Engine**: Throttles message delivery to comply with carrier throughput guidelines, preventing carrier spam blocking. Includes real-time pause/resume controls, progress tracking bars, and test SMS verification.

### C. AutoSet (Automated Messaging & Variable Configuration)
- **Self-Serve Auto-Reply Customization**: Dedicated in-app editor for Google Review SMS, Missed-Call Text-Back, Angi Auto-Replies, and Google LSA Auto-Replies.
- **Destination Link Variables**: Self-serve management of `{{reviewUrl}}` and `{{intakeUrl}}` destination targets with live web preview testing.
- **Live Visual Phone Mockup**: Real-time token substitution and preview with segment/character counters.
- **1-Click Test SMS**: Instant preview SMS sent directly to the business owner's mobile device to test formatting and delivery.
- **Persistent Saved Presets**: Custom reactivation campaigns can be saved as persistent presets and loaded on demand.

### D. UI / UX Modernization & Trade Isolation
- **Social Media-Style Bottom Navigation**: Mobile-optimized fixed bottom bar switching between *LiveWire*, *RevSurge*, and *AutoSet*.
- **Modern Vector UI**: Clean Lucide React vector icons replacing all emojis.
- **PWA Fullscreen Optimizations**: Hidden scrollbars in standalone mode while preserving touch scrolling.
- **Strict Trade Isolation**: Client instances dynamically filter presets, job catalogs, and terminology based on the client's trade configuration (`NEXT_PUBLIC_CLIENT_TRADE`), ensuring zero cross-trade leakage.

---

## 4. Commercial & Pricing Model

- **One-Time Sprint Setup**: **$1,397**
  - Includes dedicated tracking number provisioning, A2P 10DLC carrier registration, Angi/LSA webhook configuration, intake setup, initial database reactivation setup, and first 30 days of service.
- **Monthly Retainer**: **$197 / month**
  - Covers tracking line maintenance, carrier voice/SMS throughput, real-time dispatch dashboard, and continuous database reactivation engine access.
- **Add-Ons**:
  - **Custom Application Styling (Branding)**: **$350** (Matches client brand colors, logos, and typography).
  - **No Watermark**: **$250** (Removes "Designed with Intent Revenue" badge).
- **Automated Closing**: Stripe Checkout processes sprint + add-on fees, immediately generating dynamic DocuSign agreements matching the exact transaction terms.

---

## 5. Technology Stack
- **Framework**: Next.js 14 (App Router, Server Actions, API Routes)
- **Styling & UI**: Tailwind CSS, Framer Motion, Lucide React
- **Telephony & Messaging**: Twilio Voice, SMS, 10DLC Messaging Services
- **Database & Realtime**: Supabase (PostgreSQL, Realtime Subscriptions)
- **Payments & Legal**: Stripe API, DocuSign eSignature REST API (JWT Grant Authentication)
- **Deployment**: Vercel Serverless Production Infrastructure
