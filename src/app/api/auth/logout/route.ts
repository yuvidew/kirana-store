import { NextResponse } from "next/server";

import { deleteSession } from "@/lib/session";

/** Clears the session cookie, logging the current admin out. */
export const POST = async () => {
  await deleteSession();
  return NextResponse.json({ success: true });
};
