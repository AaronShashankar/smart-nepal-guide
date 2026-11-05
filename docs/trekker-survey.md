# Trekker survey (Google Form draft)

Purpose: labelled examples for the Phase 2 risk model. Each answer becomes one `training_sample`
row (`source = survey`). Ask about **one completed trek** per response; people can submit again.
Add a consent line at the top: answers are anonymous and used only for a student project.

| # | Question | Type | Maps to |
|---|---|---|---|
| 1 | Which trek did you do? (Poon Hill, ABC, EBC, Langtang, Mardi Himal, Annapurna Circuit, Gosaikunda, Manaslu, Other) | Multiple choice | max_altitude_m, max_daily_gain_m, distance_per_day_km (from our stage data) |
| 2 | How many days did it take you? | Number | total_days |
| 3 | In which month did you start? | Dropdown (Jan–Dec) | month |
| 4 | Your age at the time | Number | age |
| 5 | Your fitness level then | Low / Medium / High | fitness_level |
| 6 | How many multi-day treks had you done before? | None / 1–2 / 3 or more | trek_experience (none / beginner / experienced) |
| 7 | Did you have a heart or lung condition (e.g. asthma)? | Yes / No / Prefer not to say | has_health_issue |
| 8 | Did you take any rest/acclimatisation days? How many? | Number | check against itinerary |
| 9 | Altitude sickness symptoms? | None / Mild (headache) / Strong (had to rest) / Severe (had to descend or be evacuated) | label input |
| 10 | Overall, how hard was it for you? | Easy / Moderate / Hard / Risky (unsafe for me) | **label** |
| 11 | Did you finish the trek as planned? | Yes / Changed plan / Turned back | label input |

Labelling rule (write it in the report): start from Q10; raise to *risky* if Q9 = Severe or Q11 = Turned
back because of health; raise *easy → moderate* if Q9 = Strong.
