"""Generate the UML class diagram for Bato (Smart Nepal Tourist & Trek Guide).

Drawn from the code, not from the plan: every class, attribute and method below exists in
backend/app/models (SQLAlchemy entities) or backend/app/ml (the risk model). Names are the
real Python names, so each one can be found with grep.

Run:  python3 docs/diagrams/make_class_diagram.py
Output: docs/diagrams/class_diagram.svg  (render to PNG with headless Chrome, see project notes)
"""
import math
from pathlib import Path
from xml.sax.saxutils import escape

INK, GREY, HEAD_FILL, NOTE_FILL, FRAME = "#1f2933", "#52606d", "#dde7f3", "#fdf8e4", "#9aa5b1"
W, H = 1940, 1590
HEAD, LINE, PAD = 26, 16, 6

# Domain columns (box width 240) and the ML package row
C = [40, 350, 660, 970, 1280, 1590]
ML_FRAME = 1155
ML_Y = ML_FRAME + 50

# name: (x, y, width, stereotype, [attributes], [methods] or None for no operations compartment)
CLASSES = {
    # --- users and safety -------------------------------------------------------------------
    "User": (C[1], 110, 240, None, [
        "+id: UUID", "+email: str", "+password_hash: str", "+full_name: str", "+phone: str",
        "+role: UserRole", "+auth_provider: AuthProvider", "+preferred_lang: Lang", "+is_blocked: bool"], []),
    "UserRole": (C[0], 200, 240, "«enumeration»", ["traveller", "admin"], None),
    "Interest": (C[0], 110, 240, None, ["+code: str"], []),
    "TravellerProfile": (C[1], 360, 240, None, [
        "+date_of_birth: date", "+fitness_level: FitnessLevel", "+trek_experience: TrekExperience",
        "+has_heart_condition: bool", "+has_asthma: bool", "+budget_level: BudgetLevel",
        "+travel_style: TravelStyle", "+nationality: Nationality"], []),
    "EmergencyContact": (C[0], 330, 240, None, [
        "+name: str", "+phone: str", "+email: str", "+relation: str", "+sort_order: int"], []),
    "SosEvent": (C[0], 500, 240, None, [
        "+id: UUID", "+latitude: Decimal", "+longitude: Decimal", "+accuracy_m: int", "+message: str",
        "+sent_at: datetime"], []),
    # --- trips, reviews, symptom checks, predictions ------------------------------------------
    "Trip": (C[2], 110, 240, None, [
        "+id: UUID", "+title: str", "+start_date: date", "+total_days: int", "+total_km: Decimal",
        "+estimated_budget_npr: int", "+share_token: str"], []),
    "TripStop": (C[3], 110, 240, None, ["+visit_order: int", "+day_no: int", "+visit_hours: Decimal"], []),
    "Review": (C[2], 330, 240, None, [
        "+rating: int", "+comment: str", "+lang: Lang", "+status: ReviewStatus", "+created_at: datetime"], []),
    "SymptomCheck": (C[2], 500, 240, None, [
        "+headache: int", "+gi_symptoms: int", "+fatigue: int", "+dizziness: int", "+red_flags: list[str]",
        "+total_score: int", "+result: SymptomResult", "+altitude_m: int", "+checked_at: datetime"], []),
    "RiskPrediction": (C[2], 740, 240, None, [
        "+month: int", "+predicted_level: RiskLevel", "+confidence: Decimal", "+reason_codes: list",
        "+input_snapshot: dict", "+created_at: datetime"], []),
    "MlModel": (C[2], 950, 240, None, [
        "+version: str", "+algorithm: MlAlgorithm", "+accuracy: Decimal", "+f1_score: Decimal",
        "+trained_at: datetime", "+is_active: bool", "+file_path: str"], []),
    "TrainingSample": (C[1], 600, 240, None, [
        "+max_altitude_m: int", "+max_daily_gain_m: int", "+total_days: int", "+distance_per_day_km: Decimal",
        "+month: int", "+age: int", "+fitness_level: FitnessLevel", "+trek_experience: TrekExperience",
        "+has_health_issue: bool", "+label: RiskLevel", "+source: str"], []),
    # --- treks --------------------------------------------------------------------------------
    "Trek": (C[3], 330, 240, None, [
        "+id: UUID", "+region: str", "+total_days: int", "+total_distance_km: Decimal", "+max_altitude_m: int",
        "+base_difficulty: RiskLevel", "+is_published: bool"], []),
    "TrekStage": (C[4], 400, 240, None, [
        "+day_no: int", "+distance_km: Decimal", "+walk_hours: Decimal", "+highest_point_m: int"], []),
    "Permit": (C[4], 570, 240, None, [
        "+code: str", "+fee_nepali_npr: int", "+fee_saarc_npr: int", "+fee_foreign_npr: int"], []),
    # --- places -------------------------------------------------------------------------------
    "Place": (C[4], 110, 240, None, [
        "+id: UUID", "+latitude: Decimal", "+longitude: Decimal", "+altitude_m: int", "+district: str",
        "+province: str", "+entry_fee_npr: int", "+entry_fee_saarc_npr: int", "+entry_fee_nepali_npr: int",
        "+tags: list[str]", "+is_published: bool"], []),
    "Category": (C[5], 110, 240, None, ["+code: str", "+icon: str"], []),
    "Area": (C[5], 215, 240, None, ["+code: str", "+name_en: str", "+name_ne: str", "+other_names: list[str]"],
             ["+name(lang: Lang): str"]),
    "PlaceTranslation": (C[5], 380, 240, None, [
        "+lang: Lang", "+name: str", "+name_latin: str", "+description: str", "+how_to_reach: str",
        "+is_machine_translated: bool", "+is_reviewed: bool"], []),
    "PlaceClimate": (C[5], 575, 240, None, [
        "+month: int", "+avg_temp_c: Decimal", "+rainfall_mm: int", "+visibility_score: int"], []),
    "Teahouse": (C[5], 720, 240, None, ["+phone: str", "+has_wifi: bool", "+has_hot_shower: bool", "+source: str"], []),
    # --- ML package (backend/app/ml) ----------------------------------------------------------
    "LoadedModel": (C[2], ML_Y, 240, None, ["+row: MlModel", "+model: DecisionTree | RandomForest"], []),
    "RandomForest": (970, ML_Y, 270, None, [
        "+n_trees: int = 50", "+max_depth: int = 8", "+min_samples_split: int = 4",
        '+max_features: int | str = "sqrt"', "+random_state: int", "+n_classes: int",
        "+trees: list[DecisionTree]", "+n_features: int"], [
        "+fit(X, y): RandomForest", "+votes(X): ndarray", "+predict_proba(X): ndarray", "+predict(X): ndarray",
        "+winning_paths(x): list[list[Condition]]", "+decision_path(x): list[Condition]",
        "+feature_importances_: ndarray «property»"]),
    "DecisionTree": (1300, ML_Y, 270, None, [
        "+max_depth: int = 6", "+min_samples_split: int = 4", "+max_features: int", "+random_state: int",
        "+n_classes: int", "+root: Node", "+n_features: int"], [
        "+fit(X, y): DecisionTree", "-_build(X, y, depth): Node", "-_choose_split(X, y): Split",
        "-_leaf(x): Node", "+predict_proba(X): ndarray", "+predict(X): ndarray",
        "+decision_path(x): list[Condition]", "+feature_importances_: ndarray «property»",
        "+depth: int «property»"]),
    "Node": (1650, ML_Y, 200, None, [
        "+counts: ndarray", "+feature: int", "+threshold: float", "+gain: float", "+left: Node", "+right: Node"],
        ["+is_leaf: bool «property»"]),
    "Condition": (1650, ML_Y + 210, 200, None, ["+feature: int", "+op: str", "+threshold: float"],
                  ["+holds(x): bool"]),
}

BOX = {}   # name -> (x, y, w, h, divider1, divider2)


def layout():
    for name, (x, y, w, stereo, attrs, meths) in CLASSES.items():
        head = HEAD + (14 if stereo else 0)
        a_h = len(attrs) * LINE + 2 * PAD if attrs else 10
        m_h = 0 if meths is None else (len(meths) * LINE + 2 * PAD if meths else 10)
        BOX[name] = (x, y, w, head + a_h + m_h, y + head, y + head + a_h)


def draw_class(name):
    x, y, w, h, d1, d2 = BOX[name]
    _, _, _, stereo, attrs, meths = CLASSES[name]
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="{INK}" stroke-width="1.4"/>',
         f'<rect x="{x}" y="{y}" width="{w}" height="{d1 - y}" fill="{HEAD_FILL}" stroke="{INK}" stroke-width="1.4"/>']
    if meths is not None:
        s.append(f'<line x1="{x}" y1="{d2}" x2="{x + w}" y2="{d2}" stroke="{INK}" stroke-width="1.2"/>')
    ny = y + 18
    if stereo:
        s.append(f'<text x="{x + w / 2}" y="{y + 15}" text-anchor="middle" font-size="10.5" fill="{GREY}">{escape(stereo)}</text>')
        ny = y + 32
    s.append(f'<text x="{x + w / 2}" y="{ny}" text-anchor="middle" font-size="13" font-weight="bold" fill="{INK}">{name}</text>')
    for i, a in enumerate(attrs):
        s.append(f'<text x="{x + 8}" y="{d1 + PAD + 12 + i * LINE}" font-size="11" fill="{INK}">{escape(a)}</text>')
    for i, m in enumerate(meths or []):
        s.append(f'<text x="{x + 8}" y="{d2 + PAD + 12 + i * LINE}" font-size="11" fill="{INK}">{escape(m)}</text>')
    return "".join(s)


def left(n, y): return (BOX[n][0], y)
def right(n, y): return (BOX[n][0] + BOX[n][2], y)
def top(n, x): return (x, BOX[n][1])
def bottom(n, x): return (x, BOX[n][1] + BOX[n][3])


MARKERS = f"""
<marker id="comp" markerWidth="20" markerHeight="14" refX="19" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <path d="M1 7 L10 1.5 L19 7 L10 12.5 z" fill="{INK}" stroke="{INK}" stroke-width="1.2"/></marker>
<marker id="open" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
  <path d="M1 1 L12 7 L1 13" fill="none" stroke="{INK}" stroke-width="1.3"/></marker>
"""


def text(x, y, s, anchor="middle", size=11, color=INK, italic=False):
    it = ' font-style="italic"' if italic else ""
    return f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="{size}"{it} fill="{color}">{escape(s)}</text>'


def mult(p, q, label, side):
    """Multiplicity text near endpoint p of segment p->q, on one side of the line."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    if abs(uy) > 0.9:            # vertical segment: put the text beside it
        return text(p[0] + 6 * side, p[1] + uy * 16 + 4, label, "start" if side > 0 else "end")
    return text(p[0] + ux * 16, p[1] - 6 * side + (10 if side < 0 else 0), label, "start" if ux > 0 else "end")


def edge(pts, kind="assoc", m1=None, m2=None, name=None, npos=None, s1=1, s2=1):
    """A line through `pts`. Composition: the diamond is at pts[0] (the whole).
    Dependency: the open arrow is at pts[-1]. m1/m2 = multiplicities at the start/end."""
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    attrs = {"comp": ' marker-start="url(#comp)"', "dep": ' marker-end="url(#open)" stroke-dasharray="6 4"'}.get(kind, "")
    out = [f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.3"{attrs}/>']
    if m1:
        out.append(mult(pts[0], pts[1], m1, s1))
    if m2:
        out.append(mult(pts[-1], pts[-2], m2, s2))
    if name:
        out.append(text(npos[0], npos[1], name, npos[2] if len(npos) > 2 else "middle", color=GREY, italic=True))
    return "".join(out)


def note(x, y, w, lines, anchors=()):
    """A UML note (folded corner) with dashed anchor lines to the given points."""
    h = 14 + len(lines) * 15
    out = [f'<path d="M{x} {y} H{x + w - 12} L{x + w} {y + 12} V{y + h} H{x} Z" fill="{NOTE_FILL}" stroke="{GREY}" stroke-width="1.1"/>',
           f'<path d="M{x + w - 12} {y} V{y + 12} H{x + w}" fill="none" stroke="{GREY}" stroke-width="1.1"/>']
    out += [text(x + 10, y + 19 + i * 15, s, "start", 11) for i, s in enumerate(lines)]
    for (ax, ay), (bx, by) in anchors:
        out.append(f'<path d="M{ax} {ay} L{bx} {by}" fill="none" stroke="{GREY}" stroke-width="1.1" stroke-dasharray="3 3"/>')
    return "".join(out)


def frame(x, y, w, h, label):
    tab_w = 9 + len(label) * 6.1
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{FRAME}" stroke-width="1.3"/>'
            f'<path d="M{x} {y + 24} H{x + tab_w} L{x + tab_w + 10} {y + 14} V{y} " fill="#f2f5f8" stroke="{FRAME}" stroke-width="1.3"/>'
            + text(x + 8, y + 17, label, "start", 11.5, GREY))


def legend(x, y):
    w = 410
    rows = [("comp", "composition: the ORM saves and deletes the parts with the whole"),
            ("assoc", "association (a foreign key or an ORM relationship)"),
            ("dep", "dependency (uses or creates)")]
    lines = ["+ public, - internal (Python name that starts with _)",
             "Entity classes hold data; the logic that uses them is in",
             "service functions (app/services), so most have no methods.",
             "* to * links are the tables user_interest and trek_permit.",
             "Not drawn: PlaceAlias, PlacePhoto, DismissedItem, PackingItem,",
             "BudgetRate, and the other *Translation classes (Trek, TrekStage,",
             "Permit, Category, Interest, Teahouse, PackingItem), which work",
             "like PlaceTranslation."]
    h = 44 + len(rows) * 26 + len(lines) * 15 + 6
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="#f7f9fb" stroke="{GREY}" stroke-dasharray="4 3"/>',
           text(x + 14, y + 22, "Notation", "start", 12.5) .replace('fill=', 'font-weight="bold" fill=')]
    for i, (m, label) in enumerate(rows):
        ly = y + 44 + i * 26
        a = {"comp": ' marker-start="url(#comp)"', "dep": ' marker-end="url(#open)" stroke-dasharray="6 4"'}.get(m, "")
        out.append(f'<path d="M{x + 14} {ly} H{x + 74}" fill="none" stroke="{INK}" stroke-width="1.3"{a}/>')
        out.append(text(x + 84, ly + 4, label, "start", 11))
    for i, s in enumerate(lines):
        out.append(text(x + 14, y + 44 + len(rows) * 26 + i * 15, s, "start", 11, GREY))
    return "".join(out), (x, y, w, h)


def check(edges_pts, extra_rects):
    """Warn when two boxes overlap or a line runs through a box (not just touching its edge)."""
    rects = {n: (b[0], b[1], b[0] + b[2], b[1] + b[3]) for n, b in BOX.items()} | extra_rects
    names = list(rects)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ax0, ay0, ax1, ay1 = rects[a]
            bx0, by0, bx1, by1 = rects[b]
            if ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1:
                print(f"WARNING: {a} overlaps {b}")
    for pts in edges_pts:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for n, (rx0, ry0, rx1, ry1) in rects.items():
                if x0 == x1 and rx0 < x0 < rx1 and max(min(y0, y1), ry0) + 1 < min(max(y0, y1), ry1) - 1:
                    print(f"WARNING: vertical line at x={x0} runs through {n}")
                if y0 == y1 and ry0 < y0 < ry1 and max(min(x0, x1), rx0) + 1 < min(max(x0, x1), rx1) - 1:
                    print(f"WARNING: horizontal line at y={y0} runs through {n}")


def main():
    layout()
    E, P = [], []   # SVG for the edges, and their points for the check

    def add(pts, *args, **kw):
        P.append(pts)
        E.append(edge(pts, *args, **kw))

    # --- User and what belongs to it
    add([bottom("User", 470), (470, BOX["TravellerProfile"][1])], "comp", "1", "0..1", s1=1, s2=1)
    add([left("User", 140), right("Interest", 140)], "assoc", "*", "*", s1=1, s2=1)
    add([left("User", 240), right("UserRole", 240)], "dep")
    add([left("User", 270), (300, 270), (300, 380), right("EmergencyContact", 380)], "assoc", "1", "0..*", s1=1, s2=1)
    add([left("User", 290), (315, 290), (315, 560), right("SosEvent", 560)], "assoc", "1", "0..*", s1=-1, s2=1)
    add([right("User", 150), left("Trip", 150)], "assoc", "1", "0..*", s1=1, s2=1)
    add([right("User", 200), (640, 200), (640, 360), left("Review", 360)], "assoc", "1", "0..*", s1=1, s2=1)
    add([right("User", 230), (625, 230), (625, 560), left("SymptomCheck", 560)], "assoc", "1", "0..*", s1=-1, s2=1)
    add([right("User", 260), (610, 260), (610, 790), left("RiskPrediction", 790)], "assoc", "1", "0..*", s1=-1, s2=1)
    # --- trips
    add([right("Trip", 150), left("TripStop", 150)], "comp", "1", "0..*", s1=1, s2=1)
    add([right("TripStop", 150), left("Place", 150)], "assoc", "0..*", "1", s1=1, s2=1)
    # --- review: about a place or a trek (exactly one, CHECK constraint one_target)
    add([right("Review", 345), (945, 345), (945, 300), left("Place", 300)], "assoc", "0..*", "0..1", s1=1, s2=1)
    add([right("Review", 400), left("Trek", 400)], "assoc", "0..*", "0..1", s1=-1, s2=1)
    E.append(f'<path d="M930 345 V400" fill="none" stroke="{GREY}" stroke-width="1.1" stroke-dasharray="3 3"/>')
    E.append(text(935, 377, "{xor}", "start", color=GREY, italic=True))
    # --- symptom check and risk prediction -> trek, prediction -> model
    add([right("SymptomCheck", 560), (940, 560), (940, 460), left("Trek", 460)], "assoc", "0..*", "0..1", s1=1, s2=-1)
    rp_b = BOX["Trek"][1] + BOX["Trek"][3]
    add([right("RiskPrediction", 790), (1090, 790), (1090, rp_b)], "assoc", "0..*", "1", s1=1, s2=1)
    E.append(text(1000, 782, "for", color=GREY, italic=True))
    add([bottom("RiskPrediction", 780), (780, BOX["MlModel"][1])], "assoc", "0..*", "0..1", s1=1, s2=1)
    E.append(text(774, 922, "made by", "end", color=GREY, italic=True))
    # --- treks
    add([right("Trek", 450), left("TrekStage", 450)], "comp", "1", "1..*", s1=1, s2=1)
    add([right("Trek", 475), (1245, 475), (1245, 620), left("Permit", 620)], "assoc", "*", "*", s1=-1, s2=1)
    place_b = BOX["Place"][1] + BOX["Place"][3]
    add([(1340, BOX["TrekStage"][1]), (1340, place_b)], "assoc", "0..*", "1", s1=1, s2=1)
    add([(1460, BOX["TrekStage"][1]), (1460, place_b)], "assoc", "0..*", "1", s1=-1, s2=-1)
    E.append(text(1332, 372, "from_place", "end", color=GREY, italic=True))
    E.append(text(1468, 372, "to_place", "start", color=GREY, italic=True))
    # --- places
    add([right("Place", 150), left("Category", 150)], "assoc", "0..*", "1", s1=1, s2=1)
    add([right("Place", 255), left("Area", 255)], "assoc", "0..*", "0..1", s1=1, s2=-1)
    # Place owns its translations and climate rows (shared-target composition: one diamond)
    pc_y = 630
    add([right("Place", 298), (1565, 298), (1565, pc_y)], "comp")
    add([(1565, 440), left("PlaceTranslation", 440)])
    E.append(text(1569, 434, "1..2", "start"))
    add([(1565, pc_y), left("PlaceClimate", pc_y)])
    E.append(text(1587, pc_y + 14, "0..12", "end"))
    E.append(text(1545, 291, "1"))
    add([left("Teahouse", 770), (1545, 770), (1545, 324), right("Place", 324)], "assoc", "0..*", None, s1=1)
    E.append(text(1530, 339, "1"))

    # --- ML package (y positions are relative to the top of its classes, ML_Y)
    Y = ML_Y
    add([top("LoadedModel", 840), (840, BOX["MlModel"][1] + BOX["MlModel"][3])], "assoc", None, "1", s2=1)
    E.append(text(848, Y - 20, "row", "start", color=GREY, italic=True))
    add([right("LoadedModel", Y + 30), left("RandomForest", Y + 30)], "assoc", None, "0..1", s2=1)
    E.append(text(950, Y + 46, "model", color=GREY, italic=True))
    dt_b = BOX["DecisionTree"][1] + BOX["DecisionTree"][3]
    low = dt_b + 30
    add([bottom("LoadedModel", 720), (720, low), (1435, low), (1435, dt_b)], "assoc", None, "0..1", s2=1)
    E.append(text(1080, low - 7, "model", color=GREY, italic=True))
    E.append(f'<path d="M915 {Y + 30} V{Y + 120} H720" fill="none" stroke="{GREY}" stroke-width="1.1" stroke-dasharray="3 3"/>')
    E.append(text(920, Y + 108, "{xor}", "start", color=GREY, italic=True))
    add([right("RandomForest", Y + 80), left("DecisionTree", Y + 80)], "comp", "1", "*", s1=1, s2=1)
    E.append(text(1270, Y + 98, "trees", color=GREY, italic=True))
    add([right("DecisionTree", Y + 40), left("Node", Y + 40)], "comp", "1", "0..1", s1=1, s2=1)
    E.append(text(1610, Y + 58, "root", color=GREY, italic=True))
    nr = BOX["Node"][0] + BOX["Node"][2]
    add([(nr, Y + 50), (nr + 30, Y + 50), (nr + 30, Y + 120), (nr, Y + 120)], "comp", None, "0..2", s2=-1)
    E.append(text(nr + 34, Y + 88, "left,", "start", color=GREY, italic=True))
    E.append(text(nr + 34, Y + 101, "right", "start", color=GREY, italic=True))
    E.append(text(nr + 24, Y + 44, "1", "start"))
    add([right("DecisionTree", Y + 260), left("Condition", Y + 260)], "dep", name="«create»", npos=(1610, Y + 252))

    leg, leg_rect = legend(1110, 735)
    ts_b = BOX["TrainingSample"][1] + BOX["TrainingSample"][3]
    train_lines = ["app/ml/train.py (functions, not a class)", "reads every TrainingSample, trains a",
                   "DecisionTree and a RandomForest, saves", "the better one at file_path and adds",
                   "an MlModel row."]
    ml_lines = ["DecisionTree and RandomForest have the same methods: fit(), predict(),",
                "predict_proba() and decision_path(). LoadedModel.model holds either",
                "one and the API calls these methods without knowing which (duck",
                "typing: there is no shared base class).",
                "tree.py also has gini() and best_split(): module functions, not methods."]
    notes = [
        note(350, ts_b + 26, 250, train_lines,
             anchors=[((470, ts_b + 26), (470, ts_b)), ((600, ts_b + 70), (660, ts_b + 140))]),
        note(40, Y, 560, ml_lines, anchors=[((600, Y + 50), (660, Y + 50))]),
    ]
    rects = {"legend": (leg_rect[0], leg_rect[1], leg_rect[0] + leg_rect[2], leg_rect[1] + leg_rect[3]),
             "train note": (350, ts_b + 26, 600, ts_b + 40 + 15 * len(train_lines)),
             "ml note": (40, Y, 600, Y + 14 + 15 * len(ml_lines))}
    check(P, rects)

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">',
         f'<defs>{MARKERS}</defs>', f'<rect width="{W}" height="{H}" fill="white"/>',
         f'<text x="30" y="36" font-size="18" font-weight="bold" fill="{INK}">Class Diagram: Bato, Smart Nepal Tourist &amp; Trek Guide</text>',
         text(30, 56, "Drawn from the code: backend/app/models and backend/app/ml. Names are the real Python names.",
              "start", 11.5, GREY),
         frame(20, 70, 1900, ML_FRAME - 95, "«package» app.models: database entities (SQLAlchemy ORM); every class extends Base"),
         frame(20, ML_FRAME, 1900, H - ML_FRAME - 20,
               "«package» app.ml: the risk model, written from scratch with NumPy; every class is a @dataclass")]
    p += [draw_class(n) for n in CLASSES]
    p += E
    p.append(leg)
    p += notes
    p.append('</svg>')
    out = Path(__file__).with_name("class_diagram.svg")
    out.write_text("\n".join(p), encoding="utf-8")
    print(out, {n: BOX[n][1] + BOX[n][3] for n in BOX})


if __name__ == "__main__":
    main()
