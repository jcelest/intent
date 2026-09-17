import { BRAND_NAME } from "@/lib/seo";
import {
  LEADNET_AGREEMENT_VERSION,
  LEADNET_FOLLOW_UP,
  OFFER_EXCLUSIONS,
  WEBSITE_INCLUDED,
  type LeadNetCustomerDetails,
  type LeadNetOrderSnapshot,
} from "@/lib/leadnet-offer";
import { formatCurrency } from "@/lib/utils";

export function leadNetWebsiteAgreementHtml(input: {
  details: LeadNetCustomerDetails;
  order: LeadNetOrderSnapshot;
}) {
  const { details, order } = input;
  const todayLines = order.oneTimeCharges
    .map((charge) => `<li>${escapeHtml(charge.label)}: <strong>${formatCurrency(charge.amountCents)}</strong></li>`)
    .join("");
  const recurringLines = order.recurringWebsiteCharges.length
    ? order.recurringWebsiteCharges
        .map((charge) => `<li>${escapeHtml(charge.label)}: <strong>${formatCurrency(charge.amountCents)}/month</strong></li>`)
        .join("")
    : "<li>No recurring website subscription from this order.</li>";
  const activationLines = order.activationCharges.length
    ? order.activationCharges
        .map((charge) => `<li>${escapeHtml(charge.label)}: <strong>${formatCurrency(charge.amountCents)}/month</strong>, beginning only when that service is activated.</li>`)
        .join("")
    : "<li>No optional future activation subscriptions selected.</li>";

  return `<div style="font-family: Georgia, serif; color: #111; line-height: 1.55; max-width: 760px; margin: 0 auto; padding: 32px; background: white; border-radius: 8px;">
    <h1 style="font-size: 22px;">${BRAND_NAME} Website and LeadNet Agreement</h1>
    <p><strong>Agreement version:</strong> ${LEADNET_AGREEMENT_VERSION}</p>
    <p>This agreement is between ${BRAND_NAME} ("Intent") and the client named below. It reflects the order accepted at checkout and is not legal-review language.</p>
    <p><strong>Client:</strong> ${escapeHtml(details.company)}<br/>
    <strong>Signer:</strong> ${escapeHtml(details.name)}<br/>
    <strong>Email:</strong> ${escapeHtml(details.email)}<br/>
    <strong>Phone:</strong> ${escapeHtml(details.phone)}</p>

    <h2 style="font-size: 16px;">1. Selected website package</h2>
    <p>The client selected <strong>${escapeHtml(order.package.name)}</strong> in <strong>${order.selection.paymentMode}</strong> mode. The package supports up to <strong>${order.package.pageLimit}</strong> agreed public content pages. The exact page list will be agreed before production.</p>
    <p><strong>Business context:</strong> ${escapeHtml(details.industry)}. <strong>Services:</strong> ${escapeHtml(details.services)}. <strong>Service areas:</strong> ${escapeHtml(details.serviceAreas)}. <strong>Domain status:</strong> ${escapeHtml(details.domainStatus)}.</p>

    <h2 style="font-size: 16px;">2. Included website work</h2>
    <ul>${WEBSITE_INCLUDED.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p>${escapeHtml(order.revisionScope)}</p>

    <h2 style="font-size: 16px;">3. Charges due today</h2>
    <p>The client authorizes Intent and Stripe to charge <strong>${formatCurrency(order.dueTodayCents)}</strong> at checkout before applicable taxes.</p>
    <ul>${todayLines}</ul>

    <h2 style="font-size: 16px;">4. Recurring website charges</h2>
    <ul>${recurringLines}</ul>
    <p>For monthly website orders, setup and the first month are collected at checkout. Later website billing renews monthly on the subscription billing anniversary. Monthly website subscriptions have no minimum term or minimum payment count. Setup fees do not recur.</p>

    <h2 style="font-size: 16px;">5. Optional services that start later</h2>
    <ul>${activationLines}</ul>
    <p>Future activation subscriptions are not charged today. If selected, the client authorizes Intent and Stripe to securely store and use the payment method submitted during checkout for the selected future recurring charges once the applicable service is activated.</p>

    <h2 style="font-size: 16px;">6. Website Care</h2>
    <p>Website Care is available only to upfront website buyers. It is $49/month and includes hosting, technical maintenance, and up to 30 minutes of content edits per billing month. Unused edit time does not roll over. New pages, redesigns, and additional functionality require a separate quote. Monthly website customers do not receive a second Website Care charge.</p>

    <h2 style="font-size: 16px;">7. LeadNet Follow-Up</h2>
    <p>LeadNet Follow-Up is optional software billed at <strong>${formatCurrency(LEADNET_FOLLOW_UP.monthlyCents)}/month</strong> beginning only when LeadNet is activated. Standard setup is included for website customers. LeadNet cancellation is independent of any website or care subscription.</p>
    <p>Verified included capabilities are one business texting number, SMS inbox and owner replies, configured text-back and intake, review-request tools, self-service reactivation access where operational, and ${LEADNET_FOLLOW_UP.includedSmsSegments.toLocaleString()} SMS segments per billing month, inbound and outbound combined. Included segments do not roll over. Long messages may use multiple segments. Additional SMS segments are $0.03 each only within an expressly approved overage budget. The default approved overage budget is $0, so no unapproved SMS overage billing is authorized.</p>

    <h2 style="font-size: 16px;">8. Ownership and cancellation</h2>
    <p>${escapeHtml(order.ownershipSummary)}</p>
    <p>${escapeHtml(order.cancellationSummary)}</p>
    <p>The customer owns their domain and supplied business content from the beginning. Intent will not withhold the customer domain or original supplied content. Cancellation does not automatically mean refund, and any refund request is handled under existing approved refund terms or applicable law.</p>

    <h2 style="font-size: 16px;">9. Client responsibilities</h2>
    <p>The client will provide accurate business information, approvals, content, branding assets, and account access needed to perform the work. Passwords must not be submitted through ordinary forms; secure access handoff happens during onboarding.</p>

    <h2 style="font-size: 16px;">10. Exclusions and no guarantees</h2>
    <ul>${OFFER_EXCLUSIONS.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p>Intent does not guarantee rankings, indexing, traffic, leads, booked jobs, reviews, or revenue. Third-party platforms, search engines, carriers, analytics products, hosting providers, and payment processors may affect timing or functionality.</p>

    <h2 style="font-size: 16px;">11. Messaging compliance</h2>
    <p>The client represents that it has the necessary consent, authorization, and records for any customer messaging it initiates through LeadNet. The client remains responsible for its customer lists, message content, and compliance with applicable messaging laws and carrier standards.</p>

    <h2 style="font-size: 16px;">12. Third-party licensing</h2>
    <p>Transferred upfront website deliverables are subject to third-party licensing limits for fonts, plugins, frameworks, stock assets, hosting platforms, analytics tools, and other outside services.</p>

    <h2 style="font-size: 16px;">13. Authority</h2>
    <p>The signer affirms they have authority to bind the client to this agreement.</p>
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
