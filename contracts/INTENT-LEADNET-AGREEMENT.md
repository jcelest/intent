# Intent LeadNet Agreement

Copy this into a DocuSign template if you prefer templates over the live HTML envelope the site already sends. The `/begin` flow can also generate this agreement and collect the signature through the DocuSign API.

**Parties:** Intent Revenue ("Intent") and the Client named on the envelope.

## 1. Service
Intent will set up Intent LeadNet for the Client: branded intake, missed-call text-back, owner lead alerts, Google review SMS, and a shop dashboard so nothing slips through the cracks. This is a productized sprint. It is not an assignment of software ownership unless a later signed contract says otherwise.

## 2. Amount
- Base sprint: $999
- Custom application styling (optional): $250
- No watermark (optional): $250

The amount on the envelope is the base plus any selected add-ons.

## 3. Software ownership
Unless a written contract signed by Intent expressly assigns ownership or grants an exclusive license, Intent owns all software, applications, code, templates, dashboards, and related work product we create or customize, including this LeadNet instance. The Client receives a limited, non-exclusive, non-transferable right to use it in their own trade business while they are an active client. Payment does not transfer ownership.

## 4. Client materials
The Client's name, logo, job data, and customer lists remain the Client's. Intent may use them to perform the work.

## 5. Carriers and platforms
Voice can go live after the tracking number is active. Public SMS may wait on 10DLC or toll-free verification. Intent will start registration promptly. Intent does not guarantee a specific number of leads, reviews, or jobs.

## 6. Add-ons
Custom styling and no watermark are included only if listed on the envelope. No watermark removes "Designed with Intent Revenue" from the live app.

## 7. Refunds
The LeadNet sprint is non-refundable once setup has started, except as required by law or a later signed writing.

## 8. Law
Florida law governs this agreement.

---

## DocuSign setup (once)

1. Create a DocuSign developer account at https://developers.docusign.com
2. Apps and Keys: copy Integration Key, User ID, API Account ID
3. Generate RSA keypair. Paste the private key into `DOCUSIGN_RSA_PRIVATE_KEY` (keep `\n` for newlines in Vercel)
4. Grant JWT consent (admin):  
   `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://intentrev.net/begin`
5. Add env vars from `.env.example`
6. Test on `/leadnet` → Begin LeadNet → Sign the agreement

Production: switch `DOCUSIGN_AUTH_BASE` and `DOCUSIGN_API_BASE` to the live account URLs after go-live.
