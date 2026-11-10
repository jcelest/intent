export const TRADE_DEMAND_SOURCE_SHORTCUTS = [
  {
    label: "City of Orlando Permit Applications",
    url: "https://data.cityoforlando.net/Permitting/Permit-Applications/ryhf-m453",
    kind: "Live Socrata connector",
  },
  {
    label: "Apopka OpenGov Procurement",
    url: "https://procurement.opengov.com/portal/apopka?departmentId=all&status=all",
    kind: "Manual public portal",
  },
  {
    label: "Apopka Agendas & Minutes",
    url: "https://apopka.gov/129/Agendas-Minutes",
    kind: "Manual public source",
  },
  {
    label: "Orange County Fast Track",
    url: "https://fasttrack.ocfl.net/OnlineServices/PermitsAllTypes.aspx",
    kind: "Manual public portal",
  },
  {
    label: "HGR Construction Bid Opportunities",
    url: "https://www.hgrconstruction.com/bids",
    kind: "Manual public source",
  },
  {
    label: "Kiewit Central Florida Projects",
    url: "https://www.kiewit.com/business-with-us/opportunities/central-florida-projects/",
    kind: "Manual public source",
  },
  {
    label: "Highland Homes Vendor Application",
    url: "https://www.highlandhomes.org/vendors",
    kind: "Manual vendor intake",
  },
] as const;
