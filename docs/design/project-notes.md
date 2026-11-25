# BCA 6th Semester – Project II (CAPJ356) Notes

## Final choice
**Bato (बाटो): Smart Nepal Tourist & Trek Guide** (see the ⭐ section below). The ideas below were the earlier shortlist.

## First preferred idea (replaced by Bato)
**Nepali News Classifier / Fake News Detector** (noted 2026-11-05)

- Classify Nepali news articles by category (politics, sports, business, etc.) and/or flag likely fake news
- Algorithm to explain in the viva: TF-IDF + Naive Bayes (baseline), optionally a small neural network trained on a GPU
- Matches syllabus units: data collection, frameworks & APIs, application of GPUs, documentation with equations

## Shortlisted ideas (noted 2026-11-05)

### Nepali Handwritten Character Recognition
- Recognise handwritten Devanagari characters and digits from images or a drawing canvas
- Algorithm: CNN (fits the "Application of GPUs" unit); public datasets exist (e.g. the Devanagari Handwritten Character Dataset)

### LAN File Sharing & Chat App
- Share files and chat over a local network without internet (labs, hostels, offices)
- Algorithm/concepts: socket programming (TCP/UDP), peer discovery by broadcast, file integrity checks (CRC/MD5)
- Fits the Network Programming and Distributed System subjects

### ⭐ Bato (बाटो): Smart Nepal Tourist & Trek Guide (combined: Tourist Guide App + Trek Difficulty & Risk Predictor)
- **App name (decided 2026-11-06):** Bato (बाटो, "the path"). Tagline: *Find your way, trek safely* / *आफ्नो बाटो पत्ता लगाउनुहोस्, सुरक्षित पदयात्रा गर्नुहोस्*. Report title: **"Bato: Smart Nepal Tourist & Trek Guide"**. Technical IDs still use the old name: repo folder `smart-nepal-guide/`, Android package `com.smartnepalguide.app`, URL scheme `smartnepalguide`.
One app for travelling in Nepal: discover places, plan trips, and check how hard and risky a trek is for *you*.

👉 Full feature list (all features kept): [feature.md](feature.md)
👉 Algorithms, functions & protocols: [algorithm.md](../../backend/docs/algorithm.md)
👉 Tech stack & bilingual (EN/NE) design: [techstack.md](techstack.md)
👉 **Project proposal (Google Doc, TU format, main version):** https://docs.google.com/document/d/1ItoAqAYN_T6jpiHhWCCFgAL4HXguSMz05pMJYDvOo_I/edit
👉 Earlier proposal draft (Claude Doc): https://claude.ai/artifact/7EkBuAA5aXwQUqiYopfJKL
👉 Architecture diagram image for Figure 1: [docs/diagrams/architecture.png](../diagrams/architecture.png)
👉 Database design (full schema): [database.md](../../backend/docs/database.md) · ER diagram image: [docs/diagrams/er_diagram.png](../diagrams/er_diagram.png)
👉 Use case diagram: [docs/diagrams/use_case_diagram.png](../diagrams/use_case_diagram.png) (source: docs/diagrams/make_use_case_diagram.py)
👉 **UI redesign (design canvas: 8 screens + style sheet, private until shared from its Share menu):** https://claude.ai/artifact/XyZ7XFUVMygZw38axdfPK2
👉 **Project tracker (Google Sheet, source of truth for every task, bug, test case and decision):** https://docs.google.com/spreadsheets/d/1LWie4PGyiRj2xzo-zmTeK6Zd2-Rd_LAcVR2xOdkE33I/edit
👉 **Version 1 implementation plan:** [Phase 1 — setup, users, explore](../plans/version1/phase1.md) · [Phase 2 — itinerary & AI risk predictor](../plans/version1/phase2.md) · [Phase 3 — trip planner, admin, release](../plans/version1/phase3.md)
👉 **Version 2 implementation plan:** [Overview](../plans/version2/README.md) · [Phase 1 — smart trek features](../plans/version2/phase1.md) · [Phase 2 — personalisation & community](../plans/version2/phase2.md) · [Phase 3 — safety & offline](../plans/version2/phase3.md)
👉 **Search & recommendations, college → real product:** [plan and status (Stage 1–3)](../product/search-recommendation.md) · measured: [search quality](../../backend/docs/benchmarks/search_quality.md) · [recommendation variety](../../backend/docs/benchmarks/recommend_quality.md)
👉 **Beyond college (after the defense):** [Product scope report](../product/beyond-college.md) · Version 3 plan: [Overview](../plans/version3/README.md) · [Phase 1 — validate](../plans/version3/phase1.md) · [Phase 2 — launch-ready](../plans/version3/phase2.md) · [Phase 3 — agency pilot & business](../plans/version3/phase3.md)
👉 DFD: [Level 0 / context](../diagrams/dfd_level0.png) · [Level 1](../diagrams/dfd_level1.png) (source: docs/diagrams/make_dfd.py, Yourdon/DeMarco notation)
  - Level 1 processes: 1.0 Explore & Recommend, 2.0 Register & Manage Profile, 3.0 Predict Trek Risk, 4.0 Plan Trip, 5.0 Handle Safety, 6.0 Translate Content, 7.0 Manage Content, 8.0 Train & Evaluate Model
  - Data stores: D1 Users & Profiles, D2 Places & Treks, D3 Translations, D4 Trips, D5 Predictions, D6 ML Models, D7 Training Data, D8 Safety Records, D9 Reviews (each groups tables from database.md)
👉 Class diagram: [docs/diagrams/class_diagram.png](../diagrams/class_diagram.png) (source: docs/diagrams/make_class_diagram.py) — redrawn from the code on 2026-11-25, with the real Python names; 27 classes in two packages:
  - **app.models** (SQLAlchemy entities, all extend `Base`): one `User` class with a `role` (`UserRole` enumeration: traveller / admin, no subclasses) and a `TravellerProfile`; User → Interest (* to *), EmergencyContact, SosEvent, SymptomCheck, Trip, Review, RiskPrediction; Trip ◆ TripStop → Place; Review → Place {xor} Trek; Trek ◆ TrekStage (from_place / to_place → Place), Trek * Permit; Place → Category, Area, Teahouse; Place ◆ PlaceTranslation, PlaceClimate; RiskPrediction → Trek, MlModel; TrainingSample (read by train.py)
  - **app.ml** (written from scratch, all `@dataclass`): LoadedModel (row → MlModel, model → DecisionTree {xor} RandomForest); RandomForest ◆ DecisionTree ◆ Node ◆ Node (left, right); DecisionTree creates Condition. No abstract base class: the tree and the forest share fit / predict / predict_proba / decision_path by duck typing
  - Composition (◆) = ORM `cascade="all, delete-orphan"`. Entity classes have no methods (except `Area.name(lang)`): the logic is in `app/services` functions. Not drawn: PlaceAlias, PlacePhoto, DismissedItem, PackingItem, BudgetRate and the other *Translation classes
- Diagrams are generated by Python scripts in `docs/diagrams/` as SVG, then rendered to PNG with headless Chrome (`--screenshot --force-device-scale-factor=2 --window-size=<svg width>,<svg height>`).
- **Solo project** (decided 2026-11-05): one student does all parts.

## TU report format rules (from syllabus, Project III / internship sections)
- Proposal flow: Introduction → Problem Statement → Objectives → Methodology (Requirement Identification: existing system, literature review, requirement analysis; Feasibility: technical, operational, economic, schedule; High Level Design: flow chart / working mechanism / algorithms) → Gantt Chart → Expected Outcome → References
- A4; margins top 1", bottom 1", right 1", left 1.25"
- Times New Roman 12 pt body, justified, 1.5 line spacing
- Headings bold: chapter 16 pt, section 14 pt, sub-section 12 pt
- Figures and tables centred; figure captions below, table captions above, bold 12 pt
- Page numbers centred at the bottom (roman before Chapter 1, numeric from Chapter 1)
- APA referencing

**Modules**
1. **Place discovery**: tourist spots, temples, viewpoints and trek routes with details, photos and a map
2. **Trip planner**: pick the places you want to visit and get the best visiting order and a day-by-day plan
3. **Trek difficulty & risk predictor**: enter the trek, month and your fitness/age/experience to get easy / moderate / hard / risky, plus reasons
4. **Altitude sickness warning**: flags days where the altitude gain is unsafe and suggests acclimatisation days
5. **Recommendations**: suggests treks or places that match your fitness, budget and season
6. **Offline mode**: saves routes and info for areas with no network
7. **Admin panel**: add or edit places, routes and trek data

**Algorithms to explain in the viva**
- **Decision tree / random forest**: predicts trek difficulty and risk (main AI part)
- **TSP nearest-neighbour heuristic + Haversine distance**: orders the places in a trip plan
- **Rule-based altitude check**: daily gain above ~300–500 m once over 3,000 m → warning
- **Content-based filtering**: recommends treks or places
- **Linear interpolation** (V2): altitude at any point between two stages for the altitude profile chart
- **K-nearest neighbours** (V2): finds similar treks (min-max normalised, Euclidean distance, K=4) and keeps the ones the risk model rates lower for this user ("safer alternatives")
- **Cache-aside with a time-to-live** (V2): weather forecasts from Open-Meteo kept in Redis for 1 hour, with a 24-hour stale copy if the API is down

**Data collection**
- Trek routes: daily stages, altitude, distance (Annapurna Circuit, ABC, EBC, Langtang, Mardi Himal, Poon Hill, etc.)
- Weather and season data per region
- Labelled difficulty data: from trekking agency ratings, plus a survey of trekkers

**Possible stack**
- **Decided (2026-11-05), see [techstack.md](techstack.md):** React Native + Expo (mobile), React (admin), Python FastAPI (backend + ML), PostgreSQL, Redis (weather cache, added in V2), MapLibre + OpenStreetMap
- Bilingual: English (primary) + Nepali (secondary), with AI-assisted translation and human review

**Team split (if 3 members)**
- Member 1: mobile app UI + maps + offline mode
- Member 2: backend, database, admin panel, trip planner
- Member 3: data collection, ML model, risk/altitude logic

## Syllabus summary (Project II, CAPJ356)
- 2 credits, 4 hrs/week practical, team project
- Platforms: Java, Visual C++, PHP, Python, or any current technology
- Units: proposal → application development (OOP, frameworks/APIs, design patterns, data collection, GPUs) → project management → documentation (format, tables, figures, equations, references, abstract)

## Likely evaluation (the PDF only gives this for Project I; confirm with the department)
- Proposal defense: 10%
- Work done + documentation: 70%
- Final viva (external examiner): 20%

## Other ideas considered
- Kathmandu Bus Route Finder (Dijkstra / A*)
- College Placement Portal (TF-IDF + cosine similarity)
- Expense Splitter (greedy debt minimisation)
- Clinic Appointment & Queue System
- Real-time Classroom Chat (sockets)