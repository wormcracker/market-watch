import { getSettings } from "../settings";
import { SchedulerSlot, SchedulerSubSlot, WeekDay } from "../settings/defaults";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: "${time}"`);
  }
  return hours * 60 + minutes;
}

export function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function getCurrentDay(): number {
  const now = new Date();
  return now.getDay();
}

export function isInsideMarketWindow(): boolean {
  return getActiveSchedulerSlot() !== null;
}

export function getActiveSchedulerSlot(): SchedulerSlot | null {
  const schedulers: SchedulerSlot[] = getSettings().scheduler;

  const currentMinutes = getCurrentMinutes();
  const currentDay = getCurrentDay();

  const active = schedulers.find((scheduler) => {
    const marketDays = scheduler.market_days;
    const marketStart = timeToMinutes(scheduler.market_start);
    const marketEnd = timeToMinutes(scheduler.market_end);

    const dayMatch = marketDays.includes(currentDay as WeekDay);
    const timeMatch =
      currentMinutes >= marketStart && currentMinutes < marketEnd;

    return dayMatch && timeMatch;
  });
  return active ?? null;
}

export function getActiveSubSlot(): SchedulerSubSlot | null {
  const schedulerSubSlot: SchedulerSubSlot[] =
    getSettings().scheduler_sub_slots;

  const currentMinutes = getCurrentMinutes();

  const active = schedulerSubSlot.find((scheduler) => {
    const start = timeToMinutes(scheduler.start);
    const end = timeToMinutes(scheduler.end);

    const timeMatch = currentMinutes >= start && currentMinutes < end;

    return timeMatch;
  });
  return active ?? null;
}
