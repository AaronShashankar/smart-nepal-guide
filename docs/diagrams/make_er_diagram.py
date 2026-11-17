"""Generate the ER diagram (crow's foot notation) for Smart Nepal Tourist & Trek Guide.

Run:  python3 docs/diagrams/make_er_diagram.py
Output: docs/diagrams/er_diagram.svg
"""
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 1350, 840
BOX_W = 210
HEAD = 30
ROW = 20
PAD = 8
COLS = [30, 300, 570, 840, 1110]
ROWS = [80, 330, 580]

# (name, col, row, [(key, attribute, type)])
ENTITIES = [
    ("TRAVELLER_PROFILE", 0, 0, [("PK,FK", "user_id", "uuid"), ("", "date_of_birth", "date"), ("", "fitness_level", "enum"),
                                 ("", "trek_experience", "enum"), ("", "has_heart_condition", "bool"), ("", "has_asthma", "bool"),
                                 ("", "travel_style", "enum")]),
    ("TRIP", 1, 0, [("PK", "id", "uuid"), ("FK", "user_id", "uuid"), ("", "title", "text"), ("", "start_date", "date"),
                    ("", "total_days", "int"), ("", "estimated_budget_npr", "int")]),
    ("TRIP_STOP", 2, 0, [("PK", "id", "uuid"), ("FK", "trip_id", "uuid"), ("FK", "place_id", "uuid"), ("", "visit_order", "int"),
                         ("", "day_no", "int"), ("", "visit_hours", "numeric")]),
    ("CATEGORY", 3, 0, [("PK", "id", "uuid"), ("", "code", "text"), ("", "icon", "text")]),
    ("USER", 0, 1, [("PK", "id", "uuid"), ("", "email", "text"), ("", "password_hash", "text"), ("", "full_name", "text"),
                    ("", "role", "enum"), ("", "auth_provider", "enum"), ("", "preferred_lang", "enum")]),
    ("REVIEW", 1, 1, [("PK", "id", "uuid"), ("FK", "user_id", "uuid"), ("FK", "place_id (null)", "uuid"), ("FK", "trek_id (null)", "uuid"),
                      ("", "rating", "int"), ("", "comment", "text"), ("", "created_at", "time")]),
    ("PLACE", 2, 1, [("PK", "id", "uuid"), ("FK", "category_id", "uuid"), ("", "latitude", "numeric"), ("", "longitude", "numeric"),
                     ("", "altitude_m", "int"), ("", "district", "text"), ("", "entry_fee_npr", "int")]),
    ("PLACE_TRANSLATION", 3, 1, [("PK,FK", "place_id", "uuid"), ("PK", "lang", "enum"), ("", "name", "text"), ("", "description", "text"),
                                 ("", "how_to_reach", "text"), ("", "is_reviewed", "bool")]),
    ("PERMIT", 4, 1, [("PK", "id", "uuid"), ("", "code", "text"), ("", "fee_nepali_npr", "int"), ("", "fee_saarc_npr", "int"),
                      ("", "fee_foreign_npr", "int")]),
    ("ML_MODEL", 0, 2, [("PK", "id", "uuid"), ("", "version", "text"), ("", "algorithm", "enum"), ("", "accuracy", "numeric"),
                        ("", "f1_score", "numeric"), ("", "is_active", "bool")]),
    ("RISK_PREDICTION", 1, 2, [("PK", "id", "uuid"), ("FK", "user_id", "uuid"), ("FK", "trek_id", "uuid"), ("FK", "model_id", "uuid"),
                               ("", "month", "int"), ("", "predicted_level", "enum"), ("", "reason_codes", "jsonb")]),
    ("TREK", 2, 2, [("PK", "id", "uuid"), ("", "region", "text"), ("", "total_days", "int"), ("", "total_distance_km", "numeric"),
                    ("", "max_altitude_m", "int"), ("", "base_difficulty", "enum")]),
    ("TREK_STAGE", 3, 2, [("PK", "id", "uuid"), ("FK", "trek_id", "uuid"), ("FK", "from_place_id", "uuid"), ("FK", "to_place_id", "uuid"),
                          ("", "day_no", "int"), ("", "distance_km", "numeric"), ("", "walk_hours", "numeric")]),
    ("TREK_PERMIT", 4, 2, [("PK,FK", "trek_id", "uuid"), ("PK,FK", "permit_id", "uuid")]),
]

# (path d, marker at start, marker at end, label, label x, label y)
# markers: one = exactly one, zone = zero or one, many = one or more, zmany = zero or more
EDGES = [
    ("M135 330 V258", "one", "zone", "has", 157, 300),
    ("M205 330 V294 H405 V238", "one", "zmany", "plans", 305, 288),
    ("M510 160 H570", "one", "zmany", "contains", 540, 152),
    ("M630 238 V330", "zmany", "one", "visits", 655, 290),
    ("M945 178 V300 H730 V330", "one", "zmany", "groups", 838, 294),
    ("M780 410 H840", "one", "many", "has", 810, 402),
    ("M730 508 V544 H945 V580", "one", "zmany", "from / to", 838, 538),
    ("M780 660 H840", "one", "many", "has", 810, 652),
    ("M675 738 V792 H1215 V658", "one", "zmany", "requires", 945, 786),
    ("M1215 468 V580", "one", "zmany", "used in", 1244, 528),
    ("M240 420 H300", "one", "zmany", "writes", 270, 412),
    ("M570 420 H510", "zone", "zmany", "about", 540, 412),
    ("M455 508 V548 H620 V580", "zmany", "zone", "about", 537, 542),
    ("M205 508 V544 H360 V580", "one", "zmany", "requests", 282, 538),
    ("M240 660 H300", "one", "zmany", "used by", 270, 652),
    ("M570 660 H510", "one", "zmany", "for", 540, 652),
]

INK = "#1f2933"
GREY = "#52606d"
HEAD_FILL = "#dde7f3"

MARKERS = """
<marker id="one" markerWidth="20" markerHeight="20" refX="20" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <path d="M11 3 V17 M15 3 V17" stroke="{ink}" stroke-width="1.4" fill="none"/></marker>
<marker id="zone" markerWidth="20" markerHeight="20" refX="20" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <circle cx="8" cy="10" r="3.5" fill="white" stroke="{ink}" stroke-width="1.4"/><path d="M15 3 V17" stroke="{ink}" stroke-width="1.4"/></marker>
<marker id="many" markerWidth="20" markerHeight="20" refX="20" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <path d="M9 10 L20 3 M9 10 L20 17 M5 3 V17" stroke="{ink}" stroke-width="1.4" fill="none"/></marker>
<marker id="zmany" markerWidth="20" markerHeight="20" refX="20" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <circle cx="5" cy="10" r="3.5" fill="white" stroke="{ink}" stroke-width="1.4"/><path d="M10 10 L20 3 M10 10 L20 17" stroke="{ink}" stroke-width="1.4" fill="none"/></marker>
""".format(ink=INK)


def entity(name, col, row, attrs):
    x, y = COLS[col], ROWS[row]
    h = HEAD + len(attrs) * ROW + PAD
    out = [f'<g>',
           f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{h}" rx="4" fill="white" stroke="{INK}" stroke-width="1.4"/>',
           f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{HEAD}" rx="4" fill="{HEAD_FILL}" stroke="{INK}" stroke-width="1.4"/>',
           f'<text x="{x + BOX_W / 2}" y="{y + 20}" text-anchor="middle" font-size="13" font-weight="bold" fill="{INK}">{escape(name)}</text>']
    for i, (key, attr, typ) in enumerate(attrs):
        ty = y + HEAD + 15 + i * ROW
        if key:
            out.append(f'<text x="{x + 7}" y="{ty}" font-size="10" font-weight="bold" fill="{INK}">{key}</text>')
        weight = ' font-weight="bold"' if "PK" in key else ""
        out.append(f'<text x="{x + 48}" y="{ty}" font-size="11.5"{weight} fill="{INK}">{escape(attr)}</text>')
        out.append(f'<text x="{x + BOX_W - 7}" y="{ty}" text-anchor="end" font-size="10.5" fill="{GREY}">{typ}</text>')
    out.append(f'<line x1="{x + 42}" y1="{y + HEAD}" x2="{x + 42}" y2="{y + h}" stroke="#c3ccd6" stroke-width="1"/>')
    out.append('</g>')
    return "\n".join(out)


def legend():
    x, y = COLS[4], ROWS[0]
    rows = [("one", "exactly one"), ("zone", "zero or one"), ("many", "one or more"), ("zmany", "zero or more")]
    out = [f'<rect x="{x}" y="{y}" width="{BOX_W}" height="168" rx="4" fill="#f7f9fb" stroke="{GREY}" stroke-width="1" stroke-dasharray="4 3"/>',
           f'<text x="{x + 12}" y="{y + 22}" font-size="12.5" font-weight="bold" fill="{INK}">Notation (crow\'s foot)</text>']
    for i, (m, label) in enumerate(rows):
        ly = y + 46 + i * 24
        out.append(f'<path d="M{x + 14} {ly} H{x + 64}" stroke="{INK}" stroke-width="1.4" marker-end="url(#{m})"/>')
        out.append(f'<text x="{x + 76}" y="{ly + 4}" font-size="11.5" fill="{INK}">{label}</text>')
    out.append(f'<text x="{x + 12}" y="{y + 156}" font-size="10.5" fill="{GREY}">PK primary key, FK foreign key</text>')
    return "\n".join(out)


def main():
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
             f'font-family="Helvetica, Arial, sans-serif">',
             f'<defs>{MARKERS}</defs>',
             f'<rect width="{W}" height="{H}" fill="white"/>',
             f'<text x="30" y="44" font-size="18" font-weight="bold" fill="{INK}">ER Diagram: Bato, Smart Nepal Tourist &amp; Trek Guide (core entities)</text>']
    for d, ms, me, label, lx, ly in EDGES:
        parts.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.4" marker-start="url(#{ms})" marker-end="url(#{me})"/>')
        parts.append(f'<text x="{lx}" y="{ly}" text-anchor="middle" font-size="11" font-style="italic" fill="{GREY}">{label}</text>')
    for e in ENTITIES:
        parts.append(entity(*e))
    parts.append(legend())
    parts.append(f'<text x="30" y="826" font-size="11" fill="{GREY}">Trek, stage, permit and category translations follow the PLACE_TRANSLATION pattern. '
                 f'A REVIEW is about exactly one place or one trek.</text>')
    parts.append('</svg>')
    out = Path(__file__).with_name("er_diagram.svg")
    out.write_text("\n".join(parts), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
