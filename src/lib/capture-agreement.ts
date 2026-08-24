import { BRAND_NAME } from "@/lib/seo";
import {
  CAPTURE_ADDONS,
  LEADNET_INCLUDED_DAYS,
  LEADNET_MONTHLY_CENTS,
  LEADNET_PHONE_PATHS,
  addonDisplayCents,
  leadNetSprintCents,
  type CaptureAddonId,
} from "@/lib/engagements";
import { formatCurrency } from "@/lib/utils";

export function captureAgreementHtml(input: {
  name: string;
  company: string;
  email: string;
  phone: string;
  amountCents: number;
  addons: CaptureAddonId[];
}) {
  const addonLines = input.addons.length
    ? CAPTURE_ADDONS.filter((addon) => input.addons.includes(addon.id))
        .map(
          (addon) =>
            `<li>${addon.label} (${formatCurrency(addonDisplayCents(addon.amountCents))})</li>`
        )
        .join("")
    : "<li>None</li>";

  return `<!DOCTYPE html>
<html>
  <body style="font-family: Georgia, serif; color: #111; line-height: 1.5; max-width: 720px; margin: 0 auto; padding: 32px;">
    <h1 style="font-size: 22px;">${BRAND_NAME} LeadNet Agreement</h1>
    <p>This agreement is between ${BRAND_NAME} ("Intent") and the client named below.</p>
    <p><strong>Client:</strong> ${escapeHtml(input.company)}<br/>
    <strong>Signer:</strong> ${escapeHtml(input.name)}<br/>
    <strong>Email:</strong> ${escapeHtml(input.email)}<br/>
    <strong>Phone:</strong> ${escapeHtml(input.phone)}</p>
    <h2 style="font-size: 16px;">1. Service</h2>
    <p>Intent will set up Intent LeadNet for the client: Your Company's own LeadNet application, a branded intake page, speed-to-lead auto-replies, a tracking number with missed-call text-back, a dormant customer database reactivation engine, owner lead alerts, Google review SMS, and a company dashboard so inbound and reactivated jobs stay in the system. This is a productized sprint, not an assignment of software ownership unless a later signed contract says otherwise.</p>
    <h2 style="font-size: 16px;">2. Payment</h2>
    <p>The client pays <strong>${formatCurrency(input.amountCents)}</strong> through Stripe before signing. That amount is the sprint due today:</p>
    <ul>
      <li>Intent LeadNet base (${formatCurrency(leadNetSprintCents())})</li>
      ${addonLines}
    </ul>
    <p>After ${LEADNET_INCLUDED_DAYS} days from the sprint payment, LeadNet is <strong>${formatCurrency(LEADNET_MONTHLY_CENTS)} per month</strong>. The monthly covers the tracking number, voice on that number, missed-call text-back, owner alerts, and Google review SMS under ordinary trade volume. Intent bills the monthly separately. It is not charged on the sprint card in this payment. The client is an active client while the monthly is current (or during the included ${LEADNET_INCLUDED_DAYS} days). If the monthly lapses, Intent may suspend the tracking number, texts, and app access.</p>
    <h2 style="font-size: 16px;">3. What is included</h2>
    <p>Your Company's own LeadNet application, branded intake, tracking number and missed-call text-back, owner SMS on new leads, Google review SMS after the job, and a company dashboard with open estimated job value. Voice can go live after the tracking number is active. Public SMS may wait on carrier registration (10DLC or toll-free verification). Intent will start that registration promptly. The first ${LEADNET_INCLUDED_DAYS} days of the tracking number and texts are included in the sprint.</p>
    <h2 style="font-size: 16px;">4. Phone setup</h2>
    <p>LeadNet uses a tracking number Intent provides. The client chooses one of two setups at kickoff. Neither setup is sold as a Stripe add-on. Intent does not sell cell plans.</p>
    <p><strong>${LEADNET_PHONE_PATHS[0].title}.</strong> ${LEADNET_PHONE_PATHS[0].body}</p>
    <p><strong>${LEADNET_PHONE_PATHS[1].title}.</strong> ${LEADNET_PHONE_PATHS[1].body}</p>
    <h2 style="font-size: 16px;">5. What is not included</h2>
    <p>Intent does not guarantee a number of leads, reviews, booked jobs, or revenue. Paid ads, websites, and ongoing partnership work are separate unless a later signed writing says otherwise. A second cell line, eSIM, or carrier add-a-line is paid by the client to their carrier, not to Intent. Unusual voice or SMS volume may be billed extra or moved to a higher plan. Intent will contact the client before extra usage charges.</p>
    <h2 style="font-size: 16px;">6. Software ownership</h2>
    <p>Unless a written contract signed by Intent expressly assigns ownership or grants an exclusive license, Intent owns all software, applications, code, templates, dashboards, and related work product we create or customize, including this LeadNet instance. The client receives a limited, non-exclusive, non-transferable right to use it in their own trade business while they are an active client. Payment of the sprint does not transfer ownership.</p>
    <h2 style="font-size: 16px;">7. Client materials</h2>
    <p>The client's name, logo, job data, and customer lists remain the client's. Intent may use them to perform the work.</p>
    <h2 style="font-size: 16px;">8. Add-ons</h2>
    <p>Custom application styling and no watermark are included only if listed in section 2. No watermark removes the Designed with Intent Revenue mark from the live LeadNet app.</p>
    <h2 style="font-size: 16px;">9. Refunds and cancel</h2>
    <p>The LeadNet sprint fee is collected before this agreement is signed. The sprint is non-refundable once setup has started, except as required by law or a later signed writing. The client may cancel the monthly before a new month starts. Cancel stops new monthly charges. It does not refund the sprint. After cancel, Intent may release the tracking number.</p>
    <h2 style="font-size: 16px;">10. Law</h2>
    <p>Florida law governs this agreement.</p>
    <div style="margin-top: 56px; page-break-inside: avoid;">
      <p>Client signature: ____________________________________________</p>
      <p>Date signed: ______________</p>
      <p>${BRAND_NAME}</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
