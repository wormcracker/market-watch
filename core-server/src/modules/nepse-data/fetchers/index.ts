import { fetchFromSourceA } from "./source-a.fetcher";
import { fetchFromSourceB } from "./source-b.fetcher";
import { fetchFromMarketStatusAPI } from "./market-status.fetcher";

export class FetcherError extends Error {
  constructor(message: string, public readonly cause: unknown, public readonly isRecoverable: boolean) {
    super(message);
    this.name = "FetcherError";
  }
}

export { fetchFromMarketStatusAPI, fetchFromSourceA, fetchFromSourceB };
