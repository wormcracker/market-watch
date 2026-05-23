const BASE = "/api/proxy";

export async function apiFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
  },
): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: options?.method ?? "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null as T;
    }

    if (res.status >= 500) {
      throw new Error("Server error");
    }

    throw new Error(`HTTP error ${res.status}`);
  }

  const json = await res.json();

  return json.data;
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body });
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body });
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
