// @vitest-environment node
import { runInNewContext } from "node:vm";
import {
  expect,
  it,
  vi,
} from "vitest";
import { serviceWorker } from "@/lib/pwa/service-worker";
import { ROUTES } from "@/lib/constants/routes";
import { ERROR_PWA } from "@/lib/http/errors/pwa";


function createWorker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(new Response("Offline")),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([
      "projekt-offline-alt",
      "anderer-cache",
      "projekt-offline-v1",
    ]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue(new Response("Online"));
  const self = {
    location: { origin: "https://projekt.test" },
    addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };
  runInNewContext(serviceWorker, {
    self,
    caches,
    fetch,
    URL,
    Request,
    Response,
  });

  return {
    listeners,
    cache,
    caches,
    fetch,
    self,
  };
}

it("speichert nur die öffentliche Hinweisseite und ihre lokalen Styles ohne Skripte", async () => {
  const worker = createWorker();
  worker.fetch.mockResolvedValue(new Response(
    '<link rel="stylesheet" href="/_next/static/offline.css">' +
    '<link rel="stylesheet" href="https://extern.test/style.css">' +
    '<h1>Keine Verbindung</h1><script>privateHydration()</script>'
  ));
  let pending: Promise<void> | undefined;
  worker.listeners.get("install")!({ waitUntil: (value: Promise<void>) => { pending = value; } });
  await pending;

  expect(worker.fetch).toHaveBeenCalledWith(ROUTES.offline, { cache: "reload" });
  const requests = worker.cache.addAll.mock.calls[0]![0] as Request[];
  expect(requests.map((request) => request.url)).toEqual(["https://projekt.test/_next/static/offline.css"]);
  const [
    path,
    response,
  ] = worker.cache.put.mock.calls[0]! as [
    string,
    Response,
  ];
  expect(path).toBe(ROUTES.offline);
  expect(await response.text()).not.toContain("<script");
});

it("liefert bei Netzwerkausfall die Hinweisseite und speichert keine aufgerufenen Seiten", async () => {
  const worker = createWorker();
  worker.fetch.mockRejectedValue(new Error(ERROR_PWA.REGISTRATION_FAILED.message));
  let pending: Promise<Response> | undefined;
  worker.listeners.get("fetch")!({
    request: {
      url: `https://projekt.test${ROUTES.dashboard}`,
      method: "GET",
      mode: "navigate",
    },
    respondWith: (value: Promise<Response>) => { pending = value; },
  });

  expect(await (await pending)!.text()).toBe("Offline");
  expect(worker.cache.put).not.toHaveBeenCalled();
});

it("lässt API-Anfragen, POST und fremde Ursprünge unverändert durch", () => {
  const worker = createWorker();
  const respondWith = vi.fn();
  for (const request of [
    {
      url: `https://projekt.test${ROUTES.authSession}`,
      method: "GET",
      mode: "navigate",
    },
    {
      url: `https://projekt.test${ROUTES.login}`,
      method: "POST",
      mode: "navigate",
    },
    {
      url: "https://extern.test/",
      method: "GET",
      mode: "navigate",
    },
  ]) {
    worker.listeners.get("fetch")!({
      request,
      respondWith,
    });
  }

  expect(respondWith).not.toHaveBeenCalled();
  expect(worker.fetch).not.toHaveBeenCalled();
});

it("entfernt bei Aktivierung ausschließlich alte eigene Caches", async () => {
  const worker = createWorker();
  let pending: Promise<void> | undefined;
  worker.listeners.get("activate")!({ waitUntil: (value: Promise<void>) => { pending = value; } });
  await pending;

  expect(worker.caches.delete.mock.calls).toEqual([["projekt-offline-alt"]]);
  expect(worker.self.clients.claim).toHaveBeenCalled();
});
