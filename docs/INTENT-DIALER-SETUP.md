# Intent Dialer setup

The dialer lives at `/admin/dialer` and uses the existing Neon database. The power-dialer schema is installed with:

```powershell
npm.cmd run dialer:bootstrap-users
```

## Twilio

Add these server-side environment variables locally and in Vercel:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_TWIML_APP_SID=
TWILIO_PHONE_NUMBER=+1...
NEXT_PUBLIC_SITE_URL=https://intentrev.net
DIALER_PUBLIC_URL=https://call.intentrev.net
```

In the Twilio Console:

1. Create a Standard API key and copy its SID and one-time secret.
2. Create a TwiML App.
3. Set its Voice request URL to `https://call.intentrev.net/api/twilio/voice` using HTTP POST.
4. Open the Twilio number used by the dialer.
5. Set its incoming Voice webhook to `https://call.intentrev.net/api/twilio/inbound` using HTTP POST.

## Call subdomain

Add `call.intentrev.net` as a custom domain on the same Vercel project, then create the DNS record Vercel requests. The app recognizes that host automatically: `/` becomes the authenticated dialer workspace and `/login` becomes its sign-in page. The original `/admin/dialer` route remains available on the main domain.

The application verifies Twilio webhook signatures with `TWILIO_AUTH_TOKEN`. Do not put credentials in browser-visible variables or commit local environment files.

## Lead import

Use **Leads → Import CSV**. A phone column is required; common names such as `Phone`, `Phone Number`, `Mobile`, and `Telephone` are detected automatically. Name, company, email, city, state, ZIP, and source columns are also detected. Imports are limited to 5,000 rows per request.

The existing LeadNet pipeline can also be imported from the command line after confirming that its contact data may be uploaded to the configured database:

```powershell
npm.cmd run dialer:import-leadnet
```

## Calling behavior

- Only one outbound call is created at a time.
- The next eligible lead is dialed after the rep saves the prior disposition when auto-dial is enabled.
- DNC suppression, configured local call windows, closed leads, and the 24-hour attempt limit are enforced server-side.
- Recordings are disabled by default. Do not enable them until the applicable disclosure and consent workflow has been approved.
- Inbound callbacks ring all active dialer users registered in the browser.
