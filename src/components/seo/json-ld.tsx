import {
  SITE_URL,
  BRAND_NAME,
  DEFAULT_DESCRIPTION,
  BUSINESS_PHONE_E164,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_ADDRESS,
  BUSINESS_GEO,
} from "@/lib/seo";

const organizationAddress = {
  "@type": "PostalAddress",
  streetAddress: BUSINESS_ADDRESS.streetAddress,
  addressLocality: BUSINESS_ADDRESS.addressLocality,
  addressRegion: BUSINESS_ADDRESS.addressRegion,
  postalCode: BUSINESS_ADDRESS.postalCode,
  addressCountry: BUSINESS_ADDRESS.addressCountry,
};

const organizationContactPoint = {
  "@type": "ContactPoint",
  telephone: BUSINESS_PHONE_E164,
  contactType: "customer service",
  areaServed: "US",
  availableLanguage: "English",
};

export function LocalBusinessJsonLd({
  name,
  description,
  url,
  areaServed,
  geo,
}: {
  name: string;
  description: string;
  url: string;
  areaServed: string | string[];
  geo?: { latitude: number; longitude: number };
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description,
    url,
    telephone: BUSINESS_PHONE_E164,
    address: organizationAddress,
    areaServed: Array.isArray(areaServed)
      ? areaServed.map((a) => ({ "@type": "Place", name: a }))
      : { "@type": "Place", name: areaServed },
    ...(geo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    telephone: BUSINESS_PHONE_E164,
    address: organizationAddress,
    contactPoint: organizationContactPoint,
    areaServed: [
      {
        "@type": "State",
        name: "Florida",
        containedInPlace: { "@type": "Country", name: "United States" },
      },
      {
        "@type": "AdministrativeArea",
        name: "Central Florida",
        containedInPlace: { "@type": "State", name: "Florida" },
      },
    ],
    serviceArea: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: BUSINESS_GEO.latitude,
        longitude: BUSINESS_GEO.longitude,
      },
      geoRadius: "200 mi",
    },
    knowsAbout: [
      "Intent Revenue",
      "Contractor lead generation",
      "Lead generation for contractors",
      "Contractor marketing",
      "Revenue growth for contractors",
      "Intent LeadNet",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
      telephone: BUSINESS_PHONE_E164,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function ContactPageJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${BRAND_NAME}`,
    url: `${SITE_URL}/contact`,
    description: `Contact ${BRAND_NAME} at ${BUSINESS_PHONE_DISPLAY} for contractor lead generation and revenue systems.`,
    mainEntity: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
      telephone: BUSINESS_PHONE_E164,
      address: organizationAddress,
      contactPoint: organizationContactPoint,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
