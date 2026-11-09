"""Public, read-only shared trips: JSON for the app and a small HTML page for a browser."""

import html
from pathlib import Path
from string import Template

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.i18n import get_lang
from app.models.enums import Lang
from app.schemas.community import SharedTripOut
from app.services.sharing import share_links, shared_trip, trip_by_token

router = APIRouter(tags=["shared"])

TEMPLATE = Template((Path(__file__).parent.parent / "templates" / "shared_trip.html").read_text())

TEXT = {
    Lang.en: {
        "day": "Day {n}",
        "places": "{n} places",
        "days": "{n} days",
        "km": "{km} km",
        "not_planned": "Not planned into days yet.",
        "open": "Open in the Bato app",
        "read_only": "A read-only trip shared from the Bato app. Distances are straight lines.",
    },
    Lang.ne: {
        "day": "दिन {n}",
        "places": "{n} ठाउँ",
        "days": "{n} दिन",
        "km": "{km} कि.मि.",
        "not_planned": "अहिलेसम्म दिनमा बाँडिएको छैन।",
        "open": "बाटो एपमा खोल्नुहोस्",
        "read_only": "बाटो एपबाट सेयर गरिएको यात्रा (हेर्न मात्र)। दूरी सिधा रेखामा छ।",
    },
}


@router.get("/shared/trips/{token}", response_model=SharedTripOut)
def get_shared_trip(
    token: str, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> SharedTripOut:
    """No login. Title, stops and day plan only: no user data."""
    return shared_trip(db, trip_by_token(db, token), lang)


@router.get("/s/{token}", response_class=HTMLResponse, include_in_schema=False)
def shared_trip_page(
    token: str, request: Request, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> HTMLResponse:
    """The same trip as a web page, for people without the app. Every value is HTML-escaped."""
    trip = shared_trip(db, trip_by_token(db, token), lang)
    t, esc = TEXT[lang], html.escape
    names = {s.id: s.place.name for s in trip.stops}
    if trip.days:
        blocks = [
            f'<section class="card day"><h2>{esc(t["day"].format(n=d.day_no))}</h2><ol>'
            + "".join(f"<li>{esc(names[i])}</li>" for i in d.stop_ids)
            + "</ol></section>"
            for d in trip.days
        ]
    else:
        items = "".join(f"<li>{esc(s.place.name)}</li>" for s in trip.stops)
        blocks = [f'<section class="card"><ol>{items}</ol><p class="muted">'
                  f'{esc(t["not_planned"])}</p></section>']  # fmt: skip
    summary = [t["places"].format(n=len(trip.stops))]
    if trip.total_days:
        summary.append(t["days"].format(n=trip.total_days))
    if trip.total_km is not None:
        summary.append(t["km"].format(km=trip.total_km))
    page = TEMPLATE.substitute(
        lang=lang.value,
        title=esc(trip.title),
        summary=esc(" · ".join(summary)),
        days="\n".join(blocks),
        app_url=esc(share_links(request, token).app_url),
        open_in_app=esc(t["open"]),
        read_only=esc(t["read_only"]),
    )
    return HTMLResponse(page, headers={"Cache-Control": "no-store"})
