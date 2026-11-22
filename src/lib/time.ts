import type { SlotNumber, SlotStatus } from "./types";

export const PKT_TIMEZONE = "Asia/Karachi";

export const SLOT_NUMBERS: readonly SlotNumber[] = [1, 2, 3];

export const SLOT_META: Record<SlotNumber, { label: string; timeRange: string }> = {
  1: {
    label: "Afternoon Student Break",
    timeRange: "14:30 – 15:30 PKT",
  },
  2: {
    label: "Prime Evening (Local + UK)",
    timeRange: "19:30 – 20:30 PKT",
  },
  3: {
    label: "Late Night Viral Slot (US Tier-1)",
    timeRange: "23:30 – 00:30 PKT",
  },
};

const pktDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PKT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pktTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const pktWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIMEZONE,
  weekday: "short",
});

const pktDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIMEZONE,
  day: "numeric",
});

const pktMonthShortFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIMEZONE,
  month: "short",
});

const pktYearFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIMEZONE,
  year: "numeric",
});

const pktMonthLongFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIMEZONE,
  month: "long",
  year: "numeric",
});

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [yStr, mStr, dStr] = dateStr.split("-");
  return {
    year: Number(yStr),
    month: Number(mStr),
    day: Number(dStr),
  };
}

function formatUtcCalendarDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getPktDateString(date: Date = new Date()): string {
  const parts = pktDatePartsFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getPktMonthString(date: Date = new Date()): string {
  return getPktDateString(date).slice(0, 7);
}

export function addDays(dateStr: string, n: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const shifted = new Date(Date.UTC(year, month - 1, day + n));
  return formatUtcCalendarDate(shifted);
}

export function addMonths(yyyyMm: string, n: number): string {
  const [yStr, mStr] = yyyyMm.split("-");
  const shifted = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + n, 1));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthRange(yyyyMm: string): {
  fromDate: string;
  toDate: string;
  days: string[];
} {
  const [yStr, mStr] = yyyyMm.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: string[] = [];

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(`${yStr}-${mStr}-${String(day).padStart(2, "0")}`);
  }

  return {
    fromDate: days[0],
    toDate: days[days.length - 1],
    days,
  };
}

export function slotWindow(dateStr: string, slot: SlotNumber): { start: Date; end: Date } {
  if (slot === 1) {
    return {
      start: new Date(`${dateStr}T14:30:00+05:00`),
      end: new Date(`${dateStr}T15:30:00+05:00`),
    };
  }
  if (slot === 2) {
    return {
      start: new Date(`${dateStr}T19:30:00+05:00`),
      end: new Date(`${dateStr}T20:30:00+05:00`),
    };
  }
  const nextDay = addDays(dateStr, 1);
  return {
    start: new Date(`${dateStr}T23:30:00+05:00`),
    end: new Date(`${nextDay}T00:30:00+05:00`),
  };
}

export function getSlotStatus(
  dateStr: string,
  slot: SlotNumber,
  posted: boolean,
  now: Date
): SlotStatus {
  if (posted) {
    return "posted";
  }

  const todayPkt = getPktDateString(now);
  if (dateStr > todayPkt) {
    return "future";
  }

  const { start, end } = slotWindow(dateStr, slot);
  const nowMs = now.getTime();

  if (nowMs < start.getTime()) {
    return "upcoming";
  }
  if (nowMs <= end.getTime()) {
    return "open";
  }
  return "missed";
}

export function formatPktTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return pktTimeFormatter.format(parsed);
}

export function formatPktDateLong(dateStr: string): string {
  const anchor = new Date(`${dateStr}T12:00:00+05:00`);
  const weekday = pktWeekdayFormatter.format(anchor);
  const day = pktDayFormatter.format(anchor);
  const month = pktMonthShortFormatter.format(anchor);
  const year = pktYearFormatter.format(anchor);
  return `${weekday}, ${day} ${month} ${year}`;
}

export function formatMonthTitle(yyyyMm: string): string {
  const anchor = new Date(`${yyyyMm}-15T12:00:00+05:00`);
  return pktMonthLongFormatter.format(anchor);
}

export function isLatePost(
  postDate: string,
  slot: SlotNumber,
  postedAt: string | null
): boolean {
  if (!postedAt) {
    return false;
  }
  const postedMs = new Date(postedAt).getTime();
  if (Number.isNaN(postedMs)) {
    return false;
  }
  const { end } = slotWindow(postDate, slot);
  return postedMs > end.getTime();
}
