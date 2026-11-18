"use client";

import {
  useErrorNotification,
  useSuccessNotification,
} from "@/hooks/common/use-error-notification";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/http/api-error";


export type SuccessResponseType = {
  success: true;
};

export type PostAppMutationFn<TData = unknown, TDetails = unknown> = {
  onSuccess?: (data: TData) => void;
  onError?: (error: ApiError<TDetails>) => void;
  showErrorNotification?: boolean;
  showSuccessNotification?: boolean;
};

export function useAppMutation<TData, TVariables, TDetails = unknown>({
  mutationFn,
  invalidateKeys,
  fn,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: QueryKey[] | ((variables: TVariables) => QueryKey[]);
  fn?: PostAppMutationFn<TData, TDetails>;
}) {
  const qc = useQueryClient();
  const errorNotification = useErrorNotification();
  const successNotification = useSuccessNotification();
  const showErrorNotification = fn?.showErrorNotification ?? true;
  const showSuccessNotification = fn?.showSuccessNotification ?? false;

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      const keys = typeof invalidateKeys === "function" ? invalidateKeys(variables) : invalidateKeys;
      if (keys) {
        await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
      }

      fn?.onSuccess?.(data);
      if (showSuccessNotification) successNotification();
    },
    onError: (error) => {
      if (showErrorNotification && error instanceof Error) {
        errorNotification(error.message);
      }
      if (error instanceof ApiError) fn?.onError?.(error);
    },
  });
}
