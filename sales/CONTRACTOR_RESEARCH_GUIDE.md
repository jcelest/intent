# Master SOP: Florida Contractor & Trade Lead Sourcing Guide
*How to trace verified business owners, licensed qualifying agents, and phone numbers using Florida DBPR and Sunbiz.*

---

## 🎯 Purpose of This Document
Give this prompt and standard operating procedure (SOP) to any AI assistant (ChatGPT, Claude, Cursor, Gemini, etc.) whenever you want it to build or enrich a contractor hitlist in Florida without using generic placeholders.

---

## 🤖 Copy-Paste AI Prompt Template

```text
You are an expert B2B lead researcher specializing in Florida trade contractors (HVAC, Plumbing, Electrical, Roofing). 
I will provide you with a list of contractor business names, Google Maps links, or phone numbers.

For EVERY company provided, you must trace and verify the real decision makers using official Florida public databases:
1. Florida DBPR License Verification (https://www.myfloridalicense.com/portalsearches/VerifyLicensee/SearchByLicenseNumber)
2. Florida Sunbiz Corporate Search (https://search.sunbiz.org/Inquiry/CorporationSearch/ByName)

CRITICAL INSTRUCTIONS:
- NEVER use generic placeholders like "Owner / Service Manager" or "Lead Tech".
- Always extract the PRIMARY QUALIFYING AGENT name and license number (e.g. CAC1824593, CFC1432906) from the Florida DBPR registry.
- Always extract the PRESIDENT (P), CEO, MANAGING MEMBER (MGR/AMBR), or REGISTERED AGENT name from Florida Sunbiz annual reports.
- Capture their direct office phone, website, Google rating/reviews, and whether they run Google Local Service Ads (LSA).
- Structure the final output in clean CSV or Markdown table format matching the Intent LeadNet Pipeline schema.
```

---

## 🏛️ Step-by-Step Data Sourcing SOP

### Step 1: Florida DBPR License Lookup (`myfloridalicense.com`)
In Florida, state law requires every HVAC, Plumbing, and Electrical contractor to have a designated **Primary Qualifying Agent** holding a certified master license (`CAC` for Air Conditioning, `CFC` for Plumbing, `EC` for Electrical, `CCC` for Roofing).

1. **URL**: [DBPR Online License Search](https://www.myfloridalicense.com/portalsearches/VerifyLicensee/SearchByLicenseNumber)
2. **Search Methods**:
   * **By DBA / Business Name**: Search `"Top Tier Cooling"`, `"Arctic Air Temp"`, `"Ace Solves It All"`.
   * **By License Number**: Found in website footers (e.g., `#CAC1822832`).
3. **Data to Extract**:
   * **Primary Name**: The actual human who owns or qualifies the business (e.g., `DIAS, FAYFAT`, `DEPARI, CHARLES R JR`, `CASTANON, JAYSON JAVIER`).
   * **License Number**: `CAC1822832` / `CAC1816543`.
   * **Status**: Must be `Current, Active`.

---

### Step 2: Florida Sunbiz Division of Corporations (`sunbiz.org`)
Every legal entity operating in Florida must submit an annual corporate filing.

1. **URL**: [Sunbiz Entity Name Search](https://search.sunbiz.org/Inquiry/CorporationSearch/ByName)
2. **Search**: Enter the legal company name (e.g., `"One Stop Air Mechanical Corp"`, `"Our Place Air & Home Repair"`).
3. **Inspect Officers & Directors (Annual Report)**:
   * **Title `P`**: President (e.g., `Sergio Rosas` for One Stop Air Mechanical Corp).
   * **Title `MGR` / `AMBR`**: Managing Member (e.g., `Nelson Zayas` for Our Place Air & Home Repair Corp).
   * **Title `RA`**: Registered Agent.

---

### Step 3: Google Local Service Ads (LSA) Speed-to-Lead Audit
1. Check the contractor's Google Local Service Ad badge:
   * Look for badges like **"Typically replies in 30 min"** or **"Typically replies in 1 day"**.
2. **The Sales Hook**:
   * *When a homeowner's AC breaks in 95-degree heat, a 30-minute response lag means the customer has already called 3 other contractors.*
   * Intent LeadNet's 3-second automated text-back closes this revenue leak instantly.

---

## 📊 Standard Output Schema

| Column Header | Source | Description | Example |
| :--- | :--- | :--- | :--- |
| **Status** | Pipeline | Initial contact status | `Not Contacted`, `Gatekeeper / Callback`, `Follow-up` |
| **Priority Tier** | Audit | Tier A (Sweet spot owner-op) vs Tier B (Enterprise) | `A - High (Sweet Spot / Fast Conversion)` |
| **Company Name** | Google | Public trading name | `Arctic Air Temp` |
| **Trade** | Google | Primary service trade | `HVAC / Plumbing` |
| **City / Metro** | Google / Sunbiz | Operating metro | `Orlando / Kissimmee, FL` |
| **Verified Licensee / Owner** | DBPR / Sunbiz | Exact human name & legal title | `Fayfat Dias (Primary Licensee / Owner)` |
| **State License #** | DBPR | Certified Contractor license code | `CAC1822832 / CFC1432906` |
| **Direct / Office Phone** | Google / DBPR | Inbound tracking or office line | `(407) 633-5755` |
| **Website** | Google | Contractor URL | `https://arcticairtemp.com` |
| **Google Rating / Reviews** | Google Maps | Social proof volume | `5.0 (237 reviews)` |
| **Speed to Lead Hook** | Google LSA | Real ad vulnerability | `LSA badge: 'Typically replies in 30 min'` |
| **Est. System Value** | Industry Avg | AC replacement ticket size | `$8,500` |
| **Target Opening Line** | Strategy | First 10-second phone hook | *"Hey Fayfat, it's [Name] regarding your 30-min Google ad lag in Orlando..."* |

---

## 💡 Quick Phone Rule for Outbound Calling
When you call and have the verified DBPR/Sunbiz name:
> **You:** *"Hey good morning, is [Verified First Name, e.g. Fayfat/Sergio/Jayson] at the shop or out on a job right now?"*

Front-desk dispatchers assume you are a supplier, state regulator, or personal acquaintance because telemarketers only know the generic business name.
