# SOP: Connect Real GA4 Analytics to Admin Hub

This SOP describes how to connect a client's website (e.g. novationhvac.com) to the Intent admin analytics hub so real session data appears instead of mock data.

---

## Prerequisites

- Access to the client's website (to add GA4 tracking)
- Google account
- Intent codebase with the analytics API already built

---

## Part 1: Google Cloud (GCP)

### 1.1 Create or select a GCP project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "NovationHVAC") or select an existing one
3. Ensure the project is selected (check top-left header)

### 1.2 Enable the Google Analytics Data API

1. Go to **APIs & Services** → **Library**
2. Search for **"Google Analytics Data API"**
3. Click it → **Enable**
4. *(Note: "Analytics Hub API" is different — do not use that)*

### 1.3 Create a service account

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create credentials** → **Service account**
3. Name it (e.g. `intent-analytics`)
4. Click **Create and continue** → skip optional steps → **Done**

### 1.4 Create a JSON key

1. Click the service account you just created
2. Go to the **Keys** tab
3. **Add key** → **Create new key** → **JSON** → **Create**
4. Save the downloaded JSON file securely (you'll use it in Part 3)

---

## Part 2: Google Analytics 4 (GA4)

### 2.1 Create a GA4 property (if the client doesn't have one)

1. Go to [analytics.google.com](https://analytics.google.com)
2. **Admin** (gear icon) → **Create property**
3. Name it (e.g. "Novation HVAC")
4. Set time zone and currency → **Next**
5. Select **Web** → enter website URL (e.g. `https://novationhvac.com`) → **Create stream**

### 2.2 Add the GA4 tag to the client's website

1. In GA4: **Admin** → **Data streams** → click the web stream
2. **View tag instructions** → install via gtag.js or Google Tag Manager
3. The client's site must have this tag for data to be collected

### 2.3 Grant the service account access to the GA4 property

1. In GA4: **Admin** → **Property** column → **Property access management**
2. Click **+** → **Add users**
3. Paste the service account email (e.g. `intent-analytics@novationhvac.iam.gserviceaccount.com`)
4. Role: **Viewer**
5. Click **Add**

### 2.4 Get the Property ID

1. In GA4: **Admin** → **Property settings**
2. Copy the **Property ID** (numeric, e.g. `527575486`)
3. *(The Measurement ID `G-XXXXXXXXXX` is for the tracking tag, not the API)*

---

## Part 3: Intent Codebase

### 3.1 Add the company to the config

1. Open `src/lib/companies.ts`
2. Add a new entry to the `COMPANIES` array:

```ts
{
  id: "client-slug",           // e.g. "novation-hvac"
  name: "Client Name",
  url: "https://clientdomain.com",
  joinedDate: "YYYY-MM",
  accentColor: ACCENT_COLORS.cyan,
  chartLayout: "area-dominant",
  dataSource: "live",
},
```

3. The `id` must be kebab-case (e.g. `novation-hvac`, `acme-plumbing`)

### 3.2 Set environment variables

**Local development (`.env.local`):**

```
GA4_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com",...}
GA4_<COMPANY_ID>_PROPERTY_ID=527575486
```

- `GA4_CREDENTIALS_JSON`: Paste the entire contents of the service account JSON file as a single line (minify it — no line breaks)
- `GA4_<COMPANY_ID>_PROPERTY_ID`: Replace `<COMPANY_ID>` with the company id in UPPER_SNAKE_CASE  
  - Example: `novation-hvac` → `GA4_NOVATION_HVAC_PROPERTY_ID`

**Production (Vercel / hosting platform):**

1. Project settings → Environment variables
2. Add `GA4_CREDENTIALS_JSON` (same JSON string)
3. Add `GA4_<COMPANY_ID>_PROPERTY_ID` (numeric Property ID)

### 3.3 Restart and verify

1. Restart dev server: `npm run dev`
2. Log into admin analytics hub
3. Select the new company from the dropdown (it will show a ● for live companies)
4. Real session data should appear; if GA4 isn't configured, an error message will show

---

## Quick Reference: Env Var Naming

| Company ID    | Env var for Property ID        |
|---------------|--------------------------------|
| `novation-hvac` | `GA4_NOVATION_HVAC_PROPERTY_ID` |
| `acme-plumbing` | `GA4_ACME_PLUMBING_PROPERTY_ID` |
| `summit-dental` | `GA4_SUMMIT_DENTAL_PROPERTY_ID` |

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| "GA4 not configured" | Env vars set? Restart server? |
| "GA4 fetch failed" | Service account added to GA4 property? JSON valid? |
| No data / zeros | GA4 tag installed on client site? Data takes 24–48 hrs to appear |
| 403 / permission denied | Service account has Viewer role on GA4 property |

### PERMISSION_DENIED: User does not have sufficient permissions for this property

This error means the service account does not have access to the GA4 property. Fix it by adding the service account as a user:

1. Go to [analytics.google.com](https://analytics.google.com)
2. Select the correct property (the one matching your Property ID)
3. **Admin** (gear icon) → **Property** column → **Property access management**
4. Click **+** (Add users)
5. Paste the service account email (e.g. `intent-analytics@novationhvac.iam.gserviceaccount.com`)
6. Uncheck **Notify new users by email** (service accounts don't use email)
7. Role: **Viewer**
8. Click **Add**

Verify you're in the right property: **Admin** → **Property settings** → Property ID should match `GA4_<COMPANY>_PROPERTY_ID`. Wait 1–2 minutes, then retry.

---

## Security Notes

- Never commit `.env.local` or service account JSON to git
- Rotate the service account key if it may have been exposed
- For production, use platform secrets (Vercel env vars, etc.)
