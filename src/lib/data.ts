import { apiAdapter } from "./adapters/api";
import { insforgeAdapter } from "./adapters/insforge";
import { ensureFreshLocalData, localAdapter } from "./adapters/local";
import type { DataAdapter } from "./adapters/types";

const source = import.meta.env.VITE_DATA_SOURCE ?? "local";

export const isLocalDataSource = source !== "api" && source !== "insforge";

export const adapter: DataAdapter =
  source === "insforge"
    ? insforgeAdapter
    : source === "api"
      ? apiAdapter
      : localAdapter;

export function ensureFreshStorage(): void {
  if (isLocalDataSource) {
    ensureFreshLocalData();
  }
}
