import type { DailyPost, MarkPostedInput, SlotNumber, TeamMember } from "../types";

export interface DataAdapter {
  getMembers(): Promise<TeamMember[]>;
  verifyPin(memberId: string, pin: string): Promise<boolean>;
  getPosts(fromDate: string, toDate: string): Promise<DailyPost[]>;
  markPosted(input: MarkPostedInput): Promise<DailyPost>;
  undoPost(postDate: string, slot: SlotNumber, memberId: string): Promise<DailyPost>;
  subscribe(onChange: () => void): () => void;
}
