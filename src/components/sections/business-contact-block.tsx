import Link from "next/link";
import {
  BRAND_NAME,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_TEL,
  BUSINESS_PHONE_HYPHEN,
  BUSINESS_PHONE_PLAIN,
  BUSINESS_ADDRESS,
} from "@/lib/seo";

export function BusinessContactBlock() {
  return (
    <div
      className="rounded-xl border border-border bg-card/50 px-6 py-5 text-center sm:text-left"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <meta itemProp="name" content={BRAND_NAME} />
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Call or text</p>
      <p className="mt-2">
        <a
          href={BUSINESS_PHONE_TEL}
          className="text-2xl sm:text-3xl font-display font-semibold text-accent hover:underline"
          itemProp="telephone"
        >
          {BUSINESS_PHONE_DISPLAY}
        </a>
      </p>
      <p className="mt-2 text-sm text-muted">
        Also listed as{" "}
        <a href={BUSINESS_PHONE_TEL} className="text-foreground/80 hover:text-accent">
          {BUSINESS_PHONE_HYPHEN}
        </a>{" "}
        and{" "}
        <span className="text-foreground/80">{BUSINESS_PHONE_PLAIN}</span>
      </p>
      <address
        className="mt-4 not-italic text-sm text-muted"
        itemProp="address"
        itemScope
        itemType="https://schema.org/PostalAddress"
      >
        <span itemProp="streetAddress">{BUSINESS_ADDRESS.streetAddress}</span>
        <br />
        <span itemProp="addressLocality">{BUSINESS_ADDRESS.addressLocality}</span>,{" "}
        <span itemProp="addressRegion">{BUSINESS_ADDRESS.addressRegion}</span>{" "}
        <span itemProp="postalCode">{BUSINESS_ADDRESS.postalCode}</span>
      </address>
      <p className="mt-3 text-sm text-muted">
        Prefer email?{" "}
        <Link href="#contact" className="text-accent hover:underline">
          Use the form below
        </Link>
        .
      </p>
    </div>
  );
}
