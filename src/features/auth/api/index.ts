import axios from "axios";

import type { LoginInput, LoginResponse, LogoutResponse } from "../types";

/**
 * Calls POST /api/auth/login with the entered credentials.
 * @param input - The submitted email, password, and remember-me flag.
 */
export const login = async (input: LoginInput) => {
  const { data } = await axios.post<LoginResponse>("/api/auth/login", input);
  return data;
};

/** Calls POST /api/auth/logout to clear the current session. */
export const logout = async () => {
  const { data } = await axios.post<LogoutResponse>("/api/auth/logout");
  return data;
};
