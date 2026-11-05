import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

/**
 * "Continue with Google": the phone signs in with Google and gets an ID token;
 * the backend (/auth/google) verifies it and returns our own JWT.
 * Needs the OAuth *web* client ID (the backend checks the token's audience).
 */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleConfigured = !!webClientId;

if (webClientId) {
  GoogleSignin.configure({ webClientId });
}

/** Returns the Google ID token, or null if the user cancelled. */
export async function getGoogleIdToken(): Promise<string | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  return response.data.idToken;
}

export async function googleSignOut() {
  if (googleConfigured) await GoogleSignin.signOut().catch(() => undefined);
}
