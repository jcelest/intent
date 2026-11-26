# Commercial Opportunity Vendor Access Playbook

**Primary operating area:** Orange and Osceola counties

**Future-client expansion:** South Florida and statewide Florida
**Last source review:** November 25, 2026

## Purpose

This playbook explains which procurement accounts are useful for building and using a consolidated commercial-opportunity feed. It is intended for Intent B2B staff and future clients.

The consolidated feed should collect authoritative public records without requiring a vendor account whenever possible. Vendor registration is primarily needed to:

- download restricted solicitation documents or attachments;
- receive automatic opportunity and addendum notifications;
- ask questions through an agency portal;
- submit an electronic response;
- complete award, purchase-order, invoicing, or payment onboarding.

Registration does not create an opportunity and does not guarantee an award. Confirmed solicitations must remain separate from permits, facilities intelligence, expiring contracts, and other inferred demand signals.

## Immediate Priority: Orange and Osceola Counties

### How portal notifications enter Intent

OpenGov and DemandStar notices must be delivered to the dedicated Intent procurement inbox shown in the Resend **Receiving** dashboard. The production flow is:

1. OpenGov or DemandStar sends the notice to the dedicated inbound address.
2. Resend sends a signature-verified `email.received` event to `https://intentrev.net/api/webhooks/resend/procurement`.
3. Intent retrieves the full message and attachments from Resend, verifies the configured recipient and sender allowlists, confirms that the notice links to an official OpenGov or DemandStar portal, and rejects notices without Florida evidence.
4. Intent deduplicates and writes accepted records to the canonical opportunity and procurement tables. Email bodies and attachments are versioned for the Opportunity Assistant.
5. The opportunity appears in Opportunity Explorer and in the Atlas. County-level notices without documented coordinates appear in the appropriate county aggregate rather than at a fabricated point.
6. Only after the database write succeeds, Intent sends the curated opportunity alert to the configured notification recipients.

The vendor portal email is therefore an input to Intent, not a separate opportunity datastore. Do not configure portal passwords in Intent. Vendor users continue to sign in themselves for questions, restricted files, and submissions.

For reliable delivery, add the exact inbound address directly to each portal when the portal permits a notification address. If a portal requires the account login address, forward a copy from the company-controlled mailbox and add that forwarding address to `PROCUREMENT_INBOUND_ALLOWED_SENDERS`. Keep `PROCUREMENT_INBOUND_RECIPIENTS` restricted to the exact Intent inbox alias.

The hourly recovery job reconciles recent Resend messages, retries temporary failures with backoff, retries curated alerts idempotently, and exposes delayed or failed processing through the existing source-health alerts.

### Minimum account set

The following accounts provide the broadest practical access for the current client.

| Priority | Account or portal | Buyers covered | Why it matters | Cost / timing |
| --- | --- | --- | --- | --- |
| 1 | [OpenGov Procurement signup](https://procurement.opengov.com/signup) | Orange County Government, City of Orlando, Greater Orlando Aviation Authority/MCO, City of St. Cloud, Apopka, and other participating agencies | Solicitations, documents, addenda, questions, notifications, and electronic submissions | Free; high priority |
| 2 | [OCPS VendorLink](https://vendorlink.ocps.net/external/register) | Orange County Public Schools | Solicitation notices, documents, award notices, and commodity-code alerts | Free; high priority for school facilities work |
| 3 | [Osceola VendorLink](https://vendorlink.osceola.org/) | Osceola County Government and the School District of Osceola County | One portal provides solicitations, addenda, planholders, tabulations, awards, and executed agreements for both agencies | Free; high priority |
| 4 | [MyVendorLink](https://www.myvendorlink.com/) | Kissimmee Utility Authority and selected regional agencies | KUA service and commodity solicitations; some City of Kissimmee notices are also available | Free access is available; register when needed |
| 5 | [DemandStar](https://www.demandstar.com/app/registration) | City of Kissimmee and other participating agencies | Bid announcements, documents, and notifications | A free account/agency selection is available; broader subscriptions may be paid |
| 6 | [Toho Water Bonfire](https://tohowater.bonfirehub.com/) | Toho Water Authority | Official solicitation questions and electronic responses; important for water, controls, electrical, mechanical, construction, and maintenance work | Free vendor registration; create when pursuing Toho work |
| 7 | [UCF supplier and solicitation resources](https://procurement.ucf.edu/doing-business-with-ucf/) | University of Central Florida | Supplier onboarding, formal solicitations, facilities opportunities, contracts, and renewal intelligence | Supplier onboarding is free; create when UCF becomes an active target |
| 8 | [Valencia College solicitation portal](https://valenciacollege.edu/employees/procurement/solicitations.php) | Valencia College campuses in Orange and Osceola counties | Competitive solicitations and notifications through VendorLink | Free; create when higher-education work is in scope |

### One OpenGov account, multiple buyers

Create one company-controlled OpenGov supplier profile, then subscribe to and follow at least these agencies:

1. [Orange County Government](https://procurement.opengov.com/portal/orangecountyfl)
2. [City of Orlando](https://procurement.opengov.com/portal/orlando)
3. [Greater Orlando Aviation Authority](https://procurement.opengov.com/portal/goaa)
4. [City of St. Cloud](https://procurement.opengov.com/portal/stcloud)
5. [City of Apopka](https://procurement.opengov.com/portal/apopka)

Orange County transitioned its procurement activity from the legacy Mercell/e-bids path to OpenGov. The City of Orlando uses OpenGov for procurement notices and responses. GOAA uses it for goods, services, construction, concessions, and vendor management at Orlando International Airport and Orlando Executive Airport. St. Cloud uses it for opportunity notifications, addenda, questions, and electronic submissions.

Sources: [Orange County OpenGov transition notice](https://newsroom.ocfl.net/2021/12/going-digital-procurement-office-introduces-new-eprocurement-software/), [City of Orlando registration guidance](https://www.orlando.gov/Our-Government/Do-Business-with-the-City/Register-to-Receive-Procurement-Notifications), [GOAA procurement](https://web.goaa.aero/airport-business/business-opportunities/procurement/), and [City of St. Cloud vendor guidance](https://www.stcloudfl.gov/2301/Doing-Business-with-the-City).

### VendorLink is a platform family, not always one shared registration

VendorLink is used by several Central Florida buyers, but agency-hosted sites can require separate registrations or agency selections. Register with a shared company email and select every relevant commodity/service category.

- [OCPS VendorLink](https://vendorlink.ocps.net/) covers Orange County Public Schools.
- [Osceola VendorLink](https://vendorlink.osceola.org/) covers both Osceola County and the School District of Osceola County.
- [OUC supplier registration](https://www.ouc.com/doing-business-with-ouc/) uses VendorLink for Orlando Utilities Commission opportunities.
- [KUA procurement](https://kua.com/about-kua/corporate-information/procurement/how-to-do-business-with-kua/) uses MyVendorLink for service and commodity solicitations. Utility-industry materials may also appear through Aursi.
- [Valencia College procurement](https://valenciacollege.edu/employees/procurement/suppliers.php) uses a VendorLink-hosted public solicitation portal.

### UCF access has multiple layers

UCF should be monitored through all of the following:

- [UCF Procurement solicitations](https://procurement.ucf.edu/solicitations/) for goods and services;
- [UCF Planning, Design and Construction advertisements](https://fp.ucf.edu/vendors/current-advertisements/) for construction and facilities work;
- [UCF contracts](https://procurement.ucf.edu/contracts/) for current contracts, renewal dates, and expiration intelligence;
- the UCF Supplier Management Portal, linked from [Doing Business with UCF](https://procurement.ucf.edu/doing-business-with-ucf/), for supplier onboarding;
- UCF Bonfire when a specific facilities solicitation requires electronic submission.

UCF began using Workday Strategic Sourcing for new-supplier onboarding in March 2026. Formal public listings can be collected before supplier registration, so onboarding may be deferred until UCF is an active pursuit target.

### State and federal opportunities physically located in the two counties

County-focused coverage must also include opportunities issued by non-local buyers:

- Florida agencies and FDOT through [MFMP/VBS](https://www.dms.myflorida.com/business_operations/state_purchasing/myfloridamarketplace/mfmp_vendors/requirements_for_vendor_registration);
- federal agencies through [SAM.gov Contract Opportunities](https://sam.gov/content/opportunities);
- federal award and incumbent intelligence through USAspending;
- state university and institutional opportunities, including UCF;
- prime-contractor and subcontractor notices tied to public projects in Orange or Osceola County.

The feed can collect public MFMP/VBS and SAM.gov records without completing vendor registration. MFMP vendor registration and an active SAM.gov entity registration are needed when the client intends to submit for those awards.

## What Can Be Deferred for the Current Client

The following registrations do not need to be completed merely to maintain the Orange/Osceola public feed:

- Miami-Dade INFORMS;
- Broward County BPRO;
- Palm Beach County VSS;
- Broward Health VRS;
- South Florida Water Management District vendor registration;
- JEA Zycus;
- paid DemandStar or BidNet notification plans;
- SAM.gov entity registration, unless the client intends to bid directly on federal work;
- agency diversity certification unless a target solicitation or client strategy requires it.

## Future South Florida Client Setup

### Highest-priority agency registrations

1. [Florida MFMP Vendor Information Portal](https://www.dms.myflorida.com/business_operations/state_purchasing/myfloridamarketplace/mfmp_vendors/requirements_for_vendor_registration)
   - Statewide Florida agencies and many FDOT commodity/service opportunities.
   - Create the MFMP VIP account and connect the applicable SAP Business Network access.

2. [Miami-Dade INFORMS](https://supplier.miamidade.gov/)
   - Free access to sourcing events, documents, addenda, notifications, and responses.
   - Part 1 provides bidder access; complete Part 2 and required affidavits before award.

3. [Broward County BPRO](https://broward.bonfirehub.com/)
   - Bonfire-based portal for Broward County solicitations and results.
   - Registration is required to view, download, and respond to solicitations.

4. [Palm Beach County Vendor Self Service](https://discover.pbcgov.org/procurement/Pages/Vendor-Registration.aspx)
   - County solicitations, notifications, vendor status, purchase information, and payments.

5. [Broward Health Vendor Registration System](https://www.browardhealth.org/vendor/vendor-registration-and-orientation)
   - Required for participation in Broward Health competitive opportunities.
   - Complete all company-profile tabs and upload a current signed W-9.

6. [South Florida Water Management District procurement](https://sfwmd.gov/doing-business-with-us/procurement)
   - Uses Business/Vendor Registration Application Form 0661 rather than a conventional online account.
   - Requires the correct legal name, FEIN, good-standing status, and at least one five-digit commodity code.

### Broad portal registrations

- [OpenGov Procurement](https://opengov.com/products/procurement/for-vendors/) provides one free supplier profile across participating governments.
- [DemandStar](https://www.demandstar.com/app/registration) offers free access for a selected agency; broader automatic notification packages may cost money.
- [BidNet Direct Florida Purchasing Group](https://www.bidnetdirect.com/florida) offers limited/free and paid options depending on agency and notification scope.
- Bonfire supplier profiles are used by agencies such as Broward County, Toho Water, and specific institutional buyers.

## Other Statewide or Specialized Accounts

- [JEA Zycus](https://www.jea.com/about/procurement/zycus_portal/): register as a Potential Supplier for JEA sourcing events and electronic submissions.
- [SAM.gov entity registration](https://sam.gov/entity-registration): required for a company bidding directly on federal awards; registration and a Unique Entity ID are free.
- FDOT Bid Express: needed only for applicable electronic construction bid submissions. General FDOT commodity/service coverage is primarily associated with state procurement systems.

## Standard Vendor Registration Package

Prepare this package once and reuse it for each client:

- exact legal name matching Sunbiz and IRS records;
- EIN/TIN and current signed W-9;
- physical, mailing, payment, and remittance addresses;
- shared procurement email and phone number;
- capability statement;
- Florida licenses and professional certifications;
- certificate of insurance;
- service territories;
- ownership and diversity certifications, when applicable;
- references and representative completed projects;
- ACH/banking information only when an official award or payment-onboarding process requires it.

Select all accurate commodity/service categories relating to the client's capabilities, including:

- HVAC and mechanical systems;
- building automation and controls;
- energy management and optimization;
- refrigeration;
- remote monitoring, telemetry, and SCADA;
- electrical and low-voltage systems;
- plumbing and water/wastewater systems;
- construction, renovation, and continuing services;
- recurring facilities, preventive, and corrective maintenance;
- fire/life safety, roofing, elevators, security, janitorial, landscaping, and other supported trades.

Do not select services the client cannot legally or operationally perform.

## Account Security and Automation Rules

- Use a company-controlled shared address such as `bids@company.com`, not an employee's personal email.
- Store credentials in an approved password manager and enable multifactor authentication when available.
- Do not send portal passwords through chat, email, source code, or GitHub issues.
- Use a dedicated read-only or integration user when a portal supports one.
- Place approved API keys and automation secrets in the production secret store, never in the repository.
- A vendor login does not automatically authorize automated scraping. Use authenticated automation only when supported by the portal's terms, documented API, feed, or written permission.
- Where automation is not permitted, collect the public listing and provide a direct portal link for the authorized user to retrieve restricted documents or submit a response.

## Coverage Standard for the Consolidated Feed

For Orange and Osceola counties, the feed should combine:

1. confirmed open solicitations;
2. amendments, cancellations, awards, and deadline changes;
3. current contracts and documented renewal/expiration dates;
4. public facilities and capital plans;
5. permits, property, equipment, and relationship signals clearly labeled as inferred;
6. public prime-contractor and subcontractor invitations;
7. publicly documented private-sector purchasing requirements;
8. original documents and source citations whenever legally accessible.

No public system provides every private commercial purchasing need. Disney, Universal, healthcare systems, property managers, general contractors, and other private buyers may rely on invitation-only sourcing or supplier networks. Those relationships require targeted supplier registration and outreach and must not be represented as confirmed demand unless a real notice or purchasing document exists.

## Client Onboarding Sequence

For a new client, use this order:

1. Confirm legal entity, licenses, services, service territory, and capacity.
2. Activate public-feed coverage immediately; do not wait for vendor registration.
3. Create only the high-value portal accounts required for the client's territory and trades.
4. Select accurate commodity codes and subscribe to the relevant agencies.
5. Verify document access and notification delivery.
6. Register with a buyer-specific system only when an opportunity, relationship, or likely purchasing channel justifies it.
7. Review registrations quarterly and update licenses, insurance, contacts, and commodity codes.

This approach keeps startup cost and administrative work low while preserving a comprehensive, source-grounded opportunity feed.
