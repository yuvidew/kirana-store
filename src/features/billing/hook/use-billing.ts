import { isAxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";

import { createBill } from "../api";

const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback;

/** Mutation hook for generating a bill. Invalidates product stock on success. */
export const useCreateBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBill,
    mutationKey: ["create-bill"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast.add({ title: "Bill generated", description: "The bill was created successfully.", type: "success" });
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't generate bill",
        description: getErrorMessage(error, "Something went wrong generating the bill. Please try again."),
        type: "error",
      });
    },
  });
};
