# LeadNet Checkout Flow — intentrev.net

This document details the active LeadNet and website checkout flow on `intentrev.net` based strictly on the production codebase implementation.

---

## 1. Checkout Page URLs

| Step | Page / Endpoint | URL | Purpose |
| :--- | :--- | :--- | :--- |
| **Landing / Entry** | Product & Pricing Overview | `https://intentrev.net/leadnet` | Product presentation, pricing configuration, portfolio showcase, FAQ |
| **Step 1** | Configuration & Customer Intake | `https://intentrev.net/begin` | Package selection, mode toggle, add-ons, 10 customer onboarding fields |
| **Step 2** | Service Agreement Review | `https://intentrev.net/begin/agreement` | Full legal contract display, clickwrap agreement acceptance |
| **Step 3** | Payment Execution | `https://intentrev.net/begin/pay` | Embedded Stripe Elements payment form |
| **Step 4** | Order Confirmation | `https://intentrev.net/begin/signed` | Post-payment confirmation, progress tracker, agreement download, billing portal |
| **Ancillary** | Agreement Download Endpoint | `https://intentrev.net/api/agreement/download?token={token}` | Agreement file retrieval endpoint |
| **Ancillary** | Billing Portal Endpoint | `https://intentrev.net/api/stripe/portal` | Redirects to Stripe Customer Portal session |

---

## 2. Every Step From Landing to Paid (In Order)

```
[ https://intentrev.net/leadnet ]
        │  Configure package & add-ons, click "Review agreement"
        ▼
[ https://intentrev.net/begin ]
        │  Select package, payment mode, add-ons; fill 10 onboarding fields
        │  Order state saved to browser sessionStorage ("intent-begin")
        │  Click "Review agreement"
        ▼
[ https://intentrev.net/begin/agreement ]
        │  Read rendered HTML contract
        │  Check mandatory clickwrap checkbox
        │  Click "Continue to Payment"
        │  POST /api/agreement/accept -> creates Stripe Customer & DB record
        ▼
[ https://intentrev.net/begin/pay ]
        │  POST /api/stripe/intent -> creates Subscription (monthly) or PaymentIntent (upfront)
        │  Enter card or wallet payment into embedded Stripe PaymentElement
        │  Click "Pay now" -> stripe.confirmPayment()
        ▼
[ https://intentrev.net/begin/signed ]
        │  Browser redirected to confirmation URL by Stripe
        │  Stripe webhook fires asynchronously to /api/stripe/webhook
        ▼
[ Order Completed & Confirmed ]
```

### Detailed Sequential Flow

1. **Step 0 — Product Presentation & Configurator (`/leadnet`)**:
   - The buyer visits `https://intentrev.net/leadnet`.
   - The page offers an interactive pricing configurator (`#pricing` section) allowing the buyer to preview packages (Business vs. Expanded), payment modes (Monthly vs. Upfront), and optional add-ons (LeadNet Speed To Lead, Website Care).
   - Clicking "Review agreement" links to `/begin` passing the selected options as URL query parameters (`/begin?package=...&mode=...&leadnet=...&care=...`).

2. **Step 1 — Configuration & Onboarding Intake (`/begin`)**:
   - The buyer lands on `https://intentrev.net/begin`.
   - The buyer can adjust the package, payment mode, and optional add-ons.
   - The buyer fills out 10 intake fields covering customer, business, domain, and scope details.
   - Upon clicking "Review agreement", the form validates inputs, serializes order snapshot and details to browser `sessionStorage` under the key `intent-begin`, and redirects the browser to `/begin/agreement`.

3. **Step 2 — Legal Agreement Review & Acceptance (`/begin/agreement`)**:
   - The page retrieves `intent-begin` from `sessionStorage`.
   - Renders an order summary card and the full contract HTML inside a scrollable box.
   - The buyer reviews terms, pricing, allowances, exclusions, and ownership rules.
   - The buyer clicks the clickwrap agreement checkbox.
   - The buyer clicks "Continue to Payment".
   - The browser dispatches a `POST` request to `/api/agreement/accept` with the payload.
   - The backend validates fields, initializes a Stripe Customer, creates a SHA-256 hash of the rendered contract, records client IP and User Agent, creates an agreement record in the PostgreSQL database (`agreements` table) with `payment_status = 'pending_payment'`, and returns `acceptanceId` and `publicDownloadToken`.
   - The client updates `sessionStorage` with these tokens and navigates to `/begin/pay`.

4. **Step 3 — Payment Execution (`/begin/pay`)**:
   - The page retrieves `acceptanceId` from `sessionStorage` and dispatches a `POST` request to `/api/stripe/intent`.
   - The backend looks up the agreement record:
     - **For Monthly mode**: Creates a Stripe Subscription with `payment_behavior: "default_incomplete"`, adds an invoice item for the one-time setup fee, retrieves the `latest_invoice` PaymentIntent, and updates the database with the subscription and payment intent IDs.
     - **For Upfront mode**: Creates a Stripe PaymentIntent for the full upfront amount, sets `setup_future_usage: "off_session"` if future activation subscriptions (LeadNet or Care) were selected, and updates the database with the payment intent ID.
     - Returns `clientSecret` and `returnUrl` set to `https://intentrev.net/begin/signed`.
   - The frontend mounts the embedded Stripe Elements form (`<PaymentElement options={{ layout: "tabs" }} />`).
   - The buyer enters their payment details and clicks "Pay now".
   - The Stripe client library calls `stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } })`.

5. **Step 4 — Post-Payment Confirmation (`/begin/signed`)**:
   - Stripe redirects the buyer to `https://intentrev.net/begin/signed`.
   - The buyer sees the order confirmation screen with an animated progress stepper, agreement download button, and Stripe billing portal button.
   - Asynchronously, Stripe delivers webhook events (`invoice.paid` for subscriptions or `payment_intent.succeeded` for upfront charges) to `https://intentrev.net/api/stripe/webhook`.
   - The webhook handler verifies event signatures, updates the database agreement status to `payment_completed`, records payment timestamps, marks onboarding status as `payment_confirmed`, and saves reusable payment methods for future activation billing if applicable.

---

## 3. What the Buyer Sees at Each Step

### Step 1: Configuration & Intake (`/begin`)

* **Product Names**:
  * **Business Website**: Up to 7 agreed public content pages.
  * **Expanded Website**: Up to 25 agreed public content pages for substantive services and service-area coverage.
  * **LeadNet Speed To Lead**: Optional software add-on. Includes one business texting number, inbox, owner replies, configured text-back and intake, review-request tools, and 1,000 SMS segments per billing month.
  * **Website Care**: Optional add-on for upfront buyers only. Includes hosting, technical maintenance, and up to 30 minutes of content edits per billing month.
* **Pricing Displayed**:
  * **Business Website**:
    * Monthly mode: **$297 setup + $197/month** ($494 due today).
    * Upfront mode: **$1,497 flat** ($1,497 due today).
  * **Expanded Website**:
    * Monthly mode: **$497 setup + $297/month** ($794 due today).
    * Upfront mode: **$2,497 flat** ($2,497 due today).
  * **LeadNet Speed To Lead**:
    * **$197/month** beginning at LeadNet activation. ($0 due today; standard setup included in bundle).
  * **Website Care**:
    * Upfront buyers: **$49/month** beginning when hosting service is activated. ($0 due today).
    * Monthly buyers: Replaced with text: *"Monthly managed websites already include hosting, maintenance, and up to 30 minutes of content edits per month."*
  * **Exact Summary Box**:
    * "Due today": Large total amount formatted in USD.
    * Itemized breakdown of one-time charges due today.
    * "Website renews": Recurring monthly website cost ($197/mo or $297/mo, if monthly mode).
    * "Billing starts later": Future activation subscriptions ($197/mo for LeadNet, $49/mo for Care).
* **Terms, Disclaimers, and Scope Text**:
  * *"No minimum subscription term. No 12-payment plan. No automatic price drop or automatic website ownership transfer."*
  * **Ownership Summary**:
    * Monthly: *"The customer owns their domain and supplied business content. The monthly plan provides a managed hosted website while subscribed and does not automatically transfer website source or design ownership."*
    * Upfront: *"The customer owns their domain and supplied business content. Agreed website deliverables transfer upon completion and full payment, subject to third-party licensing limitations."*
  * **Cancellation Summary**:
    * Monthly: *"The monthly website subscription has no minimum term. Future renewals can be cancelled anytime; service continues through the paid billing period, and hosted website service ends afterward unless separate transition terms are arranged."*
    * Upfront: *"There is no mandatory website subscription for upfront purchases. Optional Care and LeadNet subscriptions can be cancelled independently for future renewal periods."*
  * **SMS Overages**: *"SMS overages are disabled by default. Additional SMS segments are $0.03 only within an expressly approved overage budget."*
  * **Data Privacy / Passwords**: *"Do not enter passwords here. We collect account access through secure handoff during onboarding. Subject to Terms and Privacy Policy."*

### Step 2: Agreement Review (`/begin/agreement`)

* **Header**: Kicker: `Review Agreement`, Title: `Service Agreement`, Body: `Please review and accept the agreement before proceeding to payment.`
* **Agreement Summary Card**:
  * Customer: Company Name (Signer Name)
  * Package: Package Name – Payment Mode (e.g., `Business Website - monthly`)
  * Due today: Amount in USD
  * Future recurring: Amount in USD/month after services activate, or `"No recurring charge from this order"`
* **Full Contract Document** (`Intent Revenue Website and LeadNet Agreement` — Version: `leadnet-website-first-2026-09-speed-to-lead-v1`):
  * **Section 1 (Selected Package)**: Package name, payment mode, page limit (7 or 25), stated industry, services, service areas, and domain status.
  * **Section 2 (Included Website Work)**: 11 deliverables:
    1. Mobile-friendly design using a repeatable design system adapted to the business
    2. Business branding
    3. Initial copy based on verified customer information
    4. Inquiry form and click-to-call
    5. Initial technical/on-page SEO setup
    6. Relevant titles and descriptions
    7. Crawlable page content and sitemap
    8. Appropriate structured data
    9. Analytics and Search Console setup, subject to account access
    10. Two consolidated prelaunch revision rounds
    11. Agreed page list before production
    * Revision Scope: *"Two consolidated prelaunch revision rounds are included. Ongoing edit allowances, where active, cover up to 30 minutes of content edits per billing month and do not roll over."*
  * **Section 3 (Charges Due Today)**: Authorizes Intent and Stripe to charge the specified amount at checkout before applicable taxes, itemizing one-time setup and purchase charges.
  * **Section 4 (Recurring Website Charges)**: Details monthly renewal rules, billing anniversary, no minimum term, and confirms setup fees do not recur.
  * **Section 5 (Optional Services Starting Later)**: States future activation subscriptions are not charged today; authorizes Intent and Stripe to store payment credentials for activation billing.
  * **Section 6 (Website Care)**: $49/month for upfront buyers; covers hosting, maintenance, and 30 min/month non-rollover edits. Excludes redesigns and new pages.
  * **Section 7 (LeadNet Speed To Lead)**: $197/month beginning at activation; 1,000 combined inbound/outbound SMS segments/month; overages billed at $0.03/segment only inside an approved budget; default approved budget is $0.
  * **Section 8 (Ownership & Cancellation)**: Ownership and cancellation summaries; confirms Intent will not withhold domain or content; states cancellation does not automatically entitle client to refunds.
  * **Section 9 (Client Responsibilities)**: Client must provide accurate info, content, approvals, and access; no passwords in ordinary forms.
  * **Section 10 (Exclusions & No Guarantees)**:
    * Exclusions: Ongoing SEO management; monthly content production or ranking campaigns; ecommerce; custom applications; complex integrations; logo design or photography unless separately agreed; unlimited revisions or edits; guaranteed rankings, indexing, traffic, leads, or revenue.
    * **No Guarantee Text**: *"Intent does not guarantee rankings, indexing, traffic, leads, booked jobs, reviews, or revenue. Third-party platforms, search engines, carriers, analytics products, hosting providers, and payment processors may affect timing or functionality."*
  * **Section 11 (Messaging Compliance)**: Client affirms consent and authorization for messaging and accepts sole regulatory/carrier compliance responsibility.
  * **Section 12 (Third-Party Licensing)**: Transferred upfront deliverables remain subject to upstream software/asset license limits.
  * **Section 13 (Authority)**: Signer affirms legal authority to bind the client.
* **Clickwrap Checkbox**: *"I have read and agree to this website and LeadNet agreement, including the charges due today and any selected future activation subscriptions."*
* **Button**: "Continue to Payment" (disabled until checked).

### Step 3: Payment (`/begin/pay`)

* **Header**: Kicker: `Agreement Signed`, Title: `Almost done.`, Body: `Complete the payment to kick off your sprint and activate LeadNet.`
* **Payment Card**:
  * Title: `Payment`
  * Text: *"Complete the charge shown in the accepted agreement. Future activation subscriptions are not charged today."*
  * Embedded Stripe Payment Element (tabs layout, custom night/cyan theme).
  * Button: "Pay now" (changes to "Confirming…" upon click).

### Step 4: Confirmation (`/begin/signed`)

* **Header**: Kicker: `Order submitted`, Title: `We have the signed order.`
* **Body Text**: *"Your payment is being securely confirmed. We will review the onboarding details, confirm any missing access through secure handoff, and schedule the website build. Optional Care and LeadNet billing begin only when those services are activated."*
* **Progress Tracker Steps**:
  1. `Agreement accepted` (Status: Complete)
  2. `Payment confirming` (Status: Checking -> Complete)
  3. `Onboarding review` (Status: In progress, with animated progress bar)
  4. `Website build` (Status: Queued)
* **Action Buttons**:
  * "Download Service Agreement" (triggers file download)
  * "Manage billing" (opens Stripe Customer Portal)
  * "Back to Intent" (link to homepage)

---

## 4. Every Field Collected

### Onboarding & Intake Fields (`/begin`)

| # | Field Label | Property Name | Input Type | Required | HTML Attributes / Placeholder |
| :- | :--- | :--- | :--- | :-: | :--- |
| 1 | Your name | `details.name` | Text | Yes | `required`, `autoComplete="name"` |
| 2 | Company name | `details.company` | Text | Yes | `required`, `autoComplete="organization"` |
| 3 | Email | `details.email` | Email | Yes | `required`, `type="email"`, `autoComplete="email"` |
| 4 | Phone | `details.phone` | Tel | Yes | `required`, `type="tel"`, `inputMode="tel"`, `autoComplete="tel"` |
| 5 | Industry | `details.industry` | Text | Yes | `required` |
| 6 | Domain status | `details.domainStatus` | Text | Yes | `required`, placeholder: `"Have one / need one / not sure"` |
| 7 | Services | `details.services` | Text | Yes | `required` |
| 8 | Service areas | `details.serviceAreas` | Text | Yes | `required` |
| 9 | Branding/assets | `details.brandingAssets` | Text | No | placeholder: `"Logo, colors, photos, or none yet"` |
| 10 | Notes | `details.notes` | Text | No | placeholder: `"No passwords here"` |

### Order Configuration Fields (`/begin` or via URL query parameters)

| Control | Property | Allowed Values |
| :--- | :--- | :--- |
| Payment Mode Toggle | `selection.paymentMode` | `"monthly"` or `"upfront"` |
| Package Selector | `selection.packageId` | `"business"` or `"expanded"` |
| LeadNet Checkbox | `selection.leadNetSelected` | `true` or `false` |
| Website Care Checkbox | `selection.careSelected` | `true` or `false` *(only enabled in Upfront mode)* |

### Agreement Acceptance Fields (`/begin/agreement`)

| Field | Source / Method | Captured Value |
| :--- | :--- | :--- |
| Acceptance Checkbox | User click | Boolean (`true` required to proceed) |
| Agreement Version | Code constant | `"leadnet-website-first-2026-09-speed-to-lead-v1"` |
| Offer Version | Code constant | `"leadnet-website-first-2026-09-speed-to-lead"` |
| Agreement SHA-256 Hash | Server calculation | 64-character SHA-256 hex digest of exact generated agreement HTML |
| Client IP Address | Request header | `x-forwarded-for` (first hop) |
| Client User Agent | Request header | `user-agent` |
| Acceptance Timestamp | Server runtime | ISO 8601 string (`accepted_at`) |

### Payment Fields (`/begin/pay`)

* Collected directly via embedded Stripe Elements:
  * Card number
  * Expiration date (MM/YY)
  * CVC code
  * Country and Postal / ZIP code
  * Digital wallet credentials (Apple Pay / Google Pay / Link) where supported by the browser

---

## 5. Payment Processor and Hosted vs. Embedded

* **Payment Processor**: **Stripe**.
* **Integration Architecture**: **Embedded**.
  * Checkout does not use Stripe Checkout (`checkout.stripe.com`).
  * The payment interface is rendered directly inside the Intent webpage on `https://intentrev.net/begin/pay` using `@stripe/react-stripe-js` (`<PaymentElement options={{ layout: "tabs" }} />`).
  * The form is styled inline to match the site design using a custom Stripe appearance configuration (`theme: "night"`, cyan primary `#22d3ee`, background `#020617`, text `#f8fafc`).
  * *Note*: The post-payment "Manage billing" button uses `/api/stripe/portal`, which redirects to Stripe's hosted Billing Portal for self-service subscription management.

---

## 6. Terms Acceptance Mechanism

* **Primary Acceptance Method**: **Click-to-accept / Clickwrap checkbox**.
* **Location**: `https://intentrev.net/begin/agreement` (Step 2, prior to payment entry).
* **Implementation Details**:
  * The full generated agreement text is presented inside a dedicated, scrollable HTML element (`h-[50vh] overflow-y-auto`).
  * The buyer must actively select an interactive checkbox stating:
    > *"I have read and agree to this website and LeadNet agreement, including the charges due today and any selected future activation subscriptions."*
  * The "Continue to Payment" button is locked (`disabled={!agreed || loading}`) until the box is checked.
  * When submitted, `/api/agreement/accept` commits the full contract HTML, its SHA-256 hash, client IP address, user-agent string, and timestamp to the PostgreSQL `agreements` table.
* **E-Signature**: **None**.
  * The active checkout flow does not require or present an e-signature solution (e.g., DocuSign signature pad or typed signature).
  * *(A DocuSign signing endpoint `src/app/api/docusign/start/route.ts` exists in the codebase from a legacy iteration, but is not part of the active checkout sequence).*
* **Browsewrap Notice**:
  * On `/begin`, text beneath the primary button links to `/terms` and `/privacy`:
    > *"Do not enter passwords here. We collect account access through secure handoff during onboarding. Subject to Terms and Privacy Policy."*

---

## 7. What Happens Right After Payment Clears

### Confirmation Page

* Stripe Elements executes `confirmPayment` and redirects the browser to `https://intentrev.net/begin/signed`.
* The page displays:
  * Title: *"We have the signed order."*
  * Subtitle / Kicker: *"Order submitted"*
  * Explanatory text confirming that payment is being verified, onboarding info will be reviewed, access credentials will be collected through secure handoff, and website build will be scheduled.
  * An animated 4-stage stepper (`BeginProgress`):
    1. Agreement accepted: `Complete`
    2. Payment confirming: `Checking` -> `Complete`
    3. Onboarding review: `In progress`
    4. Website build: `Queued`
  * Action buttons:
    * **"Download Service Agreement"**: Navigates to `/api/agreement/download?token={publicDownloadToken}`, downloading the exact accepted agreement.
    * **"Manage billing"**: Triggers POST to `/api/stripe/portal` to open the Stripe Customer Portal.
    * **"Back to Intent"**: Link returning to `https://intentrev.net/`.

### Backend Processing (Stripe Webhook)

* Stripe dispatches an asynchronous webhook to `https://intentrev.net/api/stripe/webhook` (`invoice.paid` for monthly subscriptions or `payment_intent.succeeded` for upfront payments).
* The handler:
  1. Validates the Stripe signature header (`stripe-signature`).
  2. Ensures idempotency via `stripe_webhook_events` table.
  3. Attaches reusable payment methods to the Stripe Customer if future activation add-ons (LeadNet or Care) were selected.
  4. Updates the database `agreements` record:
     * `payment_status = 'payment_completed'`
     * `subscription_status = 'active'` (for monthly plans)
     * `website_subscription_status = 'active'` (for monthly plans)
     * `initial_payment_paid_at = [timestamp]`
     * `payment_completed_at = CURRENT_TIMESTAMP`
     * `onboarding_status = 'payment_confirmed'`
     * `service_states.payment = 'paid'`

### Emails Sent to Buyer

* **Application-level emails**: **None**. The Next.js application / backend does not send any custom transactional email upon checkout or payment completion.
* **Stripe automated receipts**: When creating the upfront PaymentIntent, the application sets `receipt_email: record.customer_email` (and registers the email on the Stripe Customer). If the Stripe Account settings have customer receipts enabled, Stripe sends its standard automated payment receipt directly to the buyer.

### Emails Sent to Site Owner / Merchant

* **Application-level emails**: **None**. The checkout and webhook routes (`/api/stripe/intent`, `/api/agreement/accept`, `/api/stripe/webhook`) contain no email delivery logic. *(Transactional email via Resend is implemented only for the general contact form at `/api/inquiry`).*
* **Stripe automated notifications**: Notifications to the site owner depend entirely on Stripe account dashboard notification settings for successful payments and new subscriptions.

---

## 8. Deposit Plus Later Balance vs. Single Flat Payment

* **Payment Structure**: **Only flat payment in full at checkout (No deposits or split balances)**.
* **Upfront Website Mode**:
  * The buyer pays **100% of the purchase price upfront at checkout** ($1,497 for Business Website; $2,497 for Expanded Website).
  * There is no milestone split, deposit structure, or post-delivery balance collection.
* **Monthly Managed Mode**:
  * The buyer pays the **full setup fee plus the entire first month's subscription upfront at checkout** ($494 for Business Website; $794 for Expanded Website).
  * Recurring monthly charges begin one month later on the subscription anniversary date.
* **Optional Future Add-ons**:
  * LeadNet Speed To Lead ($197/mo) and Website Care ($49/mo) are **not deposits** and are billed at **$0 today**. Billing starts only after the services are activated.
* **Contract Rule**:
  * The contract explicitly stipulates: *"No minimum subscription term. No 12-payment plan. No automatic price drop or automatic website ownership transfer."*

---

## 9. Mobile Rendering and Responsiveness

The checkout flow is built mobile-first using Tailwind CSS responsive breakpoints (`sm:`, `lg:`):

* **Container & Padding**:
  * All pages use fluid widths with responsive horizontal gutters (`px-4 sm:px-6 lg:px-8`), preventing viewport clipping on narrow screens (320px–420px).
* **Configuration & Intake Screen (`/begin`)**:
  * **Layout Stacking**: On desktop (`lg:`), the page renders as a two-column layout (form left `1fr`, order summary right `0.82fr`). On mobile (`< 1024px`), it collapses into a single vertical column: the intake form appears first, followed by the "Exact summary" card underneath.
  * **Toggle & Selection Buttons**: Mode buttons ("Monthly" / "Upfront") and package selection cards collapse from a 2-column grid (`sm:grid-cols-2`) to full-width vertically stacked buttons on mobile.
  * **Intake Form Grid**: The 10 intake fields collapse from a 2-column grid (`sm:grid-cols-2`) to a single-column vertical stack. Inputs have 100% width with touch-friendly heights and spacing.
  * **Submit Button**: The "Review agreement" button spans the full width (`w-full`).
* **Agreement Screen (`/begin/agreement`)**:
  * **Summary Block**: The 4-item agreement summary card collapses from 2 columns (`sm:grid-cols-2`) to a single column stack.
  * **Agreement Box**: Contract text is housed in an inline scrollable container constrained to half the screen height (`h-[50vh] overflow-y-auto`). On mobile, this prevents the long contract text from blocking access to the acceptance checkbox.
  * **Clickwrap Button**: Renders as a full-width card with a 24px (`h-6 w-6`) checkbox touch target.
  * **Action Button**: The "Continue to Payment" button expands to full width on mobile (`w-full sm:w-auto sm:self-end`).
* **Payment Screen (`/begin/pay`)**:
  * Housed in a centered container (`max-w-xl mx-auto`).
  * Stripe Elements renders in tabbed layout (`layout: "tabs"`), adapting input fields, credit card brand logos, and wallet buttons (Apple Pay, Google Pay) to fit mobile device dimensions.
  * The "Pay now" button is styled full-width (`w-full`) for easy thumb activation.
* **Confirmation Screen (`/begin/signed`)**:
  * Centered single-column layout (`max-w-lg mx-auto`).
  * The vertical progress stepper (`BeginProgress`) maintains full readability on narrow viewports with vertical connector lines.
  * "Download Service Agreement" and "Manage billing" buttons stack vertically in a centered flex column (`flex flex-col items-center gap-8`).
