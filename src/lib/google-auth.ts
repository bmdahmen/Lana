export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

interface TokenInfoResponse {
  aud: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  exp: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!res.ok) {
    throw new Error("Invalid Google token");
  }
  const data = (await res.json()) as TokenInfoResponse;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || data.aud !== clientId) {
    throw new Error("Token audience mismatch");
  }
  if (Number(data.exp) < Date.now() / 1000) {
    throw new Error("Token expired");
  }
  if (data.email_verified !== "true" && data.email_verified !== true) {
    throw new Error("Google email is not verified");
  }

  return {
    sub: data.sub,
    email: data.email,
    name: data.name ?? null,
    picture: data.picture ?? null,
  };
}
