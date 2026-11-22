from pathlib import Path

from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "deliverables"
TMP_DIR = ROOT / ".tmp"
OUT_DIR.mkdir(exist_ok=True)
TMP_DIR.mkdir(exist_ok=True)

PPTX_PATH = OUT_DIR / "Intent-Revenue-Services-Overview.pptx"
LOGO_PATH = ROOT / "public" / "og-symbol.png"
B2B_IMAGE_PATH = TMP_DIR / "b2b-reference.jpeg"
B2B_ROUNDED_PATH = TMP_DIR / "b2b-reference-rounded.png"

SLIDE_W = 13.333
SLIDE_H = 7.5

NAVY = "14232E"
NAVY_2 = "243742"
TEAL = "07899B"
CYAN = "22D3EE"
LIME = "B7FF4A"
BG = "F3F8F6"
WHITE = "FFFFFF"
PALE = "E5F3F1"
PALE_CYAN = "DFF4F6"
PALE_BLUE = "E8F0F3"
MUTED = "5C6C75"
BORDER = "D4E0E0"
CORAL = "FF6B5F"

FONT_HEAD = "Aptos Display"
FONT_BODY = "Aptos"
FONT_MONO = "Aptos Mono"


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def add_box(slide, x, y, w, h, fill=WHITE, line=None, radius=True, transparency=0):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.fill.transparency = transparency
    shape.line.color.rgb = rgb(line or fill)
    shape.line.width = Pt(1)
    return shape


def add_text(slide, text, x, y, w, h, size=18, color=NAVY, bold=False,
             font=FONT_BODY, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP,
             margin=0, tracking=None):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    p.space_before = Pt(0)
    run = p.add_run()
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = rgb(color)
    if tracking is not None:
        run.font._element.set("spc", str(tracking))
    return box


def add_rich_text(slide, segments, x, y, w, h, size=18, color=NAVY,
                  font=FONT_BODY, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    for segment in segments:
        run = p.add_run()
        run.text = segment[0]
        run.font.name = segment[4] if len(segment) > 4 else font
        run.font.size = Pt(segment[3] if len(segment) > 3 else size)
        run.font.bold = segment[2] if len(segment) > 2 else False
        run.font.color.rgb = rgb(segment[1] if len(segment) > 1 else color)
    return box


def add_line(slide, x1, y1, x2, y2, color=BORDER, width=1):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x1), Inches(y1), Inches(x2 - x1), Inches(y2 - y1))
    line.fill.solid()
    line.fill.fore_color.rgb = rgb(color)
    line.line.fill.background()
    return line


def add_circle(slide, x, y, d, fill=TEAL, line=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.line.color.rgb = rgb(line or fill)
    return shape


def add_brand(slide, number=None, label=None, dark=False):
    text_color = WHITE if dark else NAVY
    if LOGO_PATH.exists():
        slide.shapes.add_picture(str(LOGO_PATH), Inches(0.52), Inches(0.36), height=Inches(0.34))
    add_text(slide, "INTENT", 0.98, 0.40, 1.25, 0.25, size=12, color=text_color, bold=True, tracking=160)
    if label:
        add_text(slide, label.upper(), 10.1, 0.43, 2.58, 0.22, size=8.5,
                 color=WHITE if dark else MUTED, bold=True, font=FONT_MONO,
                 align=PP_ALIGN.RIGHT, tracking=100)
    if number is not None:
        add_text(slide, f"{number:02d}", 12.23, 7.04, 0.45, 0.2, size=8.5,
                 color=WHITE if dark else MUTED, bold=True, font=FONT_MONO,
                 align=PP_ALIGN.RIGHT)


def add_title(slide, eyebrow, title, subtitle=None, number=None):
    add_brand(slide, number=number, label=eyebrow)
    add_text(slide, eyebrow.upper(), 0.65, 1.02, 4.6, 0.25, size=9.5, color=TEAL,
             bold=True, font=FONT_MONO, tracking=130)
    add_text(slide, title, 0.65, 1.38, 11.8, 0.82, size=34, color=NAVY,
             bold=True, font=FONT_HEAD)
    if subtitle:
        add_text(slide, subtitle, 0.67, 2.28, 10.8, 0.52, size=15, color=MUTED)


def add_bullet(slide, title, body, x, y, w, accent=TEAL):
    add_circle(slide, x, y + 0.05, 0.11, fill=accent)
    add_text(slide, title, x + 0.23, y, w - 0.23, 0.26, size=15, color=NAVY, bold=True)
    add_text(slide, body, x + 0.23, y + 0.31, w - 0.23, 0.48, size=11.5, color=MUTED)


def add_pill(slide, text, x, y, w, fill=PALE_CYAN, color=TEAL):
    add_box(slide, x, y, w, 0.34, fill=fill, line=fill)
    add_text(slide, text.upper(), x, y + 0.02, w, 0.18, size=8.5, color=color,
             bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER, tracking=70)


def rounded_image(source: Path, destination: Path, radius=42):
    image = Image.open(source).convert("RGB")
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, image.width, image.height), radius=radius, fill=255)
    output = Image.new("RGBA", image.size, (255, 255, 255, 0))
    output.paste(image, (0, 0), mask)
    output.save(destination)


def add_icon_search(slide, x, y, color=TEAL):
    ring = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(0.36), Inches(0.36))
    ring.fill.background()
    ring.line.color.rgb = rgb(color)
    ring.line.width = Pt(2)
    handle = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x + 0.30), Inches(y + 0.31), Inches(0.27), Inches(0.045))
    handle.rotation = 45
    handle.fill.solid(); handle.fill.fore_color.rgb = rgb(color); handle.line.fill.background()


def add_icon_bolt(slide, x, y, color=TEAL):
    bolt = slide.shapes.add_shape(MSO_SHAPE.LIGHTNING_BOLT, Inches(x), Inches(y), Inches(0.48), Inches(0.58))
    bolt.fill.solid(); bolt.fill.fore_color.rgb = rgb(color); bolt.line.fill.background()


def add_icon_building(slide, x, y, color=TEAL):
    body = add_box(slide, x, y, 0.52, 0.58, fill=WHITE, line=color, radius=False)
    body.line.width = Pt(1.8)
    for row in range(2):
        for col in range(2):
            add_box(slide, x + 0.10 + col * 0.20, y + 0.10 + row * 0.18, 0.08, 0.08,
                    fill=color, line=color, radius=False)


def add_icon_blocks(slide, x, y, color=TEAL):
    for dx, dy in [(0, 0), (0.27, 0), (0, 0.27), (0.27, 0.27)]:
        add_box(slide, x + dx, y + dy, 0.22, 0.22, fill=WHITE, line=color)


def make_deck():
    prs = Presentation()
    prs.slide_width = Inches(SLIDE_W)
    prs.slide_height = Inches(SLIDE_H)
    blank = prs.slide_layouts[6]

    # 1 — Cover
    slide = prs.slides.add_slide(blank)
    bg = slide.background.fill
    bg.solid(); bg.fore_color.rgb = rgb(BG)
    add_box(slide, 8.38, -0.55, 5.5, 8.55, fill=PALE_CYAN, line=PALE_CYAN, radius=False)
    for x in [9.1, 10.05, 11.0, 11.95, 12.9]:
        add_line(slide, x, 0, x + 0.012, 7.5, color="CDEBED")
    for y in [0.7, 1.65, 2.6, 3.55, 4.5, 5.45, 6.4]:
        add_line(slide, 8.38, y, 13.33, y + 0.012, color="CDEBED")
    add_brand(slide, label="Service overview")
    add_text(slide, "Services built to turn\nattention into revenue.", 0.72, 1.65, 7.45, 2.0,
             size=42, color=NAVY, bold=True, font=FONT_HEAD)
    add_text(slide, "Websites, demand generation, commercial accounts, and custom systems—built to work together.",
             0.76, 4.02, 6.75, 0.85, size=17, color=MUTED)
    add_pill(slide, "Intent Revenue", 0.75, 5.32, 1.78, fill=NAVY, color=WHITE)
    add_circle(slide, 10.35, 2.08, 1.86, fill=WHITE, line=WHITE)
    slide.shapes.add_picture(str(LOGO_PATH), Inches(10.73), Inches(2.46), height=Inches(1.10))
    add_text(slide, "REVENUE\nENGINEERED", 9.22, 4.58, 3.75, 0.74, size=17, color=TEAL,
             bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER)

    # 2 — System overview
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(BG)
    add_title(slide, "The system", "One system. Four ways to grow.",
              "Every service is designed around a simple path: get found, capture demand, convert faster, and create repeat work.", 2)
    cards = [
        ("01", "Get found", "Organic search, local visibility, reviews, and content.", add_icon_search),
        ("02", "Capture demand", "Websites, landing paths, paid media, and clear offers.", add_icon_bolt),
        ("03", "Convert faster", "LeadNet, intake, follow-up, and practical automation.", add_icon_blocks),
        ("04", "Win repeat work", "Commercial outreach, onboarding, and account development.", add_icon_building),
    ]
    for i, (num, title, body, icon_fn) in enumerate(cards):
        x = 0.68 + i * 3.14
        add_box(slide, x, 3.18, 2.82, 2.82, fill=WHITE, line=BORDER)
        add_text(slide, num, x + 0.22, 3.40, 0.45, 0.22, size=9, color=TEAL, bold=True, font=FONT_MONO)
        icon_fn(slide, x + 2.05, 3.34)
        add_text(slide, title, x + 0.22, 4.22, 2.34, 0.42, size=20, color=NAVY, bold=True, font=FONT_HEAD)
        add_text(slide, body, x + 0.22, 4.78, 2.30, 0.74, size=12.3, color=MUTED)
        add_box(slide, x + 0.22, 5.68, 0.62, 0.06, fill=TEAL, line=TEAL, radius=False)

    # 3 — LeadNet
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(BG)
    add_title(slide, "LeadNet", "A better website. A faster first response.",
              "The front door and the follow-through, designed as one system.", 3)
    add_bullet(slide, "Search-ready website", "Mobile-first pages, clear calls to action, analytics, and a strong technical foundation.", 0.82, 3.18, 4.7)
    add_bullet(slide, "Speed-to-lead follow-up", "Texting, intake, owner replies, missed-call recovery, and after-hours response.", 0.82, 4.22, 4.7)
    add_bullet(slide, "A clearer operating picture", "Every inquiry gets a next step—and the team can see what happened.", 0.82, 5.26, 4.7)
    add_box(slide, 6.25, 2.90, 6.15, 3.78, fill=PALE_CYAN, line=PALE_CYAN)
    # Browser card
    add_box(slide, 6.72, 3.28, 3.67, 2.65, fill=WHITE, line=BORDER)
    add_circle(slide, 6.94, 3.49, 0.08, fill=CORAL)
    add_circle(slide, 7.10, 3.49, 0.08, fill="F5C451")
    add_circle(slide, 7.26, 3.49, 0.08, fill="61C58B")
    add_box(slide, 6.94, 3.82, 2.00, 0.12, fill=NAVY, line=NAVY, radius=False)
    add_box(slide, 6.94, 4.11, 2.82, 0.08, fill="B8C6CA", line="B8C6CA", radius=False)
    add_box(slide, 6.94, 4.31, 2.42, 0.08, fill="D2DDDF", line="D2DDDF", radius=False)
    add_box(slide, 6.94, 4.75, 1.20, 0.37, fill=TEAL, line=TEAL)
    add_text(slide, "REQUEST SERVICE", 6.94, 4.86, 1.20, 0.12, size=6.8, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    # Phone card
    add_box(slide, 10.02, 3.55, 1.70, 2.55, fill=NAVY, line=NAVY)
    add_text(slide, "NEW LEAD", 10.27, 3.88, 1.20, 0.18, size=7.5, color=CYAN, bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER)
    add_text(slide, "Response sent\nin 12 seconds", 10.25, 4.35, 1.24, 0.62, size=12.5, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    add_box(slide, 10.36, 5.35, 1.04, 0.30, fill=LIME, line=LIME)
    add_text(slide, "REPLY", 10.36, 5.42, 1.04, 0.12, size=7.5, color=NAVY, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, "Website", 7.88, 6.20, 1.10, 0.2, size=8.5, color=MUTED, bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER)
    add_text(slide, "+", 9.40, 6.15, 0.30, 0.24, size=16, color=TEAL, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, "Follow-up", 10.34, 6.20, 1.10, 0.2, size=8.5, color=MUTED, bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER)

    # 4 — Organic search
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(BG)
    add_title(slide, "Organic growth", "Build demand you do not have to rent.",
              "A durable search foundation that compounds as the business earns relevance and trust.", 4)
    add_box(slide, 0.72, 3.05, 5.32, 3.45, fill=WHITE, line=BORDER)
    add_text(slide, "GOOGLE SEARCH", 1.03, 3.40, 1.62, 0.20, size=8.2, color=MUTED, bold=True, font=FONT_MONO)
    add_box(slide, 1.03, 3.78, 4.10, 0.48, fill=BG, line=BORDER)
    add_icon_search(slide, 1.18, 3.85, color=TEAL)
    add_text(slide, "best contractor near me", 1.76, 3.90, 3.10, 0.18, size=12.2, color=NAVY)
    for i, (title, url) in enumerate([
        ("Trusted local service, built around your market", "intentrev.net / service-area"),
        ("Clear answers for the jobs customers need", "intentrev.net / services"),
    ]):
        y = 4.56 + i * 0.88
        add_text(slide, title, 1.04, y, 4.45, 0.25, size=13.2, color=TEAL, bold=True)
        add_text(slide, url, 1.04, y + 0.29, 3.3, 0.18, size=8.5, color="4A8B62", font=FONT_MONO)
    add_text(slide, "The work", 6.75, 3.18, 1.25, 0.24, size=10, color=TEAL, bold=True, font=FONT_MONO)
    add_bullet(slide, "Local SEO + service-area pages", "Own the searches that match your territory and highest-value work.", 6.75, 3.65, 5.42)
    add_bullet(slide, "Google Business Profile + reviews", "Make trust visible before a prospect ever reaches the website.", 6.75, 4.65, 5.42)
    add_bullet(slide, "Useful content", "Answer the real questions customers ask—and give Google something worth ranking.", 6.75, 5.65, 5.42)

    # 5 — Paid + content
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(BG)
    add_title(slide, "Paid acquisition + content", "Create demand. Capture demand. Know what worked.",
              "Paid media and creative built around qualified actions—not isolated platform metrics.", 5)
    columns = [
        ("CAPTURE", "Google Search\nLocal Services Ads", TEAL),
        ("CREATE", "Meta campaigns\nShort-form creative", CORAL),
        ("RECAPTURE", "Retargeting\nCross-platform content", NAVY_2),
    ]
    for i, (label, body, accent) in enumerate(columns):
        x = 0.76 + i * 3.29
        add_box(slide, x, 3.22, 2.86, 2.35, fill=WHITE, line=BORDER)
        add_box(slide, x, 3.22, 2.86, 0.10, fill=accent, line=accent, radius=False)
        add_text(slide, label, x + 0.22, 3.64, 2.1, 0.20, size=8.8, color=accent, bold=True, font=FONT_MONO, tracking=80)
        add_text(slide, body, x + 0.22, 4.16, 2.30, 0.74, size=18, color=NAVY, bold=True, font=FONT_HEAD)
    # outcome rail
    add_box(slide, 10.42, 3.22, 2.16, 2.35, fill=NAVY, line=NAVY)
    add_text(slide, "QUALIFIED\nACTION", 10.70, 3.77, 1.60, 0.62, size=13.5, color=CYAN, bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER)
    add_text(slide, "Call · form · booking · sale", 10.72, 4.77, 1.55, 0.40, size=9.5, color=WHITE, align=PP_ALIGN.CENTER)
    for x in [3.71, 7.00, 10.29]:
        add_text(slide, "→", x, 4.08, 0.32, 0.35, size=20, color=TEAL, bold=True, align=PP_ALIGN.CENTER)
    add_pill(slide, "Conversion tracking", 1.10, 6.12, 2.04)
    add_pill(slide, "Landing-page optimization", 3.45, 6.12, 2.64)
    add_pill(slide, "Creative testing", 6.42, 6.12, 1.90)
    add_pill(slide, "Ongoing management", 8.65, 6.12, 2.35)

    # 6 — Commercial partnerships
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(BG)
    add_brand(slide, number=6, label="Intent B2B")
    add_text(slide, "Not leads. Accounts that send you work.", 0.65, 1.00, 11.8, 0.90,
             size=34, color=NAVY, bold=True, font=FONT_HEAD)
    if B2B_IMAGE_PATH.exists():
        rounded_image(B2B_IMAGE_PATH, B2B_ROUNDED_PATH)
        slide.shapes.add_picture(str(B2B_ROUNDED_PATH), Inches(0.72), Inches(2.12), width=Inches(6.02), height=Inches(4.02))
    add_text(slide, "COMMERCIAL PARTNERSHIPS", 7.28, 2.18, 3.0, 0.22, size=8.8, color=TEAL, bold=True, font=FONT_MONO, tracking=90)
    add_bullet(slide, "Get in front of the buyer", "Research, outreach, and follow-up with the people who assign commercial work.", 7.28, 2.70, 5.05)
    add_bullet(slide, "Handle the legwork", "Vendor packets, insurance requirements, portals, and onboarding support.", 7.28, 3.74, 5.05)
    add_bullet(slide, "Keep the account", "No shared leads and no per-lead fees. The relationship belongs to the contractor.", 7.28, 4.78, 5.05)
    add_rich_text(slide, [("5", TEAL, True, 34, FONT_HEAD), (" commercial accounts landed for one Central Florida HVAC company", NAVY, True, 16, FONT_BODY)],
                  7.28, 5.93, 5.15, 0.62, valign=MSO_ANCHOR.MIDDLE)

    # 7 — Custom software
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(BG)
    add_title(slide, "Custom software + automation", "Software shaped around how you actually sell.",
              "Phone-first systems that fit the operation instead of forcing the operation into another generic tool.", 7)
    stack = [
        ("CUSTOMER", "Forms · calls · SMS", PALE_CYAN, TEAL),
        ("WORKFLOW", "Intake · routing · follow-up", PALE_BLUE, NAVY_2),
        ("TEAM", "CRM · scheduling · owner handoff", PALE, "397067"),
        ("INSIGHT", "Dashboards · attribution · outcomes", "EDE9F4", "6D4C91"),
    ]
    for i, (label, body, fill, accent) in enumerate(stack):
        y = 3.02 + i * 0.82
        x = 0.85 + i * 0.34
        add_box(slide, x, y, 5.30, 0.64, fill=fill, line=fill)
        add_text(slide, label, x + 0.22, y + 0.20, 1.10, 0.16, size=8, color=accent, bold=True, font=FONT_MONO)
        add_text(slide, body, x + 1.52, y + 0.17, 3.40, 0.22, size=12.5, color=NAVY, bold=True)
    add_box(slide, 7.30, 3.02, 5.15, 3.32, fill=WHITE, line=BORDER)
    add_bullet(slide, "Intake automation", "Forms, missed-call recovery, after-hours workflows, and follow-up.", 7.66, 3.45, 4.32)
    add_bullet(slide, "AI-assisted qualification", "Use voice or messaging when the team cannot answer immediately.", 7.66, 4.41, 4.32)
    add_bullet(slide, "Deep integrations", "Connect business email, scheduling, CRM, advertising, and reporting.", 7.66, 5.37, 4.32)

    # 8 — Partnership / CTA
    slide = prs.slides.add_slide(blank)
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = rgb(NAVY)
    add_brand(slide, number=8, label="Ongoing partnership", dark=True)
    add_text(slide, "Strategy first.\nSystems next.\nOptimization always.", 0.78, 1.30, 6.10, 2.65,
             size=38, color=WHITE, bold=True, font=FONT_HEAD)
    add_text(slide, "We stay in the work—reviewing the signal, tightening the system, and adjusting as markets and seasons move.",
             0.82, 4.38, 5.82, 0.86, size=16, color="C8D4D9")
    add_box(slide, 7.55, 1.30, 4.95, 4.78, fill="1B303B", line="2B4652")
    steps = [
        ("01", "Map the opportunity", "Revenue streams, capacity, territory, and economics."),
        ("02", "Build the system", "The right mix of website, demand, automation, and outreach."),
        ("03", "Measure what matters", "Qualified actions, customer outcomes, and revenue signal."),
        ("04", "Improve continuously", "Reporting reviews, testing, and focused adjustments."),
    ]
    for i, (num, title, body) in enumerate(steps):
        y = 1.72 + i * 1.00
        add_text(slide, num, 7.92, y + 0.05, 0.38, 0.18, size=8.5, color=CYAN, bold=True, font=FONT_MONO)
        add_text(slide, title, 8.48, y, 3.48, 0.25, size=14, color=WHITE, bold=True)
        add_text(slide, body, 8.48, y + 0.31, 3.46, 0.40, size=10.2, color="AFC0C7")
    add_box(slide, 0.80, 6.04, 5.48, 0.62, fill=LIME, line=LIME)
    add_text(slide, "LET'S MAP THE NEXT REVENUE SYSTEM.", 0.80, 6.25, 5.48, 0.18,
             size=10.8, color=NAVY, bold=True, font=FONT_MONO, align=PP_ALIGN.CENTER, tracking=70)
    add_text(slide, "intentrev.net   ·   (407) 543-7480", 7.58, 6.54, 4.88, 0.20,
             size=10, color="AFC0C7", bold=True, font=FONT_MONO, align=PP_ALIGN.RIGHT)

    # Document metadata
    prs.core_properties.title = "Intent Revenue Services Overview"
    prs.core_properties.subject = "A concise overview of Intent Revenue services"
    prs.core_properties.author = "Intent Revenue"
    prs.core_properties.company = "Intent Revenue"
    prs.core_properties.comments = "Light-theme service overview inspired by Intent Revenue's website and commercial-partnership reference deck."
    prs.save(PPTX_PATH)
    print(PPTX_PATH)


if __name__ == "__main__":
    make_deck()
