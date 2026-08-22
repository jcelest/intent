import { BRAND_NAME } from "@/lib/seo";
import { CAPTURE_ADDONS, type CaptureAddonId } from "@/lib/engagements";
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
            `<li>${addon.label} (${formatCurrency(addon.amountCents)})</li>`
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
    <p>Intent will set up Intent LeadNet for the client: Your Company's own LeadNet application, a branded intake page, a tracking number with missed-call text-back, owner lead alerts, Google review SMS, and a company dashboard so inbound jobs stay in the system. This is a productized sprint, not an assignment of software ownership unless a later signed contract says otherwise.</p>
    <h2 style="font-size: 16px;">2. Payment</h2>
    <p>The client pays <strong>${formatCurrency(input.amountCents)}</strong> through Stripe before signing. That amount is:</p>
    <ul>
      <li>Intent LeadNet base (${formatCurrency(99900)})</li>
      ${addonLines}
    </ul>
    <h2 style="font-size: 16px;">3. What is included</h2>
    <p>Your Company's own LeadNet application, branded intake, tracking number and missed-call text-back, owner SMS on new leads, Google review SMS after the job, and a company dashboard with open estimated job value. Voice can go live after the tracking number is active. Public SMS may wait on carrier registration (10DLC or toll-free verification). Intent will start that registration promptly.</p>
    <h2 style="font-size: 16px;">4. What is not included</h2>
    <p>Intent does not guarantee a number of leads, reviews, booked jobs, or revenue. Paid ads, websites, and ongoing partnership work are separate unless a later signed writing says otherwise.</p>
    <h2 style="font-size: 16px;">5. Software ownership</h2>
    <p>Unless a written contract signed by Intent expressly assigns ownership or grants an exclusive license, Intent owns all software, applications, code, templates, dashboards, and related work product we create or customize, including this LeadNet instance. The client receives a limited, non-exclusive, non-transferable right to use it in their own trade business while they are an active client. Payment does not transfer ownership.</p>
    <h2 style="font-size: 16px;">6. Client materials</h2>
    <p>The client's name, logo, job data, and customer lists remain the client's. Intent may use them to perform the work.</p>
    <h2 style="font-size: 16px;">7. Add-ons</h2>
    <p>Custom application styling and no watermark are included only if listed in section 2. No watermark removes the Designed with Intent Revenue mark from the live LeadNet app.</p>
    <h2 style="font-size: 16px;">8. Refunds</h2>
    <p>The LeadNet fee is collected before this agreement is signed. The sprint is non-refundable once setup has started, except as required by law or a later signed writing.</p>
    <h2 style="font-size: 16px;">9. Law</h2>
    <p>Florida law governs this agreement.</p>
    <p style="margin-top: 48px;">Client signature: _________________________________ Date: ______________</p>
    <p>${BRAND_NAME}</p>
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
