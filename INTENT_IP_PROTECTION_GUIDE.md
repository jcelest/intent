# Intent Software IP & Trade Secret Protection Guide

This document establishes the official standard operating procedures (SOP), legal frameworks, technical guardrails, and sales protocols to protect **Intent Revenue's** proprietary software, intellectual property (IP), algorithms, and trade secrets.

---

## 1. Core IP Classification & Assets to Protect

Intent’s enterprise value relies on four proprietary pillars:

| Asset Class | Key Proprietary Components | Protection Classification |
| :--- | :--- | :--- |
| **1. Proprietary Source Code** | LeadNet capture engine, PWA dashboard, webhook normalizers, automated 10DLC safe-drip scheduler, and dynamic DocuSign generator. | **Strictly Confidential / Proprietary** |
| **2. Trade Secrets & Heuristics** | Mid-market job value algorithms (`src/lib/job-value.ts`), dynamic intake field mapping, trade-specific conversion presets, and instant webhook speed-to-lead pipelines. | **Trade Secret** |
| **3. Proprietary Datasets & SOPs** | Verified Florida contractor database (`sales/`), DBPR licensee mapping methodologies (`sales/CONTRACTOR_RESEARCH_GUIDE.md`), and marketing frameworks. | **Confidential & Proprietary** |
| **4. Brand & Product Identity** | "Intent", "Intent LeadNet", "Designed with Intent Revenue", UI layouts, and vector design systems. | **Protected Trademark & Trade Dress** |

---

## 2. Public Marketing & Sales Communication Guardrails

When selling to prospects (trade contractors, HVAC/plumbing business owners, agencies), **sell the outcome, never the blueprint**. Giving away the underlying tools and methods invites tech-savvy prospects or competitors to replicate the stack.

### Golden Rules for Public Copy & Sales Pitches:
1. **Focus on Business Results, Not Technical Plumbing**:
   - **Say**: *"Instant 3-second automated text response that books the job before your competitor picks up."*
   - **Do NOT Say**: *"We built a Next.js serverless API endpoint connected to Twilio webhooks with regex extraction."*
2. **Never Disclose Infrastructure Providers to Prospects**:
   - Do not mention Twilio, Supabase, Vercel, Stripe webhook structures, or specific third-party APIs during sales pitches or on public marketing pages. Present the platform as **Intent’s Proprietary LeadNet Infrastructure**.
3. **Do Not Reveal Exact SMS Prompt Copy Before Checkout**:
   - High-converting SMS reactivation copy and auto-reply templates are trade secrets. Showcase preview mockups with sanitized example text, but preserve the exact sequence algorithms for paying clients.
4. **Protect Proprietary Pricing & Ticket Heuristics**:
   - Pitch the feature as *"Intelligent job valuation that estimates revenue automatically based on regional trade data"*, rather than publishing raw calculation spreadsheets or ticket ranges publicly.

---

## 3. Legal & Contractual IP Protections

### A. SaaS / Managed Sprint Model (Never "Work-for-Hire")
All customer-facing agreements must explicitly state that software setup is a **productized sprint granting a limited, revocable license**, not a custom software development contract where the client acquires copyright.

- **Agreement Language Standard** (already codified in `contracts/INTENT-LEADNET-AGREEMENT.md` and `src/app/terms/page.tsx`):
  > *"Unless a written contract signed by Intent expressly assigns ownership or grants an exclusive license, Intent owns all software, applications, code, templates, dashboards, and related work product we create or customize, including this LeadNet instance. The Client receives a limited, non-exclusive, non-transferable right to use it in their own trade business while they are an active client. Payment of the sprint does not transfer ownership."*

### B. Non-Compete & Non-Circumvention
1. **No Resale or Sublicensing**: Clients are legally prohibited from sublicensing, white-labeling, or renting their LeadNet instance to third-party contractors or competitors.
2. **No Reverse Engineering**: Terms of Service explicitly prohibit inspecting, decompiling, extracting source code, or attempting to clone backend APIs.

### C. Branding & Watermark Protection
- The *"Designed with Intent Revenue"* watermark protects brand attribution and acts as an organic acquisition loop.
- Removing the watermark is strictly an optional paid upgrade ($250 add-on) and does not transfer source code rights.

---

## 4. Technical & Architectural Guardrails

### A. Server-Side Code Execution (Zero Client-Side Leaks)
- **Keep Logic on the Server**: All job valuation heuristics, webhook normalization, Twilio SMS payload generation, and database queries must run inside Next.js Server Components, Server Actions, or API Routes (`src/app/api/*`).
- **Never Expose Logic in Client Bundles**: Do not write sensitive formulas or secret keys inside `"use client"` components where end-users can inspect JavaScript network bundles.

### B. Environment Variable & Secret Hygiene
- **Strict Server Scoping**: Never prefix sensitive keys (Twilio Auth Tokens, Supabase Service Role keys, Stripe Secrets, Webhook Secrets) with `NEXT_PUBLIC_`. Only client UI constants (e.g. `NEXT_PUBLIC_CLIENT_TRADE`) should be public.
- **Git Hygiene**: `.env.local`, `.env`, and private RSA keys (`DOCUSIGN_RSA_PRIVATE_KEY`) must remain in `.gitignore`. Regularly check repository commits to verify no private credentials or client contact databases are staged.

### C. Multi-Tenant Isolation & Row-Level Security (RLS)
- In client-facing databases (Supabase), enable Row-Level Security (RLS) on all tables (`leads`, `calls`, `texts`, `reactivation_campaigns`).
- Ensure no contractor instance can query or view another contractor's leads, customer databases, or phone numbers.

### D. Repository & Deployment Security
- Maintain all GitHub repositories as **Private**.
- Enforce Two-Factor Authentication (2FA) across GitHub, Vercel, Supabase, Twilio, and Stripe accounts.
- Restrict admin deployment privileges.

---

## 5. Demonstration & Prospecting Protocols

### A. Conducting Live Demos:
- **Use Synthetic / Demo Data**: Never demo a live dashboard containing real homeowner names, addresses, or phone numbers from an active paying client. Use the built-in demo datasets (`src/lib/demo-data.ts`).
- **Control Screen Sharing**: Demo via Zoom/Google Meet screen shares. Never hand over live administrative credentials or direct links to editable staging dashboards to prospective clients before an agreement is signed and paid.

### B. Protecting Sourced Hitlists & Research SOPs:
- The contractor databases and verified DBPR license lists generated in `sales/` represent high-value business intelligence.
- Never share the raw `.xlsx` or `.csv` files with external parties or subcontractors without a signed Non-Disclosure Agreement (NDA).

---

## 6. Client Churn & Offboarding Protocol

If a client cancels their monthly subscription ($197/mo) or fails to maintain payment:
1. **Immediate Service Deactivation**: Release or suspend the Twilio tracking line after the contractual grace period.
2. **Revoke Webhook Ingestion**: Disable Angi and Google LSA webhook secret tokens to stop processing new inbound leads.
3. **Terminate Dashboard Access**: Revoke active session tokens and remove client instance hosting.
4. **Data Retention & Privacy**: Retain lead logs in cold storage according to privacy policies, but do not export Intent's application codebase or internal templates to the client.

---

## 7. Incident Response for IP Infringement

If an ex-client, competitor, or agency attempts to copy Intent’s software, code, or marketing assets:
1. **Document Evidence**: Capture timestamped screenshots, source code snapshots, and URL archives.
2. **Check Signed Agreements**: Verify the signed DocuSign agreement, payment timestamp, and acceptance of Terms of Service.
3. **Issue Formal Notice**: Send an immediate Cease & Desist letter referencing Section 6 (Software Ownership) of the Intent LeadNet Agreement and Florida Uniform Trade Secrets Act (FUTSA - Fla. Stat. § 688).
