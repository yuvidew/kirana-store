import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import * as z from "zod";

import { createSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }),
  rememberMe: z.boolean().optional(),
});

// One generic message for both a bad email and a bad password, so the
// response never reveals which field was wrong.
const INVALID_CREDENTIALS_ERROR = "Invalid email or password";

/**
 * Validates admin credentials against `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`
 * and, on success, sets the signed session cookie.
 * @param request - JSON body: `{ email, password, rememberMe? }`.
 */
export const POST = async (request: Request) => {
  const body = await request.json().catch(() => null);
  const validatedFields = LoginSchema.safeParse(body);

  if (!validatedFields.success) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_ERROR }, { status: 401 });
  }

  const { email, password, rememberMe } = validatedFields.data;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminPasswordHash) {
    throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD_HASH is not configured");
  }

  const emailMatches = email.toLowerCase() === adminEmail.toLowerCase();
  // Always run the hash comparison, even if the email already doesn't
  // match, so response timing doesn't leak whether the email was correct.
  const passwordMatches = await compare(password, adminPasswordHash);

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_ERROR }, { status: 401 });
  }

  await createSession(adminEmail, rememberMe ?? false);

  return NextResponse.json({ email: adminEmail });
};
