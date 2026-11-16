import {
  type B2BCustomerDetails,
  type B2BOrderSnapshot,
} from "@/lib/b2b-offer";

export function commercialPartnershipsAgreementHtml(input: {
  details: B2BCustomerDetails;
  order: B2BOrderSnapshot;
}) {
  const { details, order } = input;

  const clientCompanyName = escapeHtml(details.company || "Miller Heating & Cooling LLC");
  const signerName = escapeHtml(details.name || "");
  const signerEmail = escapeHtml(details.email || "");
  const signerPhone = escapeHtml(details.phone || "");
  const serviceArea = escapeHtml(
    details.serviceArea || "Escambia and Santa Rosa County, Florida"
  );
  const targetAccountCount = order.targetAccountCount || 3;
  const targetAccountOrdinal =
    targetAccountCount === 1
      ? "1st"
      : targetAccountCount === 2
      ? "2nd"
      : targetAccountCount === 3
      ? "3rd"
      : `${targetAccountCount}th`;

  const clientLocationText = details.company.includes("Miller")
    ? ", Pensacola, Florida"
    : details.serviceArea
    ? `, ${escapeHtml(details.serviceArea)}`
    : "";

  const contactLine =
    signerName || signerEmail || signerPhone
      ? `<p style="margin-top: 6px; font-size: 13px; color: #475569;">Signer: ${signerName}${signerEmail ? ` | Email: ${signerEmail}` : ""}${signerPhone ? ` | Phone: ${signerPhone}` : ""}</p>`
      : "";

  return `<div style="font-family: Georgia, serif; color: #111; line-height: 1.55; max-width: 760px; margin: 0 auto; padding: 32px; background: white; border-radius: 8px;">
    <h1 style="font-size: 20px; font-weight: bold; margin-bottom: 20px;">Commercial Partnerships Service Agreement</h1>

    <p>This Agreement is between Intent Revenue ("Provider"), operated by Josh Celestin, Apopka, Florida, and ${clientCompanyName} ("Client")${clientLocationText}. Together, the "Parties."</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">1. Service</h2>
    <p>Provider will run a Commercial Partnerships campaign for Client: building a target list of commercial accounts in ${serviceArea}, running outreach to those accounts, and managing Client's vendor onboarding with them end to end, including vendor packets, certificates of insurance, W-9, licensing, rate sheets, and portal setup.</p>
    <p>Target: ${targetAccountCount} commercial accounts, agreed in writing between the Parties before outreach begins. Accounts beyond ${targetAccountCount} that result from the same outreach are Client's at no extra charge.</p>
    <p>This is not a lead sale. No leads are sold, and no account is promised to send work by any specific date. Accounts send work on their own schedule and need.</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">2. Fees</h2>
    <p>Total fee: $4,000, payable as:</p>
    <ul style="margin-top: 8px; margin-bottom: 8px; padding-left: 24px;">
      <li>$2,000 start payment, due on signing, before outreach begins.</li>
      <li>$2,000 completion payment, due when the ${targetAccountOrdinal} account reaches Onboarded status as defined in Section 3.</li>
    </ul>
    <p>No retainer, no per lead fees, and no other fees under this Agreement.</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">3. Definitions</h2>
    <p><strong>Onboarded account.</strong> An account counts as Onboarded when all four are true:</p>
    <ol style="margin-top: 8px; margin-bottom: 8px; padding-left: 24px;">
      <li>The account has approved Client's vendor packet in writing.</li>
      <li>The account has accepted Client's certificate of insurance, W-9, and license.</li>
      <li>A named dispatch or operations contact at the account is confirmed.</li>
      <li>The account's work order route is known: how work is sent, where invoices go, and who approves them.</li>
    </ol>
    <p>Registration on a platform or a portal login by itself does not count as Onboarded.</p>
    <p><strong>In active onboarding.</strong> An account counts as in active onboarding when its packet has been submitted to a named decision maker who has confirmed receipt or next steps in writing, or a portal invite, vendor review, or site walk is in motion through the account's own process.</p>
    <p><strong>Completion payment trigger.</strong> The completion payment is due on Onboarded status only. It is not tied to, and does not wait for, the first work order, the first job, the first payment Client receives from an account, or revenue in any amount. The Parties acknowledge that an Onboarded account may not send its first work for some time, and that timing is the account's, not Provider's.</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">4. 30 Day Trajectory Guarantee</h2>
    <p>Day 1 is the first business day after both: (a) the start payment has cleared, and (b) Client has provided the documents Provider needs to onboard Client (certificate of insurance, W-9, license, and rate sheet). If Client delays providing documents or signing an account's paperwork, the 30 day period extends by the same number of days of delay.</p>
    <p>By Day 30, Provider will have Client on a visibly positive trajectory, meaning either:</p>
    <ul style="margin-top: 8px; margin-bottom: 8px; padding-left: 24px;">
      <li>(a) at least 1 account Onboarded and at least 1 more account in active onboarding, or</li>
      <li>(b) at least 2 accounts Onboarded.</li>
    </ul>
    <p>If neither is true by Day 30, Client may elect a full refund of the $2,000 start payment, payable within 5 business days of Client's written election, and this Agreement ends with no completion payment due.</p>
    <p>If the test above is met, the guarantee is satisfied, and no refund is due after Day 30 based on when an Onboarded account sends its first work.</p>
    <p>Provider will send Client a written update each Friday during the campaign listing decision makers reached, packets submitted, and accounts Onboarded, using the definitions in Section 3.</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">5. Client Responsibilities</h2>
    <p>Client will: provide the documents in Section 4 promptly; respond to an account's signature or information requests within 2 business days; make a local representative available for any site walk an account requires in the service area; and perform any work an account sends to Client under Client's own terms with that account. Provider is not a party to work between Client and an account.</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">6. Accounts Are Client's</h2>
    <p>Accounts landed under this Agreement are Client's accounts to keep, whether or not Client works with Provider again. Provider will not resell the same account placement to a competing company in Client's service area during this campaign.</p>

    <h2 style="font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px;">7. General</h2>
    <p>This is the entire agreement between the Parties for this campaign and replaces any earlier discussion of these terms. Changes must be in writing and signed by both Parties. Florida law governs this Agreement. Electronic signatures and copies of this Agreement are binding and valid as originals.</p>

    <p style="margin-top: 28px; margin-bottom: 16px;">____________________________________________________________</p>
    <p style="margin-bottom: 4px;">Provider: Intent Revenue</p>
    <p style="margin-top: 0; margin-bottom: 4px;">Signature: ______________________________ &nbsp;Date: __________</p>
    <p style="margin-top: 0; margin-bottom: 20px;">Josh Celestin</p>

    <p style="margin-bottom: 4px;">Client: ${clientCompanyName}</p>
    <p style="margin-top: 0; margin-bottom: 4px;">Signature: ______________________________ &nbsp;Date: __________</p>
    <p style="margin-top: 0; margin-bottom: 4px;">Name / Title: ___________________________</p>
    ${contactLine}
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
