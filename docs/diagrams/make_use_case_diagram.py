"""Generate the UML use case diagram for Smart Nepal Tourist & Trek Guide.

Run:  python3 docs/diagrams/make_use_case_diagram.py
Output: docs/diagrams/use_case_diagram.svg  (render to PNG with headless Chrome, see project notes)
"""
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 1320, 1075
Y0, STEP = 150, 60
RX, RY = 108, 22
C1, C2, C3 = 400, 680, 950          # use case column centres
INK, GREY, FILL = "#1f2933", "#52606d", "#eef3f9"


def y(row):
    return Y0 + row * STEP


TRAVELLER = [
    "Register / Login", "Manage Profile", "Switch Language (EN / NE)", "Explore & Search Places",
    "View Trek Details", "Predict Trek Risk", "Get Recommendations", "Plan Trip",
    "Get Packing Checklist", "Write Review", "Check AMS Symptoms", "Download Offline Data",
    "View Weather Forecast", "Send SOS Alert", "Daily Safety Check-in",
]
# (row, label) in column 2: included / extending use cases
SUPPORT = [(4, "Check Acclimatisation"), (5, "View Risk Explanation"), (6, "Suggest Safer Alternative"),
           (7, "Optimise Route"), (8, "Estimate Budget")]
ADMIN = [(1, "Manage Places & Treks"), (2, "Review Translations"), (3, "Manage Users & Reviews"),
         (4, "View Dashboard"), (5, "Upload Dataset & Retrain")]
AUTO_TRANSLATE_ROW = 6
EXTERNAL = [(6, "AI Translation Service"), (12, "Weather Service"), (13, "SMS Gateway"), (14, "Push Notification (FCM)")]

TRAV_X, TRAV_Y = 110, 560
ADMIN_X, ADMIN_Y = 1215, y(0)
EXT_X, EXT_W, EXT_H = 1140, 160, 40


def oval(cx, cy, label):
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{RX}" ry="{RY}" fill="{FILL}" stroke="{INK}" stroke-width="1.3"/>'
            f'<text x="{cx}" y="{cy + 4}" text-anchor="middle" font-size="12.5" fill="{INK}">{escape(label)}</text>')


def actor(cx, cy, label):
    # cy = centre of body; figure is about 72 high
    return (f'<g stroke="{INK}" stroke-width="1.6" fill="none">'
            f'<circle cx="{cx}" cy="{cy - 26}" r="10" fill="white"/>'
            f'<line x1="{cx}" y1="{cy - 16}" x2="{cx}" y2="{cy + 14}"/>'
            f'<line x1="{cx - 18}" y1="{cy - 6}" x2="{cx + 18}" y2="{cy - 6}"/>'
            f'<line x1="{cx}" y1="{cy + 14}" x2="{cx - 14}" y2="{cy + 36}"/>'
            f'<line x1="{cx}" y1="{cy + 14}" x2="{cx + 14}" y2="{cy + 36}"/></g>'
            f'<text x="{cx}" y="{cy + 56}" text-anchor="middle" font-size="14" font-weight="bold" fill="{INK}">{label}</text>')


def ext_system(row, label):
    cy = y(row)
    return (f'<rect x="{EXT_X}" y="{cy - EXT_H / 2}" width="{EXT_W}" height="{EXT_H}" rx="3" fill="white" stroke="{INK}" stroke-width="1.3"/>'
            f'<text x="{EXT_X + EXT_W / 2}" y="{cy - 4}" text-anchor="middle" font-size="9.5" fill="{GREY}">«external system»</text>'
            f'<text x="{EXT_X + EXT_W / 2}" y="{cy + 11}" text-anchor="middle" font-size="11.5" font-weight="bold" fill="{INK}">{escape(label)}</text>')


def line(x1, y1, x2, y2):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" stroke-width="1.2"/>'


def dep(d, label, lx, ly, rotate=False):
    """Dashed dependency arrow (include / extend) with an open arrowhead at the end."""
    t = f'transform="rotate(-90 {lx} {ly})" ' if rotate else ""
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.2" stroke-dasharray="6 4" marker-end="url(#open)"/>'
            f'<text {t}x="{lx}" y="{ly}" text-anchor="middle" font-size="11" font-style="italic" fill="{GREY}">«{label}»</text>')


def main():
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">',
         f'<defs><marker id="open" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse">'
         f'<path d="M1 1 L11 6 L1 11" fill="none" stroke="{INK}" stroke-width="1.3"/></marker></defs>',
         f'<rect width="{W}" height="{H}" fill="white"/>',
         f'<text x="30" y="44" font-size="18" font-weight="bold" fill="{INK}">Use Case Diagram: Bato, Smart Nepal Tourist &amp; Trek Guide</text>',
         # system boundary
         f'<rect x="240" y="80" width="860" height="{y(14) + 40 - 80}" rx="6" fill="none" stroke="{INK}" stroke-width="1.6"/>',
         f'<text x="256" y="106" font-size="13.5" font-weight="bold" fill="{INK}">Bato (Smart Nepal Tourist &amp; Trek Guide)</text>']

    # associations: traveller to every traveller use case (left tips)
    for i in range(len(TRAVELLER)):
        p.append(line(TRAV_X + 22, TRAV_Y - 6, C1 - RX, y(i)))
    # admin to login (horizontal) and to admin use cases (right tips)
    p.append(line(ADMIN_X - 22, ADMIN_Y, C1 + RX, y(0)))
    for row, _ in ADMIN:
        p.append(line(ADMIN_X - 20, ADMIN_Y + 2, C3 + RX, y(row)))
    # external systems
    p.append(line(C3 + RX, y(AUTO_TRANSLATE_ROW), EXT_X, y(AUTO_TRANSLATE_ROW)))
    for row in (12, 13, 14):
        p.append(line(C1 + RX, y(row), EXT_X, y(row)))

    # include / extend
    p.append(dep(f"M{C1 + RX} {y(4)} H{C2 - RX}", "include", (C1 + C2) / 2, y(4) - 7))
    p.append(dep(f"M{C1 + RX} {y(5)} H{C2 - RX}", "include", (C1 + C2) / 2, y(5) - 7))
    p.append(dep(f"M{C2 - RX} {y(6)} L{C1 + RX - 6} {y(5) + 10}", "extend", (C1 + C2) / 2, y(6) + 16))
    p.append(dep(f"M{C1 + RX} {y(7)} H{C2 - RX}", "include", (C1 + C2) / 2, y(7) - 7))
    p.append(dep(f"M{C2 - RX} {y(8)} L{C1 + RX - 6} {y(7) + 10}", "extend", (C1 + C2) / 2, y(8) + 16))
    ex = (C2 + RX + C3 - RX) / 2
    p.append(dep(f"M{C3 - RX} {y(AUTO_TRANSLATE_ROW)} H{ex} V{y(1)} H{C3 - RX}", "extend", ex - 6, (y(1) + y(AUTO_TRANSLATE_ROW)) / 2 + 60, rotate=True))

    # use cases
    for i, label in enumerate(TRAVELLER):
        p.append(oval(C1, y(i), label))
    for row, label in SUPPORT:
        p.append(oval(C2, y(row), label))
    for row, label in ADMIN:
        p.append(oval(C3, y(row), label))
    p.append(oval(C3, y(AUTO_TRANSLATE_ROW), "Auto-translate Content"))

    # actors and external systems
    p.append(actor(TRAV_X, TRAV_Y, "Traveller"))
    p.append(actor(ADMIN_X, ADMIN_Y, "Admin"))
    for row, label in EXTERNAL:
        p.append(ext_system(row, label))
    p.append('</svg>')

    out = Path(__file__).with_name("use_case_diagram.svg")
    out.write_text("\n".join(p), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
