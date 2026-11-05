"""Verify a Google ID token (OpenID Connect) sent by the mobile app."""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import get_settings


class GoogleAuthError(Exception):
    pass


def verify_google_id_token(token: str) -> dict:
    """Check the signature, expiry, issuer and audience; return the token claims."""
    client_ids = get_settings().google_client_id_list
    if not client_ids:
        raise GoogleAuthError("Google sign-in is not configured on the server")
    try:
        claims = id_token.verify_oauth2_token(token, google_requests.Request(), audience=client_ids)
    except ValueError as exc:
        raise GoogleAuthError(str(exc)) from exc
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleAuthError("Google account has no verified email")
    return claims
