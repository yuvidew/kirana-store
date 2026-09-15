import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";

import { login, logout } from "../api";

/**
 * Extracts the `error` field from a failed axios response, falling back to
 * a generic message when the response body doesn't have one.
 * @param error - The unknown value caught from a rejected mutation/query.
 * @param fallback - Message to show when the error has no usable `error` field.
 */
export const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback;

/**
 * Mutation hook for logging in. Calls POST /api/auth/login and, on success,
 * toasts and redirects to /dashboard (the server has already set the
 * session cookie). On failure, toasts the error — the login form also
 * shows it inline next to the fields, per the PRD's login requirements.
 */
export const useLogin = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: login,
    mutationKey: ["login"],
    onSuccess: () => {
      toast.add({ title: "Logged in", description: "Welcome back!", type: "success" });
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't log in",
        description: getErrorMessage(error, "Invalid email or password"),
        type: "error",
      });
    },
  });
};

/**
 * Mutation hook for logging out. Calls POST /api/auth/logout, clears the
 * TanStack Query cache (so no stale admin data survives into the next
 * session), and redirects to /login.
 */
export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    mutationKey: ["logout"],
    onSuccess: () => {
      queryClient.clear();
      toast.add({ title: "Logged out", description: "You've been signed out.", type: "success" });
      router.push("/login");
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't log out",
        description: getErrorMessage(error, "Something went wrong logging out. Please try again."),
        type: "error",
      });
    },
  });
};
