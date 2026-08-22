import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/sections/legal-shell";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${BRAND_NAME}. How we collect, use, and share information from our website and inquiry forms.`,
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 21, 2026">
      <LegalSection title="1. Scope">
        <p>
          This Privacy Policy explains how {BRAND_NAME} (&quot;Intent,&quot;
          &quot;we,&quot; &quot;us&quot;) collects, uses, and shares
          information when you visit {SITE_URL.replace("https://", "")}, submit
          an inquiry, or otherwise contact us. It covers this marketing site
          and related admin tools we operate. Paid client work may also be
          covered by a separate agreement.
        </p>
        <p>
          Our{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms of Service
          </Link>{" "}
          describe use of the site.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>We collect information you provide, including:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Name, email address, and phone number</li>
          <li>Trade, company details, and message text</li>
          <li>
            Qualification details such as monthly jobs, revenue range, review
            count, years in business, and marketing budget
          </li>
          <li>Whether you are asking about partnership or Launchpad</li>
        </ul>
        <p className="pt-2">
          We also collect technical data automatically, such as IP address,
          browser type, device, referring URL, pages viewed, and approximate
          location. If you click a phone link, we may log that event for
          analytics.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use this information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Respond to inquiries and assess partnership fit</li>
          <li>Operate, secure, and improve the website</li>
          <li>Measure traffic and which pages or calls matter</li>
          <li>Send follow-up about services you asked about</li>
          <li>Comply with law and enforce our Terms</li>
        </ul>
        <p className="pt-2">
          We do not sell your personal information. We do not rent inquiry
          lists to unrelated advertisers.
        </p>
      </LegalSection>

      <LegalSection title="4. Analytics and cookies">
        <p>
          We use cookies and similar tools, including Google Analytics, to
          understand site use. Google may process data as described in
          Google&apos;s own privacy policy. You can control cookies in your
          browser. Blocking cookies may limit some site features.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing">
        <p>We share information only as needed to run the business:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Hosting and infrastructure (for example, Vercel or similar
            providers)
          </li>
          <li>Email delivery if we notify our team of a new inquiry</li>
          <li>
            Stripe, if you start Launchpad or partnership through this site.
            Stripe processes the card. We receive confirmation, amount, and
            contact details you entered, not your full card number
          </li>
          <li>Analytics providers such as Google</li>
          <li>
            Professional advisors, or authorities, when required by law or to
            protect rights and safety
          </li>
        </ul>
        <p className="pt-2">
          If we later assign or reorganize the business, information may
          transfer with it, still subject to this policy or a successor policy.
        </p>
      </LegalSection>

      <LegalSection title="6. Text messages and calls">
        <p>
          If you give us a phone number, we may call or text you about your
          inquiry. Message and data rates may apply. Reply STOP to opt out of
          texts from us, and HELP for help. We do not use your inquiry number
          to run unrelated marketing lists. Client-facing missed-call or review
          texts we build for a company are sent for that company under their own
          practices and carrier rules.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          We keep inquiry records as long as needed to evaluate fit, follow up,
          improve our process, and meet legal or accounting needs. We keep
          analytics in identifiable or aggregated form according to our
          provider settings. You may ask us to delete inquiry data as described
          below, unless we must keep it.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use reasonable administrative and technical measures to protect
          information. No website or transmission is fully secure. Do not send
          passwords or payment card numbers through the public inquiry form.
        </p>
      </LegalSection>

      <LegalSection title="9. Your choices">
        <p>
          You may request access to, correction of, or deletion of personal
          information we hold about you, or ask us to stop marketing follow-up,
          by using the{" "}
          <Link href="/#get-in-touch" className="text-accent hover:underline">
            Get a Quote
          </Link>{" "}
          form and stating that it is a privacy request. We may need to verify
          it is you. Florida and other U.S. state laws may give additional
          rights. We will not discriminate against you for exercising those
          rights.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          This site is for business owners and operators. It is not directed at
          children under 13. We do not knowingly collect personal information
          from children.
        </p>
      </LegalSection>

      <LegalSection title="11. Do Not Track and global privacy control">
        <p>
          The site does not currently respond to Do Not Track signals. You can
          still limit cookies in your browser.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update this policy by posting a new version here. The
          &quot;Last updated&quot; date will change. Continued use of the site
          after an update means you accept the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Privacy questions: use the{" "}
          <Link href="/#get-in-touch" className="text-accent hover:underline">
            Get a Quote
          </Link>{" "}
          form on this website and mark the message as a privacy request.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
