"use client";

import { Button } from "@/components/ui/button";

import { useLogout } from "../hook/use-auth";

/** Button that logs the current admin out via `useLogout()`. Used in the protected layout's header. */
export const LogoutButton = () => {
  const logoutMutation = useLogout();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={logoutMutation.isPending}
      onClick={() => logoutMutation.mutate()}
    >
      {logoutMutation.isPending ? "Logging out…" : "Log out"}
    </Button>
  );
};
