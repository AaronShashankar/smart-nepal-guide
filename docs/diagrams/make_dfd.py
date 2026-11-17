"""Generate the Data Flow Diagrams (Yourdon/DeMarco notation) for Smart Nepal Tourist & Trek Guide.

Run:  python3 docs/diagrams/make_dfd.py
Output: docs/diagrams/dfd_level0.svg, docs/diagrams/dfd_level1.svg
"""
import math
from pathlib import Path
from xml.sax.saxutils import escape

INK, GREY, FILL = "#1f2933", "#52606d", "#eef3f9"
HERE = Path(__file__).parent

DEFS = (f'<defs><marker id="arr" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" '
        f'markerUnits="userSpaceOnUse"><path d="M1 1.5 L11 6 L1 10.5 z" fill="{INK}"/></marker></defs>')


def svg_open(w, h, title):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="Helvetica, Arial, sans-serif">',
            DEFS, f'<rect width="{w}" height="{h}" fill="white"/>',
            f'<text x="30" y="40" font-size="18" font-weight="bold" fill="{INK}">{escape(title)}</text>']


def arrow(x1, y1, x2, y2, both=False):
    start = ' marker-start="url(#arr)"' if both else ""
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-width="1.3" marker-end="url(#arr)"{start}/>'


def label(x, y, lines, anchor="middle", size=10.5, up=False):
    """Multi-line label. up=True: last line sits at y and earlier lines stack above it."""
    out, n = [], len(lines)
    for k, t in enumerate(lines):
        ly = y - (n - 1 - k) * 13 if up else y + k * 13
        out.append(f'<text x="{x:.1f}" y="{ly:.1f}" text-anchor="{anchor}" font-size="{size}" font-style="italic" fill="{GREY}">{escape(t)}</text>')
    return "".join(out)


def entity(cx, cy, w, h, name, sub=None):
    s = [f'<rect x="{cx - w / 2}" y="{cy - h / 2}" width="{w}" height="{h}" fill="white" stroke="{INK}" stroke-width="1.6"/>']
    if sub:
        s.append(f'<text x="{cx}" y="{cy - 4}" text-anchor="middle" font-size="9.5" fill="{GREY}">{escape(sub)}</text>')
        s.append(f'<text x="{cx}" y="{cy + 11}" text-anchor="middle" font-size="12.5" font-weight="bold" fill="{INK}">{escape(name)}</text>')
    else:
        s.append(f'<text x="{cx}" y="{cy + 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="{INK}">{escape(name)}</text>')
    return "".join(s)


def process(cx, cy, r, num, lines, size=12):
    n = len(lines) + 1
    top = cy - (n - 1) * 15 / 2 + 4
    s = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{FILL}" stroke="{INK}" stroke-width="1.6"/>',
         f'<text x="{cx}" y="{top:.1f}" text-anchor="middle" font-size="{size}" font-weight="bold" fill="{INK}">{num}</text>']
    for k, t in enumerate(lines):
        s.append(f'<text x="{cx}" y="{top + (k + 1) * 15:.1f}" text-anchor="middle" font-size="{size}" fill="{INK}">{escape(t)}</text>')
    return "".join(s)


def store(x, cy, sid, name, dup, w=170, h=28):
    y0, y1 = cy - h / 2, cy + h / 2
    s = [f'<rect x="{x}" y="{y0}" width="{w}" height="{h}" fill="white" stroke="none"/>',
         f'<path d="M{x + w} {y0} H{x} V{y1} H{x + w} M{x + 36} {y0} V{y1}" fill="none" stroke="{INK}" stroke-width="1.4"/>']
    if dup:
        s.append(f'<path d="M{x + 6} {y0} V{y1}" stroke="{INK}" stroke-width="1.2"/>')
    s.append(f'<text x="{x + 21}" y="{cy + 4}" text-anchor="middle" font-size="11.5" font-weight="bold" fill="{INK}">{sid}</text>')
    s.append(f'<text x="{x + 44}" y="{cy + 4}" font-size="11.5" fill="{INK}">{escape(name)}</text>')
    return "".join(s)


def on_circle(cx, cy, r, tx, ty):
    a = math.atan2(ty - cy, tx - cx)
    return cx + r * math.cos(a), cy + r * math.sin(a)


# --------------------------------------------------------------------------- level 0
def level0():
    W, H = 1360, 840
    cx, cy, r = 680, 420, 112
    p = svg_open(W, H, "DFD Level 0 (Context Diagram): Bato, Smart Nepal Tourist & Trek Guide")
    edge = math.sqrt(r * r - 15 * 15)
    bw, bh = 190, 56
    p.append(entity(130, cy, 170, 60, "Traveller"))
    p.append(entity(1230, cy, 170, 60, "Admin"))
    p.append(entity(300, 140, bw, bh, "Weather Service", "external system"))
    p.append(entity(1060, 140, bw, bh, "AI Translation Service", "external system"))
    p.append(entity(300, 700, bw, bh, "SMS Gateway", "external system"))
    p.append(entity(1060, 700, bw, bh, "Push Notification (FCM)", "external system"))

    # Traveller (left)
    p.append(arrow(215, cy - 15, cx - edge, cy - 15))
    p.append(arrow(cx - edge, cy + 15, 215, cy + 15))
    p.append(label(393, cy - 24, ["registration, login, profile,", "search query, trek & month, trip places,", "reviews, symptom answers, SOS, check-in"], up=True))
    p.append(label(393, cy + 34, ["places & trek info, risk level & reasons,", "trip plan, budget, recommendations,", "weather, packing list, AMS advice"]))
    # Admin (right)
    p.append(arrow(1145, cy - 15, cx + edge, cy - 15))
    p.append(arrow(cx + edge, cy + 15, 1145, cy + 15))
    p.append(label(967, cy - 24, ["login, place & trek content,", "translation approvals, training dataset,", "user & review moderation"], up=True))
    p.append(label(967, cy + 34, ["dashboard statistics,", "model accuracy report,", "content & translation lists"]))

    # corner systems: (centre, flow into system, flow out of system)
    corners = [((300, 140), ["forecast data"], ["location, date"]),
               ((1060, 140), ["Nepali draft text"], ["English text"]),
               ((300, 700), ["delivery status"], ["SOS / missed", "check-in alert"]),
               ((1060, 700), None, ["check-in reminder,", "alerts"])]
    bw, bh = 190, 56
    for (bx, by), into, outof in corners:
        dx, dy = cx - bx, cy - by
        d = math.hypot(dx, dy)
        ux, uy = dx / d, dy / d
        px, py = -uy, ux                       # perpendicular
        offs = [(-9, into, True), (9, outof, False)] if into else [(0, outof, False)]
        for off, text, inward in offs:
            ox, oy = bx + px * off, by + py * off          # point on the offset line
            t = min((bw / 2) / abs(ux), (bh / 2) / abs(uy))
            sx, sy = ox + ux * t, oy + uy * t              # leaves the box
            # enters the circle: solve |o + u*k - c| = r
            fx, fy = ox - cx, oy - cy
            b = fx * ux + fy * uy
            k = -b - math.sqrt(b * b - (fx * fx + fy * fy - r * r))
            ex, ey = ox + ux * k, oy + uy * k
            p.append(arrow(sx, sy, ex, ey) if inward else arrow(ex, ey, sx, sy))
            side = off if off else 9
            mx, my = (sx + ex) / 2 + px * side * 3.6, (sy + ey) / 2 + py * side * 3.6
            p.append(label(mx, my, text))

    p.append(process(cx, cy, r, "0", ["Bato", "Tourist & Trek", "Guide"], size=15))
    p.append('</svg>')
    (HERE / "dfd_level0.svg").write_text("\n".join(p), encoding="utf-8")


# --------------------------------------------------------------------------- level 1
DUP = {"D1", "D2", "D3", "D4", "D6", "D9"}
NAMES = {"D1": "Users & Profiles", "D2": "Places & Treks", "D3": "Translations", "D4": "Trips", "D5": "Predictions",
         "D6": "ML Models", "D7": "Training Data", "D8": "Safety Records", "D9": "Reviews"}

R = 55
LX, RX = 350, 1200                 # process centres (left = traveller side, right = admin side)
LSX, RSX = 570, 830                # store x (left edge) for left / right processes
SW = 170

# (row centre, number, name lines, entity in-label, entity out-label, [(store, dir, label)])
# dir: "in" = store -> process, "out" = process -> store, "both"
LEFT = [
    (200, "1.0", ["Explore &", "Recommend"], ["search query,", "language, review"], ["places, treks, weather,", "recommendations"],
     [("D2", "in", "places, treks"), ("D3", "in", "localised text"), ("D9", "both", "reviews")]),
    (390, "2.0", ["Register &", "Manage", "Profile"], ["login details,", "profile"], ["auth token,", "profile data"],
     [("D1", "both", "user record")]),
    (590, "3.0", ["Predict", "Trek Risk"], ["trek, month"], ["risk level, reasons,", "safer alternatives"],
     [("D1", "in", "profile"), ("D2", "in", "trek stages"), ("D6", "in", "active model"), ("D5", "out", "prediction")]),
    (770, "4.0", ["Plan Trip"], ["places, start date"], ["trip plan, budget"],
     [("D2", "in", "places"), ("D4", "both", "trip, stops")]),
    (930, "5.0", ["Handle", "Safety"], ["SOS, check-in,", "symptom answers"], ["AMS advice,", "reminders"],
     [("D1", "in", "contacts"), ("D4", "in", "trip schedule"), ("D8", "out", "SOS, check-ins")]),
]
RIGHT = [
    (200, "6.0", ["Translate", "Content"], ["approve / edit"], ["drafts to review"],
     [("D3", "both", "EN / NE text")]),
    (390, "7.0", ["Manage", "Content"], ["place & trek content,", "user actions"], ["content list,", "reviews, users"],
     [("D2", "out", "content"), ("D3", "out", "English text"), ("D9", "both", "moderation"), ("D1", "both", "user status")]),
    (590, "8.0", ["Train &", "Evaluate", "Model"], ["training dataset,", "retrain request"], ["accuracy report"],
     [("D7", "both", "samples"), ("D6", "out", "trained model")]),
]
STEP = 38


ELB = 92


def flow(x1, y1, x2, y2, d, lab, store_x, anchor_x):
    """Process point (x1,y1) -> elbow -> store edge (store_x, y2). d: in / out / both."""
    path = f"M{x1:.1f} {y1:.1f} L{anchor_x:.1f} {y2:.1f} H{store_x:.1f}"
    if d == "in":
        path = f"M{store_x:.1f} {y2:.1f} H{anchor_x:.1f} L{x1:.1f} {y1:.1f}"
    ms = ' marker-start="url(#arr)"' if d == "both" else ""
    mid = (anchor_x + store_x) / 2
    return (f'<path d="{path}" fill="none" stroke="{INK}" stroke-width="1.3" marker-end="url(#arr)"{ms}/>'
            + label(mid, y2 - 5, [lab], size=10))


def store_rows(cy, n):
    return [cy + (i - (n - 1) / 2) * STEP for i in range(n)]


def level1():
    W, H = 1560, 1110
    p = svg_open(W, H, "DFD Level 1: Bato, Smart Nepal Tourist & Trek Guide")
    edge = math.sqrt(R * R - 12 * 12)

    # Traveller / Admin tall entity boxes
    p.append(f'<rect x="30" y="140" width="100" height="850" fill="white" stroke="{INK}" stroke-width="1.6"/>')
    p.append(f'<text x="80" y="570" text-anchor="middle" font-size="14" font-weight="bold" fill="{INK}">Traveller</text>')
    p.append(f'<rect x="1400" y="140" width="120" height="510" fill="white" stroke="{INK}" stroke-width="1.6"/>')
    p.append(f'<text x="1460" y="400" text-anchor="middle" font-size="14" font-weight="bold" fill="{INK}">Admin</text>')

    for cy, num, name, lin, lout, stores in LEFT:
        p.append(arrow(130, cy - 12, LX - edge, cy - 12))
        p.append(arrow(LX - edge, cy + 12, 130, cy + 12))
        p.append(label(213, cy - 18, lin, up=True))
        p.append(label(213, cy + 30, lout))
        for ys, (sid, d, lab) in zip(store_rows(cy, len(stores)), stores):
            ax = LSX - ELB
            px, py = on_circle(LX, cy, R, ax, ys)
            p.append(flow(px, py, ax, ys, d, lab, LSX, ax))
            p.append(store(LSX, ys, sid, NAMES[sid], sid in DUP))
        p.append(process(LX, cy, R, num, name))

    for cy, num, name, lin, lout, stores in RIGHT:
        p.append(arrow(1400, cy - 12, RX + edge, cy - 12))
        p.append(arrow(RX + edge, cy + 12, 1400, cy + 12))
        p.append(label(1327, cy - 18, lin, up=True))
        p.append(label(1327, cy + 30, lout))
        for ys, (sid, d, lab) in zip(store_rows(cy, len(stores)), stores):
            ax = RSX + SW + ELB
            px, py = on_circle(RX, cy, R, ax, ys)
            p.append(flow(px, py, ax, ys, d, lab, RSX + SW, ax))
            p.append(store(RSX, ys, sid, NAMES[sid], sid in DUP))
        p.append(process(RX, cy, R, num, name))

    # external systems
    top = 200 - R
    for cx, name, down, up in [(LX, "Weather Service", "forecast", "location"), (RX, "AI Translation Service", "Nepali draft", "English text")]:
        p.append(entity(cx, 85, 170, 44, name, "external system"))
        dy = math.sqrt(R * R - 15 * 15)
        p.append(arrow(cx - 15, 107, cx - 15, 200 - dy))
        p.append(arrow(cx + 15, 200 - dy, cx + 15, 107))
        p.append(label(cx - 20, 130, [down], anchor="end", size=10))
        p.append(label(cx + 20, 130, [up], anchor="start", size=10))
    for bx, name, lab in [(265, "SMS Gateway", "SOS / alert SMS"), (450, "Push Notification (FCM)", "reminders")]:
        p.append(entity(bx, 1052, 170 if bx > 300 else 140, 44, name, "external system"))
        sx, sy = on_circle(LX, 930, R, bx, 1030)
        p.append(arrow(sx, sy, bx, 1030))
        lx = (sx + bx) / 2 + (-8 if bx < LX else 8)
        p.append(label(lx, (sy + 1030) / 2 + 4, [lab], anchor="end" if bx < LX else "start", size=10))

    p.append(f'<text x="30" y="1098" font-size="10.5" fill="{GREY}">Data stores with an extra line on the left (D1, D2, D3, D4, D6, D9) are duplicates drawn more than once to avoid crossing lines.</text>')
    p.append('</svg>')
    (HERE / "dfd_level1.svg").write_text("\n".join(p), encoding="utf-8")


if __name__ == "__main__":
    level0()
    level1()
    print("docs/diagrams/dfd_level0.svg, docs/diagrams/dfd_level1.svg")
