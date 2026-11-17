"""Generate the UML class diagram for Smart Nepal Tourist & Trek Guide.

Run:  python3 docs/diagrams/make_class_diagram.py
Output: docs/diagrams/class_diagram.svg  (render to PNG with headless Chrome, see project notes)
"""
import math
from pathlib import Path
from xml.sax.saxutils import escape

INK, GREY, HEAD_FILL = "#1f2933", "#52606d", "#dde7f3"
W, H = 2020, 1300
BOX_W, HEAD, LINE, PAD = 230, 26, 16, 6
C = [30, 360, 640, 920, 1200, 1480, 1760]
R = [80, 330, 600, 850, 1110]

# name: (col, row, stereotype, [attributes], [methods])
CLASSES = {
    "Admin": (0, 0, None, [], ["+manageContent()", "+reviewTranslation()", "+moderateReview()", "+retrainModel()"]),
    "User": (1, 0, None, ["-id: UUID", "-email: String", "-passwordHash: String", "-fullName: String", "-role: UserRole",
                          "-preferredLang: Lang"], ["+register()", "+login(): Token", "+logout()", "+switchLanguage(lang)"]),
    "Traveller": (1, 1, None, ["-interests: Interest[]"], ["+planTrip(): Trip", "+predictRisk(trek, month)", "+writeReview()",
                                                          "+sendSOS()", "+checkIn()"]),
    "TravellerProfile": (1, 2, None, ["-dateOfBirth: Date", "-fitnessLevel: Fitness", "-trekExperience: Experience",
                                      "-hasHeartCondition: Boolean", "-hasAsthma: Boolean", "-budgetLevel: Budget"],
                         ["+getAge(): int", "+toFeatures(): Vector"]),
    "EmergencyContact": (0, 1, None, ["-name: String", "-phone: String", "-relation: String"], ["+sendSMS(msg)"]),
    "SOSEvent": (0, None, None, ["-latitude: Decimal", "-longitude: Decimal", "-message: String", "-sentAt: DateTime"],
                 ["+notifyContacts()"]),
    "CheckIn": (0, None, None, ["-dueAt: DateTime", "-checkedInAt: DateTime", "-status: CheckInStatus"],
                ["+markDone()", "+markMissed()"]),
    "SymptomCheck": (0, None, None, ["-altitudeM: int", "-headache: int", "-giSymptoms: int", "-fatigue: int", "-dizziness: int"],
                     ["+lakeLouiseScore(): int", "+advice(): Result"]),
    "Review": (3, 0, None, ["-rating: int", "-comment: String", "-lang: Lang", "-status: ReviewStatus", "-createdAt: DateTime"],
               ["+setStatus(s)"]),
    "Trip": (2, 1, None, ["-id: UUID", "-title: String", "-startDate: Date", "-totalDays: int", "-estimatedBudgetNpr: int"],
             ["+addStop(place)", "+optimiseRoute()", "+estimateBudget(): int"]),
    "TripStop": (3, 1, None, ["-visitOrder: int", "-dayNo: int", "-visitHours: float"], []),
    "Place": (4, 1, None, ["-id: UUID", "-latitude: Decimal", "-longitude: Decimal", "-altitudeM: int", "-district: String",
                           "-entryFeeNpr: int"], ["+getName(lang): String", "+distanceTo(p): float", "+bestMonths(): int[]"]),
    "Trek": (5, 0, None, ["-id: UUID", "-region: String", "-totalDays: int", "-maxAltitudeM: int", "-baseDifficulty: RiskLevel"],
             ["+getStages(): TrekStage[]", "+maxDailyGain(): int", "+checkAcclimatisation()"]),
    "TrekStage": (5, 1, None, ["-dayNo: int", "-distanceKm: float", "-walkHours: float", "-highestPointM: int"],
                  ["+altitudeGain(): int"]),
    "Permit": (6, 0, None, ["-code: String", "-feeNepaliNpr: int", "-feeSaarcNpr: int", "-feeForeignNpr: int"],
               ["+feeFor(nationality): int"]),
    "RiskPrediction": (4, 2, None, ["-month: int", "-predictedLevel: RiskLevel", "-confidence: float", "-reasonCodes: String[]",
                                    "-createdAt: DateTime"], ["+explain(lang): String[]"]),
    "MLModel": (4, 3, "«abstract»", ["-version: String", "-accuracy: float", "-f1Score: float", "-isActive: Boolean",
                                    "-trainedAt: DateTime"], ["+train(samples)", "+predict(x): RiskLevel", "+evaluate(test)"]),
    "DecisionTree": (3, 4, None, ["-maxDepth: int", "-minSamplesSplit: int", "-root: Node"],
                     ["+gini(rows): float", "+bestSplit(rows)", "+decisionPath(x)"]),
    "RandomForest": (5, 4, None, ["-nTrees: int", "-trees: DecisionTree[]"], ["+bootstrap(rows)", "+majorityVote(x)"]),
    "TrainingSample": (5, 3, None, ["-maxAltitudeM: int", "-maxDailyGainM: int", "-month: int", "-age: int",
                                    "-fitnessLevel: Fitness", "-label: RiskLevel"], []),
}
SAFETY_Y = {"EmergencyContact": 330, "SOSEvent": 480, "CheckIn": 650, "SymptomCheck": 820}

BOX = {}   # name -> (x, y, w, h, divider1, divider2)


def layout():
    for name, (col, row, stereo, attrs, meths) in CLASSES.items():
        x = C[col]
        y = SAFETY_Y.get(name, R[row] if row is not None else 0)
        head = HEAD + (14 if stereo else 0)
        a_h = max(len(attrs), 0) * LINE + 2 * PAD if attrs else 10
        m_h = len(meths) * LINE + 2 * PAD if meths else 10
        BOX[name] = (x, y, BOX_W, head + a_h + m_h, y + head, y + head + a_h)


def draw_class(name):
    x, y, w, h, d1, d2 = BOX[name]
    _, _, stereo, attrs, meths = CLASSES[name]
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="{INK}" stroke-width="1.4"/>',
         f'<rect x="{x}" y="{y}" width="{w}" height="{d1 - y}" fill="{HEAD_FILL}" stroke="{INK}" stroke-width="1.4"/>',
         f'<line x1="{x}" y1="{d2}" x2="{x + w}" y2="{d2}" stroke="{INK}" stroke-width="1.2"/>']
    ny = y + 18
    if stereo:
        s.append(f'<text x="{x + w / 2}" y="{y + 15}" text-anchor="middle" font-size="10.5" fill="{GREY}">{escape(stereo)}</text>')
        ny = y + 32
    style = ' font-style="italic"' if stereo == "«abstract»" else ""
    s.append(f'<text x="{x + w / 2}" y="{ny}" text-anchor="middle" font-size="13" font-weight="bold"{style} fill="{INK}">{name}</text>')
    for i, a in enumerate(attrs):
        s.append(f'<text x="{x + 8}" y="{d1 + PAD + 12 + i * LINE}" font-size="11" fill="{INK}">{escape(a)}</text>')
    for i, m in enumerate(meths):
        s.append(f'<text x="{x + 8}" y="{d2 + PAD + 12 + i * LINE}" font-size="11" fill="{INK}">{escape(m)}</text>')
    return "".join(s)


def left(n, y): return (BOX[n][0], y)
def right(n, y): return (BOX[n][0] + BOX[n][2], y)
def top(n, x): return (x, BOX[n][1])
def bottom(n, x): return (x, BOX[n][1] + BOX[n][3])
def mid_y(n): return BOX[n][1] + BOX[n][3] / 2
def mid_x(n): return BOX[n][0] + BOX[n][2] / 2


MARKERS = f"""
<marker id="gen" markerWidth="18" markerHeight="18" refX="16" refY="8" orient="auto" markerUnits="userSpaceOnUse">
  <path d="M1 1 L16 8 L1 15 z" fill="white" stroke="{INK}" stroke-width="1.3"/></marker>
<marker id="comp" markerWidth="20" markerHeight="14" refX="19" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <path d="M1 7 L10 1.5 L19 7 L10 12.5 z" fill="{INK}" stroke="{INK}" stroke-width="1.2"/></marker>
<marker id="agg" markerWidth="20" markerHeight="14" refX="19" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
  <path d="M1 7 L10 1.5 L19 7 L10 12.5 z" fill="white" stroke="{INK}" stroke-width="1.2"/></marker>
<marker id="open" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
  <path d="M1 1 L12 7 L1 13" fill="none" stroke="{INK}" stroke-width="1.3"/></marker>
"""


def mult(p, q, text, side):
    """Multiplicity text near endpoint p of segment p->q, on one side of the line."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    px, py = -uy * side, ux * side
    x, y = p[0] + ux * 14 + px * 10, p[1] + uy * 14 + py * 10 + 4
    if abs(uy) > 0.9:            # vertical line: put text beside it
        x, y = p[0] + px * 6 + (6 if px > 0 else -6) * 0, p[1] + uy * 16 + 4
        anchor = "start" if px > 0 else "end"
        x = p[0] + (6 if px > 0 else -6)
    else:
        anchor = "middle"
    return f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="11" fill="{INK}">{text}</text>'


def edge(pts, kind="assoc", m1=None, m2=None, name=None, npos=None, s1=1, s2=-1):
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    attrs = ""
    if kind == "comp":
        attrs = ' marker-start="url(#comp)"'
    elif kind == "agg":
        attrs = ' marker-start="url(#agg)"'
    elif kind == "gen":
        attrs = ' marker-end="url(#gen)"'
    elif kind == "dep":
        attrs = ' marker-end="url(#open)" stroke-dasharray="6 4"'
    out = [f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.3"{attrs}/>']
    if m1:
        out.append(mult(pts[0], pts[1], m1, s1))
    if m2:
        out.append(mult(pts[-1], pts[-2], m2, s2))
    if name:
        out.append(f'<text x="{npos[0]}" y="{npos[1]}" text-anchor="middle" font-size="11" font-style="italic" fill="{GREY}">{escape(name)}</text>')
    return "".join(out)


def legend(x, y):
    rows = [("gen", "", "generalisation (is a)"), ("comp", "", "composition (owns, part dies with whole)"),
            ("agg", "", "aggregation (has, parts can exist alone)"), (None, "", "association"),
            ("open", "6 4", "dependency (uses)")]
    out = [f'<rect x="{x}" y="{y}" width="430" height="190" rx="4" fill="#f7f9fb" stroke="{GREY}" stroke-dasharray="4 3"/>',
           f'<text x="{x + 14}" y="{y + 24}" font-size="12.5" font-weight="bold" fill="{INK}">Notation</text>']
    for i, (m, dash, text) in enumerate(rows):
        ly = y + 50 + i * 28
        if m in ("comp", "agg"):
            a = f' marker-start="url(#{m})"'
        elif m:
            a = f' marker-end="url(#{m})"'
        else:
            a = ""
        if dash:
            a += f' stroke-dasharray="{dash}"'
        out.append(f'<path d="M{x + 16} {ly} H{x + 86}" fill="none" stroke="{INK}" stroke-width="1.3"{a}/>')
        out.append(f'<text x="{x + 100}" y="{ly + 4}" font-size="11.5" fill="{INK}">{text}</text>')
    out.append(f'<text x="{x + 14}" y="{y + 182}" font-size="10.5" fill="{GREY}">- private attribute, + public method; numbers are multiplicities</text>')
    return "".join(out)


def main():
    layout()
    E = []
    # generalisation
    E.append(edge([right("Admin", 130), left("User", 130)], "gen"))
    E.append(edge([top("Traveller", 475), bottom("User", 475)], "gen"))
    # traveller and its parts
    E.append(edge([bottom("Traveller", 475), top("TravellerProfile", 475)], "comp", "1", "1", s1=1, s2=1))
    tl = BOX["Traveller"][0]
    for k, n in enumerate(["EmergencyContact", "SOSEvent", "CheckIn", "SymptomCheck"]):
        kind = "comp" if n == "EmergencyContact" else "assoc"
        E.append(edge([(tl, 350 + k * 32), right(n, mid_y(n))], kind, None, "0..*", s2=1))
        E.append(f'<text x="{tl - 22 if k == 0 else tl - 4}" y="{350 + k * 32 - 3}" text-anchor="end" font-size="11" fill="{INK}">1</text>')
    # traveller -> review / trip / risk prediction (channel between col 1 and col 2)
    ch = C[2] - 25
    E.append(edge([right("Traveller", 345), (ch, 345), (ch, 150), left("Review", 150)], "assoc", "1", "0..*",
                  "writes", (760, 143), s1=-1, s2=-1))
    E.append(edge([right("Traveller", 395), left("Trip", 395)], "assoc", "1", "0..*", s1=-1, s2=-1))
    E.append(edge([right("Traveller", 450), (ch, 450), (ch, 660), left("RiskPrediction", 660)], "assoc", "1", "0..*",
                  "requests", (900, 653), s1=-1, s2=-1))
    # trip
    E.append(edge([right("Trip", 395), left("TripStop", 395)], "comp", "1", "1..*", s1=-1, s2=-1))
    E.append(edge([right("TripStop", 395), left("Place", 395)], "assoc", "0..*", "1", s1=-1, s2=-1))
    # review targets
    rv = BOX["Review"][0] + BOX_W
    E.append(edge([(rv, 110), left("Trek", 110)], "assoc", "0..*", "0..1", "about", (1315, 103), s1=-1, s2=-1))
    E.append(edge([(rv, 190), (1315, 190), top("Place", 1315)], "assoc", "0..*", "0..1", "about", (1255, 183), s1=-1, s2=1))
    # trek
    E.append(edge([right("Trek", 140), left("Permit", 140)], "assoc", "*", "*", s1=-1, s2=-1))
    E.append(edge([bottom("Trek", 1595), top("TrekStage", 1595)], "comp", "1", "1..*", s1=-1, s2=-1))
    E.append(edge([left("TrekStage", 400), right("Place", 400)], "assoc", "0..*", "2", "from / to", (1455, 445), s1=-1, s2=-1))
    # risk prediction
    rp_r = BOX["RiskPrediction"][0] + BOX_W
    trek_b = BOX["Trek"][1] + BOX["Trek"][3]
    E.append(edge([(rp_r, 640), (1745, 640), (1745, trek_b + 22), (1665, trek_b + 22), (1665, trek_b)], "assoc", "0..*", "1",
                  "for", (1590, 633), s1=-1, s2=1))
    E.append(edge([bottom("RiskPrediction", 1315), top("MLModel", 1315)], "assoc", "0..*", "1", "made by", (1365, 812), s1=-1, s2=-1))
    # ML
    ml_b = BOX["MLModel"][1] + BOX["MLModel"][3]
    bus = R[4] - 35
    E.append(edge([top("DecisionTree", 1035), (1035, bus), (1595, bus)], "assoc"))
    E.append(edge([top("RandomForest", 1595), (1595, bus)], "assoc"))
    E.append(edge([(1315, bus), (1315, ml_b)], "gen"))
    E.append(edge([left("RandomForest", 1180), right("DecisionTree", 1180)], "agg", "1", "1..*", "contains", (1315, 1173), s1=-1, s2=-1))
    E.append(edge([right("MLModel", 905), left("TrainingSample", 905)], "dep", name="«uses»", npos=(1455, 897)))

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">',
         f'<defs>{MARKERS}</defs>', f'<rect width="{W}" height="{H}" fill="white"/>',
         f'<text x="30" y="44" font-size="18" font-weight="bold" fill="{INK}">Class Diagram: Bato, Smart Nepal Tourist &amp; Trek Guide</text>']
    p += [draw_class(n) for n in CLASSES]
    p += E
    p.append(legend(C[1], 860))
    p.append('</svg>')
    out = Path(__file__).with_name("class_diagram.svg")
    out.write_text("\n".join(p), encoding="utf-8")
    print(out, {n: BOX[n][1] + BOX[n][3] for n in BOX})


if __name__ == "__main__":
    main()
