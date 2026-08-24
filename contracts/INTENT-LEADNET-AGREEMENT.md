# Intent LeadNet Agreement

This is the agreement the site sends through DocuSign after LeadNet payment. You do not need a DocuSign template. The live HTML in `src/lib/capture-agreement.ts` is what the client signs. Keep that file in sync with this document.

**Parties:** Intent Revenue ("Intent") and the Client named on the envelope.

## 1. Service
Intent will set up Intent LeadNet for the Client: Your Company's own LeadNet application, a branded intake page, a tracking number with missed-call text-back, owner lead alerts, Google review SMS, and a company dashboard so inbound jobs stay in the system. This is a productized sprint. It is not an assignment of software ownership unless a later signed contract says otherwise.

## 2. Payment
The Client pays the sprint amount on the envelope through Stripe before signing. That amount is:

- Intent LeadNet base: $1,397
- Custom application styling (optional): $350
- No watermark (optional): $250

Add-ons are included only if they appear on the envelope.

After 30 days from the sprint payment, LeadNet is **$197 per month**. The monthly covers the tracking number, voice on that number, missed-call text-back, owner alerts, and Google review SMS under ordinary trade volume. Intent bills the monthly separately. It is not charged on the sprint card in this payment. The Client is an active client while the monthly is current (or during the included 30 days). If the monthly lapses, Intent may suspend the tracking number, texts, and app access.

## 3. What is included
- Your Company's own LeadNet application
- Branded LeadNet intake
- Tracking number and missed-call text-back
- Owner SMS on new leads
- Google review SMS after the job
- Company dashboard with open estimated job value
- First 30 days of the tracking number and texts, included in the sprint

Voice on the tracking number can go live after the number is active. Public SMS may wait on carrier registration (10DLC or toll-free verification). Intent will start that registration promptly.

## 4. Phone setup
LeadNet uses a tracking number Intent provides. The Client chooses one of two setups at kickoff. Neither setup is sold as a Stripe add-on. Intent does not sell cell plans.

**Keep The Public Number.** That number forwards to LeadNet. The Phone app rings a private carrier line, about $8/month. The Client pays the carrier. Intent does not.

**Keep The Phone As It Is.** Google and ads show the LeadNet number. The Phone app keeps the SIM number. No extra carrier bill.

## 5. What is not included
Intent does not guarantee a number of leads, reviews, booked jobs, or revenue. Paid ads, websites, and ongoing partnership work are separate unless a later signed writing says otherwise. A second cell line, eSIM, or carrier add-a-line is paid by the Client to their carrier, not to Intent. Unusual voice or SMS volume may be billed extra or moved to a higher plan. Intent will contact the Client before extra usage charges.

## 6. Software ownership
Unless a written contract signed by Intent expressly assigns ownership or grants an exclusive license, Intent owns all software, applications, code, templates, dashboards, and related work product we create or customize, including this LeadNet instance. The Client receives a limited, non-exclusive, non-transferable right to use it in their own trade business while they are an active client. Payment of the sprint does not transfer ownership.

## 7. Client materials
The Client's name, logo, job data, and customer lists remain the Client's. Intent may use them to perform the work.

## 8. Add-ons
Custom application styling matches brand colors, type, and layout to the company. No watermark removes "Designed with Intent Revenue" from the live LeadNet app.

## 9. Refunds and cancel
The LeadNet sprint fee is collected before this agreement is signed. The sprint is non-refundable once setup has started, except as required by law or a later signed writing. The Client may cancel the monthly before a new month starts. Cancel stops new monthly charges. It does not refund the sprint. After cancel, Intent may release the tracking number.

## 10. Law
Florida law governs this agreement.

---

## DocuSign setup (once)

The site uses JWT impersonation and builds the envelope from HTML. No template ID is required.

### 1. Developer account
1. Create an account at https://developers.docusign.com
2. Open the demo admin (Apps and Keys): https://admindemo.docusign.com
3. Copy these three values:
   - **Integration Key** → `DOCUSIGN_INTEGRATION_KEY`
   - **User ID** (the GUID under Apps and Keys) → `DOCUSIGN_USER_ID`
   - **API Account ID** → `DOCUSIGN_ACCOUNT_ID`

### 2. Redirect URI
In the same app, add a Redirect URI that matches consent:

- Production site: `https://intentrev.net/begin`
- Local: `http://localhost:3000/begin`

Optional env if you change it: `DOCUSIGN_REDIRECT_URI`

### 3. RSA key
1. In Apps and Keys, generate an RSA keypair
2. Copy the **private** key
3. Paste it into `DOCUSIGN_RSA_PRIVATE_KEY`
4. On Vercel, keep newlines as `\n` inside one string

### 4. Env vars
Add to `.env.local` and Vercel (see `.env.example`):

```
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_RSA_PRIVATE_KEY=
DOCUSIGN_AUTH_BASE=https://account-d.docusign.com
DOCUSIGN_API_BASE=https://demo.docusign.net/restapi
```

Leave the demo URLs until go-live.

### 5. Grant JWT consent (required once)
Log into the DocuSign demo user in the same browser, then open:

`https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=202a8c65-7e9a-4dfd-a8dc-d4b00c6e45a5&redirect_uri=https://intentrev.net/begin`

Accept **signature** and **impersonation**. You should land on `/begin`. If consent is missing, signing fails with a consent error.

### 6. Test
1. Stripe test keys must be set
2. Go to `/leadnet`
3. Pay with a Stripe test card (`4242…`)
4. After payment, the LeadNet agreement should open in DocuSign
5. Sign. You return to `/begin/signed`

If payment works but the agreement does not open, check Vercel logs for DocuSign auth or consent errors.

### 7. Production
1. Complete DocuSign go-live on the same integration
2. Copy production Integration Key, User ID, and API Account ID
3. Generate a production RSA keypair (or use the promoted app keys DocuSign assigns)
4. Grant consent again on the live auth host
5. Switch env:

```
DOCUSIGN_AUTH_BASE=https://account.docusign.com
DOCUSIGN_API_BASE=https://na4.docusign.net/restapi
```

Use the REST base DocuSign shows for your production account if it is not `na4`.
