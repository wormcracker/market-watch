import { ApiResponse } from "./types";

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data, timestamp: new Date().toISOString() };
}

export function fail(error: string): ApiResponse<never> {
  return { ok: false, error, timestamp: new Date().toISOString() };
}
