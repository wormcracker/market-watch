import { getSettings } from "./settings";
import { fetchFromMarketStatusAPI } from "./fetchers";
import { logger } from "@shared/logger";
import { systemEvents } from "@shared/events";

export type MarketState = { isOpen: boolean | null; checkedToday: boolean };

let marketState: MarketState = { isOpen: null, checkedToday: false };

export function getMarketState(): MarketState { return marketState; }
export function setMarketState(update: Partial<MarketState>) { marketState = { ...marketState, ...update }; }
export function resetMarketState() { marketState = { isOpen: false, checkedToday: false }; }

export async function refreshMarketState(): Promise<void> {
  if (!getSettings().status_check) { setMarketState({ isOpen: null }); return; }
  try {
    const status = await fetchFromMarketStatusAPI();
    const previous = marketState.isOpen;
    setMarketState({ isOpen: status.isOpen, checkedToday: true });
    if (previous !== status.isOpen) {
      logger.info("nepse:market-state", `Changed: ${previous} → ${status.isOpen}`);
      systemEvents.emit("nepse:status", { isOpen: status.isOpen });
    }
  } catch (err) {
    logger.error("nepse:market-state", "Refresh failed — keeping last state", err);
  }
}
