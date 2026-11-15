import {
  act,
  renderHook,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


const notifications = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/hooks/common/use-error-notification", () => ({
  useErrorNotification: () => notifications.error,
  useSuccessNotification: () => notifications.success,
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return {
    client,
    wrapper: Wrapper,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("useAppMutation", () => {
  it("wartet vor Callback und Erfolgsmeldung auf dynamische Invalidierungen", async () => {
    const {
      client,
      wrapper,
    } = setup();
    let finish!: () => void;
    const invalidation = new Promise<void>((resolve) => { finish = resolve; });
    const invalidate = vi.spyOn(client, "invalidateQueries").mockReturnValue(invalidation);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAppMutation({
      mutationFn: async (id: number) => ({ id }),
      invalidateKeys: (id) => [[
        "eintrag",
        id,
      ]],
      fn: {
        onSuccess,
        showSuccessNotification: true,
      },
    }), { wrapper });

    await act(async () => {
      const pending = result.current.mutateAsync(7);
      await vi.waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: [
        "eintrag",
        7,
      ] }));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(notifications.success).not.toHaveBeenCalled();
      finish();
      await pending;
    });
    expect(onSuccess).toHaveBeenCalledWith({ id: 7 });
    expect(notifications.success).toHaveBeenCalledOnce();
    expect(notifications.error).not.toHaveBeenCalled();
    client.clear();
  });

  it("unterstützt feste Schlüssel ohne optionale Callbacks", async () => {
    const {
      client,
      wrapper,
    } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    const { result } = renderHook(() => useAppMutation({
      mutationFn: async () => ({ success: true }),
      invalidateKeys: [
        ["stellen"],
        ["suchen"],
      ],
    }), { wrapper });
    await act(async () => { await result.current.mutateAsync(undefined); });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(notifications.success).not.toHaveBeenCalled();
    client.clear();
  });

  it("funktioniert ohne Invalidierungen und mit abgeschalteter Erfolgsmeldung", async () => {
    const {
      client,
      wrapper,
    } = setup();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAppMutation({
      mutationFn: async () => 42,
      fn: {
        onSuccess,
        showSuccessNotification: false,
      },
    }), { wrapper });
    await act(async () => { await result.current.mutateAsync(undefined); });
    expect(onSuccess).toHaveBeenCalledWith(42);
    expect(notifications.success).not.toHaveBeenCalled();
    client.clear();
  });

  it("meldet API-Fehler und übergibt Fehlerdetails an den Callback", async () => {
    const {
      client,
      wrapper,
    } = setup();
    const definition = ERROR_JOBS.INVALID_SEARCH_URL;
    const error = new ApiError(definition.status, definition.code, definition.message, { field: "url" });
    const onError = vi.fn();
    const { result } = renderHook(() => useAppMutation<never, void, { field: string }>({
      mutationFn: async () => { throw error; },
      fn: { onError },
    }), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(undefined)).rejects.toBe(error); });
    expect(notifications.error).toHaveBeenCalledWith(error.message);
    expect(onError).toHaveBeenCalledWith(error);
    expect(notifications.success).not.toHaveBeenCalled();
    client.clear();
  });

  it("kann Fehlermeldungen abschalten, ohne den API-Callback zu unterdrücken", async () => {
    const {
      client,
      wrapper,
    } = setup();
    const definition = ERROR_JOBS.SAVE_FAILED;
    const error = new ApiError(definition.status, definition.code, definition.message);
    const onError = vi.fn();
    const { result } = renderHook(() => useAppMutation({
      mutationFn: async () => { throw error; },
      fn: {
        onError,
        showErrorNotification: false,
      },
    }), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(undefined)).rejects.toBe(error); });
    expect(notifications.error).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    client.clear();
  });

  it("zeigt allgemeine Fehler an, ruft dafür aber keinen API-Callback auf", async () => {
    const {
      client,
      wrapper,
    } = setup();
    const error = new Error(ERROR_JOBS.SAVE_FAILED.message);
    const onError = vi.fn();
    const { result } = renderHook(() => useAppMutation({
      mutationFn: async () => { throw error; },
      fn: { onError },
    }), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(undefined)).rejects.toBe(error); });
    expect(notifications.error).toHaveBeenCalledWith(error.message);
    expect(onError).not.toHaveBeenCalled();
    client.clear();
  });
});
