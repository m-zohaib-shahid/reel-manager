export type SlotNumber = 1 | 2 | 3;

export type SlotStatus = "posted" | "open" | "upcoming" | "missed" | "future";

export interface TeamMember {
  id: string;
  name: string;
  avatarColor: string;
}

export interface DailyPost {
  id: string;
  postDate: string; // YYYY-MM-DD (PKT)
  slot: SlotNumber;
  posted: boolean;
  postedBy: string | null; // TeamMember.id
  postedAt: string | null; // ISO timestamp
  reelUrl: string | null;
  captionRef: string | null;
}

export interface MarkPostedInput {
  postDate: string;
  slot: SlotNumber;
  memberId: string;
  reelUrl: string | null;
  captionRef: string | null;
}
