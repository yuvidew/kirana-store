import "server-only";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";
const DEFAULT_SESSION_MS = 24 * 60 * 60 * 1000; // 1 day
const REMEMBER_ME_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Read once at module load so a missing secret fails fast at boot, not on the first login attempt.
const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is not set");
}
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  email: string;
  expiresAt: string;
};

/**
 * Signs a session payload into a JWT, expiring at `payload.expiresAt`.
 * @param payload - The session data to embed in the token.
 */
export const encrypt = async (payload: SessionPayload) => {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(encodedKey);
};

/**
 * Verifies and decodes a session JWT. Returns null if missing, expired, or tampered with.
 * @param session - The raw JWT string read from the session cookie.
 */
export const decrypt = async (session: string | undefined = "") => {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload & JWTPayload;
  } catch {
    return null;
  }
};

/**
 * Signs a new session and sets it as an HTTP-only cookie on the response.
 * @param email - The authenticated admin's email, stored in the session payload.
 * @param rememberMe - When true, the cookie lives for 30 days instead of 1.
 */
export const createSession = async (email: string, rememberMe: boolean) => {
  const ttl = rememberMe ? REMEMBER_ME_SESSION_MS : DEFAULT_SESSION_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const session = await encrypt({ email, expiresAt: expiresAt.toISOString() });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
};

/** Clears the session cookie, logging the current user out. */
export const deleteSession = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
};

/** Reads the raw session cookie value, if present, without verifying it. */
export const getSessionCookie = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
};
