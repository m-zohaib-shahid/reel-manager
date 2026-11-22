import {
  SLOT_NUMBERS,
  addDays,
  getPktDateString,
  getPktMonthString,
  monthRange,
  slotWindow,
} from "./time";
import type { DailyPost, SlotNumber, TeamMember } from "./types";

export interface LeaderboardEntry {
  member: TeamMember;
  count: number;
  percentage: number;
}

export interface MonthlyProgressStats {
  posted: number;
  expected: number;
  percentage: number;
}

export function postKey(postDate: string, slot: SlotNumber): string {
  return `${postDate}-${slot}`;
}

export function buildMemberPostMap(
  posts: DailyPost[],
  memberId: string
): Map<string, DailyPost> {
  const map = new Map<string, DailyPost>();
  for (const post of posts) {
    if (post.posted && post.postedBy === memberId) {
      map.set(postKey(post.postDate, post.slot), post);
    }
  }
  return map;
}

/**
 * Counts how many days in `monthStr` have been fully completed (all 3 slots posted)
 * by ALL team members. When every member completes 3/3 slots on a date, that date adds 1.
 */
export function countMonthTeamCompletedDays(
  posts: DailyPost[],
  members: TeamMember[],
  monthStr: string
): number {
  if (members.length === 0) {
    return 0;
  }

  const memberIds = new Set(members.map((m) => m.id));
  const byDateAndMember = new Map<string, Map<string, Set<SlotNumber>>>();

  for (const post of posts) {
    if (
      !post.posted ||
      !post.postedBy ||
      !memberIds.has(post.postedBy) ||
      !post.postDate.startsWith(`${monthStr}-`)
    ) {
      continue;
    }

    let memberMap = byDateAndMember.get(post.postDate);
    if (!memberMap) {
      memberMap = new Map<string, Set<SlotNumber>>();
      byDateAndMember.set(post.postDate, memberMap);
    }

    let slots = memberMap.get(post.postedBy);
    if (!slots) {
      slots = new Set<SlotNumber>();
      memberMap.set(post.postedBy, slots);
    }
    slots.add(post.slot);
  }

  let completedDays = 0;
  for (const memberMap of byDateAndMember.values()) {
    const allMembersComplete = members.every((member) => {
      const slots = memberMap.get(member.id);
      if (!slots) {
        return false;
      }
      return SLOT_NUMBERS.every((slot) => slots.has(slot));
    });
    if (allMembersComplete) {
      completedDays += 1;
    }
  }

  return completedDays;
}

export function countTodayCompleted(
  memberPostMap: Map<string, DailyPost>,
  todayStr: string
): number {
  let count = 0;
  for (const slot of SLOT_NUMBERS) {
    if (memberPostMap.get(postKey(todayStr, slot))?.posted) {
      count += 1;
    }
  }
  return count;
}

export function calculateDailyStreak(
  memberPostMap: Map<string, DailyPost>,
  now: Date,
  lookbackDays = 60
): number {
  const todayStr = getPktDateString(now);

  const isDayComplete = (dateStr: string): boolean => {
    return SLOT_NUMBERS.every((slot) => Boolean(memberPostMap.get(postKey(dateStr, slot))?.posted));
  };

  let cursor = isDayComplete(todayStr) ? todayStr : addDays(todayStr, -1);
  let streak = 0;

  for (let i = 0; i < lookbackDays; i += 1) {
    if (!isDayComplete(cursor)) {
      break;
    }
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function computeLeaderboard(
  members: TeamMember[],
  posts: DailyPost[],
  monthStr: string
): LeaderboardEntry[] {
  const counts = new Map<string, number>();
  for (const member of members) {
    counts.set(member.id, 0);
  }

  let totalPosted = 0;
  for (const post of posts) {
    if (post.posted && post.postDate.startsWith(`${monthStr}-`) && post.postedBy) {
      totalPosted += 1;
      counts.set(post.postedBy, (counts.get(post.postedBy) ?? 0) + 1);
    }
  }

  return [...members]
    .map((member) => {
      const count = counts.get(member.id) ?? 0;
      const percentage = totalPosted > 0 ? Math.round((count / totalPosted) * 100) : 0;
      return { member, count, percentage };
    })
    .sort((a, b) => b.count - a.count || a.member.name.localeCompare(b.member.name));
}

export function computeMonthlyProgress(
  memberPostMap: Map<string, DailyPost>,
  now: Date
): MonthlyProgressStats {
  const currentMonth = getPktMonthString(now);
  const { days } = monthRange(currentMonth);
  const nowMs = now.getTime();

  let posted = 0;
  let expected = 0;

  for (const dateStr of days) {
    for (const slot of SLOT_NUMBERS) {
      const isPosted = Boolean(memberPostMap.get(postKey(dateStr, slot))?.posted);
      if (isPosted) {
        posted += 1;
      }
      const { end } = slotWindow(dateStr, slot);
      if (nowMs > end.getTime() || isPosted) {
        expected += 1;
      }
    }
  }

  const percentage = expected > 0 ? Math.min(100, Math.round((posted / expected) * 100)) : 0;
  return { posted, expected, percentage };
}
