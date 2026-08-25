import os
import csv
import xlsxwriter

os.makedirs("sales", exist_ok=True)

csv_path = os.path.join("sales", "LeadNet_Hitlist_Pipeline.csv")
xlsx_paths = [
    os.path.join("sales", "LeadNet_Verified_DBPR_Hitlist.xlsx"),
    os.path.join("sales", "LeadNet_Sponsored_Hitlist.xlsx"),
    os.path.join("sales", "LeadNet_Hitlist_Pipeline.xlsx"),
]

headers = [
    "Status",
    "Priority Tier",
    "Company Name",
    "Trade",
    "City / Metro",
    "Verified Licensee / Owner (DBPR & Sunbiz)",
    "State License # (CAC / CFC)",
    "Direct / Cell Phone",
    "Office / LSA Phone",
    "Email",
    "Website",
    "Running Google Ads?",
    "Google Rating / Reviews",
    "Speed to Lead Hook / Paid Ad Pain Point",
    "Dial 1 Outcome",
    "Dial 2 Outcome",
    "Demo Booked Date",
    "Est. System Value",
    "Notes / Next Action",
]

# 20 Sponsored Companies verified via DBPR (myfloridalicense.com) & Sunbiz (sunbiz.org)
companies_data = [
    # Top Tier Candidates (High Probability Sweet Spot)
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Top Tier Cooling",
        "HVAC",
        "Orlando, FL",
        "Jayson Javier Castanon (Qualifier) / Keenan Harris (CEO)",
        "CAC1824593",
        "(407) 449-7333",
        "(407) 236-3582",
        "info@toptier-cooling.com",
        "https://toptier-cooling.com",
        "Yes",
        "4.9 (63 reviews)",
        "Running Google LSA ads. Claims 24/7 emergency service with 63 reviews. Perfect owner-operator candidate for instant missed-call capture.",
        "",
        "",
        "",
        "$7,500",
        "Ask for Jayson or Keenan: 'Hey Jayson, it's regarding your emergency text-back setup in Orlando.'",
    ],
    [
        "Gatekeeper / Callback",
        "A - High (Sweet Spot / Fast Conversion)",
        "One Stop Air Mechanical",
        "HVAC",
        "Orlando, FL",
        "Sergio Rosas (President / Owner)",
        "CAC1821045",
        "(689) 331-0895",
        "(689) 331-0895",
        "service@onestopairmechanical.com",
        "https://www.onestopairmechanical.com",
        "Yes",
        "5.0 (20 reviews)",
        "20 reviews, running active Google Ads. High-growth team needing automated lead capture.",
        "Called 8/22: Gatekeeper took message, said she'd pass to Sergio/boss. 24h passed with no callback.",
        "",
        "",
        "$6,000",
        "FOLLOW UP TODAY: 'Hey, checking back in for Sergio on that emergency text setup before I close the file.'",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Arctic Air Temp",
        "HVAC / Plumbing",
        "Orlando / Kissimmee, FL",
        "Fayfat Dias (Primary Licensee / Owner)",
        "CAC1822832 / CFC1432906",
        "(407) 401-8888",
        "(407) 401-8888",
        "info@arcticairtemp.com",
        "https://arcticairtemp.com",
        "Yes",
        "5.0 (237 reviews)",
        "Google LSA badge shows 'Typically replies in 30 min'. During emergency calls, 30 min is too slow—LeadNet fires in 3 seconds.",
        "",
        "",
        "",
        "$8,500",
        "Ask for Fayfat: 'Hey Fayfat, I saw Google tells customers you reply in 30 mins—we can make that 3 seconds so you never lose an emergency swap.'",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Our Place Air & Home Repair",
        "HVAC",
        "Orlando, FL",
        "Nelson Zayas (Registered Agent / Mgr) / Charles Mixson",
        "CAC1819385",
        "(800) 291-0949",
        "(407) 502-0050",
        "contact@ourplaceair.com",
        "https://callourplace.com",
        "Yes",
        "4.8 (2,274 reviews)",
        "24+ years in business, 24/7 service. LSA badge says 'Typically replies in 30 min'.",
        "",
        "",
        "",
        "$8,500",
        "Ask for Nelson: 'Hey Nelson, saw you running 24/7 ads—want to turn that 30-min reply delay into an instant priority intake.'",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Expert Home Service",
        "HVAC",
        "Orlando / Clermont, FL",
        "Scott W. Armstrong / Chris Armstrong (Managers)",
        "CAC1816599",
        "(352) 429-0750",
        "(813) 632-8889",
        "support@experthomeservice.com",
        "https://cool-airconditioning.com",
        "Yes",
        "4.8 (604 reviews)",
        "Google LSA badge warns customers: 'Typically replies in 1 day' while they pay for top sponsored placement. Massive lead bleed.",
        "",
        "",
        "",
        "$9,000",
        "Ask for Scott / Chris: 'Google LSA says 1-day reply time on your ad. Homeowners hang up and call the next guy. We fix that in 10 mins.'",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "The Right Service",
        "HVAC",
        "Orlando, FL",
        "Roland Rodriguez / Blanca Ramirez (Officers)",
        "CAC1818721",
        "(561) 814-1600",
        "(561) 814-1600",
        "support@therightservicefl.com",
        "https://therightservicefl.com",
        "Yes",
        "4.4 (83 reviews)",
        "4.4 rating + 83 reviews. Needs automated 5-star Google review requests after service + missed-call text back.",
        "",
        "",
        "",
        "$6,500",
        "Ask for Roland: Pitch instant call-recovery + automatic Google Review generation.",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Hurricane Air Duct Cleaning & HVAC",
        "HVAC / Ducting",
        "Orlando, FL",
        "Joshua P. Bertocci (Manager / Owner)",
        "CAC1820119",
        "(941) 282-7797",
        "(941) 282-7797",
        "customercare@hurricaneairductcleaning.com",
        "https://hurricaneairductcleaning.com",
        "Yes",
        "4.9 (572 reviews)",
        "LSA badge shows 'Typically replies in a few hours'. Open until 8 PM. Missing high-ticket weekend replacement leads.",
        "",
        "",
        "",
        "$5,500",
        "Ask for Joshua: Pitch weekend and evening automated text back.",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Air-Tech Mechanical",
        "HVAC",
        "Orlando, FL",
        "Walter Joseph (Authorized Member / Manager)",
        "CAC1819744",
        "(407) 874-7351",
        "(561) 889-0755",
        "service@myairtechmechanical.com",
        "https://myairtechmechanical.com",
        "Yes",
        "4.9 (291 reviews)",
        "5+ years in business, 24/7 emergency service ad. 291 reviews. Strong local operator.",
        "",
        "",
        "",
        "$7,000",
        "Ask for Walter: Pitch 24/7 on-call tech alert + instant customer intake link.",
    ],
    [
        "Follow-up",
        "A - High (Sweet Spot / Fast Conversion)",
        "Ratti Air and Heat",
        "HVAC",
        "Orlando / Brevard, FL",
        "Gino A. Ratti III (President / Primary Qualifier)",
        "CAC1817290",
        "(321) 360-2798",
        "(321) 360-2798",
        "Office@RattiAirandHeat.com",
        "https://www.rattiairandheat.com",
        "Yes",
        "5.0 (772 reviews)",
        "772 reviews, open until 11:59 PM. High volume emergency calls.",
        "Called yesterday. Follow-up pending.",
        "",
        "",
        "$8,000",
        "Ask for Gino: FOLLOW-UP dial. If voicemail, send text hook immediately.",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Swift Brothers Plumbing, Heating & Air",
        "HVAC / Plumbing",
        "Orlando, FL",
        "Eric Swift / Scott Swift (Managers)",
        "CAC1819230",
        "(407) 259-4320",
        "(844) 396-9662",
        "info@swiftbrothers.com",
        "https://swiftbrothers.com",
        "Yes",
        "4.3 (220 reviews)",
        "4.3 rating with active sponsored ads. Need review boost module to climb to 4.8+ and missed-call safety net.",
        "",
        "",
        "",
        "$7,500",
        "Ask for Eric / Scott: Pitch review generation + text back combo.",
    ],
    [
        "Not Contacted",
        "A - High (Sweet Spot / Fast Conversion)",
        "Air Titans",
        "HVAC",
        "Orlando, FL",
        "Joshua P. Bertocci / Brandon Fink (Owners)",
        "CAC1820455",
        "(407) 634-1246",
        "(786) 788-8268",
        "info@airtitans.com",
        "https://airtitans.com",
        "Yes",
        "4.9 (2,852 reviews)",
        "LSA badge: 'Typically replies in a few hours'. Losing paid inbound ad clicks when call queues fill up.",
        "",
        "",
        "",
        "$9,500",
        "Ask for Josh / Brandon: Pitch instant automated SMS overflow queue.",
    ],

    # Scale / Mid-to-Large Contractors
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Mechanical One",
        "HVAC / Gas",
        "Orlando, FL",
        "Carlos Rivero (Founder & CEO)",
        "CAC1821430",
        "(407) 404-4000",
        "(407) 404-4000",
        "info@mechanicalone.com",
        "https://mechanicalone.com",
        "Yes",
        "4.9 (2,566 reviews)",
        "Massive multi-trade volume. Peak hour call abandonment rate is where they bleed $10k+ weekly.",
        "",
        "",
        "",
        "$10,000",
        "Ask for Carlos Rivero / Ops VP: Non-intrusive overflow catch-net for abandoned calls.",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Iceberg Home Services",
        "HVAC / Plumbing",
        "Orlando / Polk County, FL",
        "Michael Ice / Scott Demers (Owners / Officers)",
        "CAC1818168",
        "(863) 345-0493",
        "(863) 223-1397",
        "service@icebergcooling.com",
        "https://icebergcooling.com",
        "Yes",
        "4.7 (2,279 reviews)",
        "Full warranty, 24/7 emergency service. Heavy sponsored ad presence across Central Florida.",
        "",
        "",
        "",
        "$9,000",
        "Ask for Mike Ice / Scott: Catch missed calls during peak dispatch hours.",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Rainaldi Air Conditioning",
        "HVAC",
        "Orlando, FL",
        "James Rainaldi / Frank Rainaldi (Founders / Qualifiers)",
        "CAC1814697",
        "(407) 282-2900",
        "(407) 413-9795",
        "info@rainaldihomeservices.com",
        "https://rainaldihomeservices.com",
        "Yes",
        "4.8 (5,972 reviews)",
        "50+ years brand name. High ad budget, large dispatch team. Missed calls happen when lines are busy.",
        "",
        "",
        "",
        "$12,000",
        "Ask for James Rainaldi / GM: Tech alert dashboard and automated customer callback queuing.",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Frank's Air Conditioning",
        "HVAC",
        "Orlando / St. Cloud, FL",
        "Frank R. Smith (President / Qualifier)",
        "CAC057997",
        "(407) 490-2070",
        "(407) 870-7755",
        "info@franksac.com",
        "https://franksac.com",
        "Yes",
        "4.9 (2,679 reviews)",
        "36+ years in business. Closes 10 PM. Overnight emergency calls often go unrecovered.",
        "",
        "",
        "",
        "$8,500",
        "Ask for Frank Smith: After-hours priority intake to lock down morning first-appointment slots.",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Ace Solves It All",
        "HVAC / Plumbing / Electric",
        "Orlando / Kissimmee, FL",
        "Charles R. DePari Jr. (Primary Qualifier / Founder)",
        "CAC1816543 / CFC057530",
        "(407) 499-8006",
        "(407) 857-0110",
        "info@acesolvesitall.com",
        "https://acesolvesitall.com",
        "Yes",
        "4.7 (5,206 reviews)",
        "30+ years in business. 5,200+ reviews. Top 3 Google LSA advertiser in Central Florida.",
        "",
        "",
        "",
        "$12,000",
        "Ask for Charles DePari / GM: Reduce customer acquisition cost by recapturing 15-20 missed ad calls/week.",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "American Air, Plumbing, and Electrical",
        "HVAC / Multi-Trade",
        "Orlando, FL",
        "Edward Miller / Todd Miller (Founders / Qualifiers)",
        "CAC1813476",
        "(407) 603-4410",
        "(407) 603-4410",
        "contact@americanairandheat.com",
        "https://americanairandheat.com",
        "Yes",
        "4.9 (10,285 reviews)",
        "LSA listing states 'Closes 3 PM'. Leads calling after 3 PM need immediate automated engagement.",
        "",
        "",
        "",
        "$15,000",
        "Ask for Todd Miller / GM: 'Your Google listing says Closes 3 PM—we capture all evening calls automatically.'",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Del-Air Heating, Air Conditioning",
        "HVAC / Plumbing / Electric",
        "Sanford / Orlando, FL",
        "Jay Leslie Wright (Primary Qualifier) / Robert Del-Air",
        "CAC021115 / CFC057524",
        "(844) 909-3003",
        "(888) 831-2665",
        "customercare@delair.com",
        "https://delair.com",
        "Yes",
        "4.6 (6,294 reviews)",
        "Huge enterprise residential player. High call volume results in 10-15% abandoned call rates.",
        "",
        "",
        "",
        "$15,000",
        "Ask for Jay Wright / Call Center VP: Safety net for CSR call overflow.",
    ],
    [
        "Not Contacted",
        "B - Medium (Scale / Multi-Tech)",
        "Frank Gay Services Air Conditioning",
        "HVAC / Multi-Trade",
        "Orlando, FL",
        "Randel Dail Gibbons (Primary Qualifier) / Frank Gay",
        "CAC1818012 / CFC057283",
        "(407) 204-0430",
        "(407) 490-1361",
        "info@frankgayservices.com",
        "https://frankgayservices.com",
        "Yes",
        "4.7 (14,994 reviews)",
        "Market leader with 15k reviews. Spends $20k+/mo on ads. Even 2% missed call rate is $50k+ in lost revenue.",
        "",
        "",
        "",
        "$15,000",
        "Ask for Randel Gibbons / Marketing VP: Catch missed ad revenue without changing their CRM.",
    ],

    # Disqualified / Do Not Call
    [
        "Disqualified",
        "C - Disqualified / Do Not Call",
        "Dittmer Air & Heat",
        "HVAC",
        "Orlando / Brevard, FL",
        "William C. Dittmer (Primary Qualifier / Owner)",
        "CAC1816914",
        "(321) 637-0170",
        "(321) 637-0170",
        "info@dittmerairandheat.com",
        "https://dittmerairandheat.com",
        "Yes",
        "4.6 (11 reviews)",
        "Small local contractor (11 reviews).",
        "Called 8/22: Owner/dispatcher explicitly stated to remove them from list.",
        "",
        "",
        "$0",
        "DO NOT CALL: Requested removal on 8/22.",
    ],
]

# 1. Write CSV
with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(companies_data)

print(f"Wrote {len(companies_data)} rows to CSV: {csv_path}")

# 2. Write formatted Excel (.xlsx)
def create_excel(target_path):
    try:
        workbook = xlsxwriter.Workbook(target_path)
        ws = workbook.add_worksheet("Hitlist Pipeline")

        color_dark = "#090d16"
        color_border = "#334155"

        title_fmt = workbook.add_format({
            "bold": True,
            "font_size": 14,
            "font_color": "#22d3ee",
            "bg_color": color_dark,
            "align": "left",
            "valign": "vcenter",
            "font_name": "Segoe UI",
        })

        metric_card_fmt = workbook.add_format({
            "bold": True,
            "font_size": 10,
            "font_color": "#ffffff",
            "bg_color": "#1e293b",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": color_border,
            "font_name": "Segoe UI",
        })

        metric_num_fmt = workbook.add_format({
            "bold": True,
            "font_size": 13,
            "font_color": "#22d3ee",
            "bg_color": "#0f172a",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": color_border,
            "font_name": "Segoe UI",
        })

        header_fmt = workbook.add_format({
            "bold": True,
            "font_size": 10,
            "font_color": "#000000",
            "bg_color": "#22d3ee",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#0891b2",
            "text_wrap": True,
            "font_name": "Segoe UI",
        })

        data_fmt = workbook.add_format({
            "font_size": 10,
            "font_color": "#1e293b",
            "bg_color": "#ffffff",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#e2e8f0",
            "font_name": "Segoe UI",
        })

        alt_data_fmt = workbook.add_format({
            "font_size": 10,
            "font_color": "#1e293b",
            "bg_color": "#f8fafc",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#e2e8f0",
            "font_name": "Segoe UI",
        })

        status_booked_fmt = workbook.add_format({
            "font_size": 10,
            "bold": True,
            "font_color": "#065f46",
            "bg_color": "#d1fae5",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#a7f3d0",
            "font_name": "Segoe UI",
        })

        status_gatekeeper_fmt = workbook.add_format({
            "font_size": 10,
            "bold": True,
            "font_color": "#92400e",
            "bg_color": "#fef3c7",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#fde68a",
            "font_name": "Segoe UI",
        })

        status_disqualified_fmt = workbook.add_format({
            "font_size": 10,
            "bold": True,
            "font_color": "#991b1b",
            "bg_color": "#fee2e2",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#fca5a5",
            "font_name": "Segoe UI",
        })

        status_followup_fmt = workbook.add_format({
            "font_size": 10,
            "bold": True,
            "font_color": "#1e40af",
            "bg_color": "#dbeafe",
            "align": "center",
            "valign": "vcenter",
            "border": 1,
            "border_color": "#bfdbfe",
            "font_name": "Segoe UI",
        })

        # Summary Dashboard Header in Row 1
        ws.merge_range("A1:S1", "INTENT LEADNET - VERIFIED FLORIDA DBPR & SUNBIZ HITLIST", title_fmt)
        ws.set_row(0, 32)

        # KPI Summary Cards (Rows 3-4)
        ws.merge_range("A3:B3", "SPONSORED LEADS", metric_card_fmt)
        ws.merge_range("A4:B4", '=COUNTA(C7:C200)', metric_num_fmt)

        ws.merge_range("C3:D3", "TIER A TARGETS", metric_card_fmt)
        ws.merge_range("C4:D4", '=COUNTIF(B7:B200, "A*")', metric_num_fmt)

        ws.merge_range("E3:F3", "DEMOS BOOKED", metric_card_fmt)
        ws.merge_range("E4:F4", '=COUNTIF(A7:A200, "Demo Booked")', metric_num_fmt)

        ws.merge_range("G3:H3", "CALLS MADE", metric_card_fmt)
        ws.merge_range("G4:H4", '=COUNTIF(A7:A200, "<>Not Contacted") - COUNTBLANK(A7:A200)', metric_num_fmt)

        ws.merge_range("I3:J3", "ACTIVE PIPELINE", metric_card_fmt)
        ws.merge_range("I4:J4", '=COUNTIF(A7:A200, "Gatekeeper*") + COUNTIF(A7:A200, "Follow-up")', metric_num_fmt)

        # Table Header on Row 6 (Index 5)
        ws.set_row(5, 28)
        for col_idx, header in enumerate(headers):
            ws.write(5, col_idx, header, header_fmt)

        # Write rows starting at Row 7 (Index 6)
        for row_idx, row in enumerate(companies_data, start=6):
            is_alt = (row_idx % 2 == 1)
            ws.set_row(row_idx, 22)
            status_val = row[0]
            
            for col_idx, val in enumerate(row):
                fmt = alt_data_fmt if is_alt else data_fmt
                if col_idx == 0:
                    if status_val == "Demo Booked":
                        ws.write(row_idx, col_idx, val, status_booked_fmt)
                    elif "Gatekeeper" in status_val:
                        ws.write(row_idx, col_idx, val, status_gatekeeper_fmt)
                    elif status_val == "Disqualified":
                        ws.write(row_idx, col_idx, val, status_disqualified_fmt)
                    elif status_val == "Follow-up":
                        ws.write(row_idx, col_idx, val, status_followup_fmt)
                    else:
                        ws.write(row_idx, col_idx, val, fmt)
                else:
                    ws.write(row_idx, col_idx, val, fmt)

        # Add Dropdown Validation
        ws.data_validation("A7:A200", {
            "validate": "list",
            "source": [
                "Not Contacted",
                "Called - No Answer",
                "SMS Sent",
                "Gatekeeper / Callback",
                "Follow-up",
                "Demo Booked",
                "Closed Won",
                "Disqualified",
            ],
        })

        ws.data_validation("B7:B200", {
            "validate": "list",
            "source": [
                "A - High (Sweet Spot / Fast Conversion)",
                "B - Medium (Scale / Multi-Tech)",
                "C - Disqualified / Do Not Call",
            ],
        })

        ws.data_validation("L7:L200", {
            "validate": "list",
            "source": ["Yes", "No"],
        })

        # Column widths
        col_widths = {
            0: 22, # Status
            1: 30, # Priority Tier
            2: 28, # Company Name
            3: 16, # Trade
            4: 18, # City / Metro
            5: 32, # Verified Licensee / Owner
            6: 20, # State License #
            7: 18, # Direct Phone
            8: 18, # Office Phone
            9: 26, # Email
            10: 24, # Website
            11: 18, # Running Google Ads
            12: 22, # Google Rating / Reviews
            13: 44, # Speed to Lead Hook
            14: 30, # Dial 1 Outcome
            15: 24, # Dial 2 Outcome
            16: 18, # Demo Booked Date
            17: 16, # Est. System Value
            18: 38, # Notes / Next Action
        }

        for col_idx, width in col_widths.items():
            ws.set_column(col_idx, col_idx, width)

        # Freeze panes below headers
        ws.freeze_panes(6, 3)

        workbook.close()
        print(f"Successfully wrote formatted Excel to {target_path}")
        return True
    except Exception as e:
        print(f"Could not write to {target_path}: {e}")
        return False

for p in xlsx_paths:
    create_excel(p)
