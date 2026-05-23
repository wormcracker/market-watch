import { Response, Router } from "express";
import { ok as apiOk, fail as apiFail } from "@shared/response";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(apiOk(data));
}

export function fail(res: Response, message: string, status = 500): void {
  res.status(status).json(apiFail(message));
}

export const stockmanagement = Router();
