import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/seo";

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
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
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
        latitude: 28.5383,
        longitude: -81.3792,
      },
      geoRadius: "200 mi",
    },
    knowsAbout: [
      "Contractor lead generation",
      "Lead generation for contractors",
      "Contractor marketing",
      "Revenue engineering",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
