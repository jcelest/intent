import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/sections/legal-shell";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${BRAND_NAME}. How you may use our website, inquiry form, and contractor growth services.`,
  alternates: { canonical: `${SITE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 22, 2026">
      <LegalSection title="1. Agreement">
        <p>
          These Terms of Service (the &quot;Terms&quot;) govern your use of{" "}
          {SITE_URL.replace("https://", "")}, related pages, and any inquiry,
          qualification, or partnership process offered by {BRAND_NAME}{" "}
          (&quot;Intent,&quot; &quot;we,&quot; &quot;us&quot;). By using the
          site or submitting a form, you agree to these Terms and to our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          If you are using the site for a company, you represent that you have
          authority to bind that company.
        </p>
      </LegalSection>

      <LegalSection title="2. Who we are">
        <p>
          {BRAND_NAME} helps trade businesses grow revenue. That can include
          strategy, custom software, organic search, paid ads, content, and
          related services for HVAC, plumbing, roofing, and other home-service
          companies. We serve Florida and other U.S. markets. Submitting an
          inquiry does not create a partnership until both sides agree in
          writing.
        </p>
      </LegalSection>

      <LegalSection title="3. The website">
        <p>
          You may use this site for lawful purposes only. You may not scrape,
          overload, reverse engineer, or interfere with the site, or use it to
          send spam or malware. We may change, suspend, or discontinue any part
          of the site at any time.
        </p>
        <p>
          Content on the site is for information. It is not a bid, a guarantee
          of leads, a guarantee of revenue, or legal, tax, or accounting advice.
        </p>
      </LegalSection>

      <LegalSection title="4. Inquiries, qualification, and Launchpad">
        <p>
          Forms on this site collect information so we can assess fit. We
          qualify partners on factors such as job volume, reviews, territory,
          growth investment, and owner engagement. We may decline an inquiry
          for any reason.
        </p>
        <p>
          Intent Launchpad and similar intro offers, if described on the site,
          are optional paths. Scope, price, and deliverables are set in a
          separate written agreement. Nothing on a marketing page overrides that
          agreement.
        </p>
      </LegalSection>

      <LegalSection title="5. Intent LeadNet">
        <p>
          Intent LeadNet is a productized sprint sold on this site. The amount
          due today is the sprint and any add-ons you select ($1,397 base,
          optional custom styling, optional no watermark). After 30 days,
          LeadNet is $197 per month for the tracking number, voice on that
          number, speed-to-lead auto-replies, customer database reactivation, owner alerts, and Google review SMS under
          ordinary trade volume. The monthly is billed separately. It is not
          charged on the sprint card at checkout.
        </p>
        <p>
          You choose one phone setup at kickoff: keep the public number and
          forward it into LeadNet (your Phone app rings a private second line
          you pay your carrier for, typically about $8/month), or keep the
          phone as it is and put the LeadNet tracking number on Google and ads.
          Intent does not sell cell plans. A second line is never billed by
          Intent.
        </p>
        <p>
          Software we build stays with {BRAND_NAME} unless a signed contract
          says otherwise. You may use LeadNet while you are an active client
          (current on the monthly, or in the included 30 days). Scope, refunds,
          and cancel are in the LeadNet agreement you sign after payment.
        </p>
      </LegalSection>

      <LegalSection title="6. Services and results">
        <p>
          Paid work starts only after a written agreement (proposal, statement
          of work, or contract). We do not guarantee a specific number of
          leads, jobs, rankings, ad results, or revenue. Search, ads, carriers,
          and platforms are outside our full control. SMS, call tracking, and
          similar tools may also require carrier or platform approval before
          they can go live.
        </p>
        <p>
          You are responsible for your business licenses, insurance, job
          quality, customer communications, and compliance with telemarketing,
          SMS, advertising, and consumer laws in the places you operate.
        </p>
      </LegalSection>

      <LegalSection title="7. Your materials">
        <p>
          If you send us logos, photos, reviews, account access, or other
          materials, you grant {BRAND_NAME} a license to use them to evaluate
          and perform services. You confirm you have the right to provide that
          material. You remain responsible for the accuracy of information you
          give us.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property and software we build">
        <p>
          The site, branding, copy, software, systems, and designs we publish
          are owned by {BRAND_NAME} or our licensors.
        </p>
        <p>
          Unless a written contract signed by {BRAND_NAME} expressly assigns
          ownership, grants an exclusive license, or states otherwise in clear
          language, {BRAND_NAME} owns all right, title, and interest in and to
          all software, applications, code, automations, templates, dashboards,
          documentation, processes, and related work product we create or
          customize, including work created for a client engagement. That
          includes source code, repositories, infrastructure, clones,
          white-label instances, and improvements we make over time.
        </p>
        <p>
          If your contract is silent on ownership, you do not own that
          software. You receive only a limited, non-exclusive,
          non-transferable right to use it in your own trade business while
          you are an active client, and only as needed to receive the
          services. You may not copy, resell, sublicense, reverse engineer,
          claim authorship of, or reuse that software for another company
          without our written consent.
        </p>
        <p>
          Your pre-existing materials remain yours: your name, logo, job data,
          customer lists, and content you supply. We may use them to perform
          the work. Paying an invoice, starting Launchpad, or using a system
          we built does not transfer ownership of our software to you.
        </p>
      </LegalSection>

      <LegalSection title="9. Starting work and payments">
        <p>
          If you start LeadNet, Launchpad, or partnership through this site,
          that confirmation is payment for the engagement described on that
          page, not a purchase of software ownership. LeadNet checkout is the
          sprint and selected add-ons. The $197 monthly described on /leadnet
          and in the LeadNet agreement is billed separately after the included
          30 days. Refunds apply only if a signed contract says so. Card
          processing is handled by Stripe. Stripe&apos;s terms apply to the
          payment itself.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-party tools">
        <p>
          The site and our services may use hosting, analytics, email, ads,
          telephony, and similar providers. Those providers have their own
          terms. We are not responsible for outages or policy changes on those
          platforms.
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers">
        <p>
          THE SITE AND ANY INFORMATION ON IT ARE PROVIDED &quot;AS IS.&quot; TO
          THE FULLEST EXTENT ALLOWED BY LAW, {BRAND_NAME.toUpperCase()}{" "}
          DISCLAIMS WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the site will
          be uninterrupted or error-free.
        </p>
      </LegalSection>

      <LegalSection title="12. Limitation of liability">
        <p>
          TO THE FULLEST EXTENT ALLOWED BY LAW, {BRAND_NAME.toUpperCase()} WILL
          NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          LOST-PROFIT DAMAGES, OR FOR LOSS OF DATA, ARISING FROM THE SITE OR
          THESE TERMS. OUR TOTAL LIABILITY FOR CLAIMS ARISING FROM THE SITE IS
          LIMITED TO ONE HUNDRED U.S. DOLLARS ($100). Some states do not allow
          certain limits, so part of this section may not apply to you.
        </p>
        <p>
          Liability for paid services is governed by the written client
          agreement, not this website-only cap, except where that agreement
          says otherwise.
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnity">
        <p>
          You will defend and indemnify {BRAND_NAME} against claims arising from
          your misuse of the site, your content, or your violation of these
          Terms or the law.
        </p>
      </LegalSection>

      <LegalSection title="14. Governing law">
        <p>
          These Terms are governed by the laws of the State of Florida, without
          regard to conflict-of-law rules. You agree to exclusive venue in
          state or federal courts located in Florida, unless a written client
          agreement sets a different venue for paid work.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes">
        <p>
          We may update these Terms by posting a new version on this page. The
          &quot;Last updated&quot; date will change. Continued use of the site
          after an update means you accept the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact">
        <p>
          Questions about these Terms: use the{" "}
          <Link href="/#get-in-touch" className="text-accent hover:underline">
            Get a Quote
          </Link>{" "}
          form on this website.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
