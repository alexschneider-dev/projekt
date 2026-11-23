"use client";

import { useMutation } from "@tanstack/react-query";


export function useAppMutation<TData, TVariables>({
  mutationFn,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  fn?: { showErrorNotification?: boolean };
}) {
  return useMutation({ mutationFn });
}
