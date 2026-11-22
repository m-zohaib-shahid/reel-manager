import { useCallback, useEffect, useState } from "react";
import { adapter } from "./data";
import type { DailyPost } from "./types";

export function usePosts(fromDate: string | null, toDate: string | null) {
  const [posts, setPosts] = useState<DailyPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(
    async (isInitial = false) => {
      if (!fromDate || !toDate) {
        return;
      }
      if (isInitial) {
        setLoading(true);
      }
      try {
        const data = await adapter.getPosts(fromDate, toDate);
        setPosts(data);
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load posts.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate]
  );

  useEffect(() => {
    if (!fromDate || !toDate) {
      return;
    }

    let active = true;

    const load = async (initial: boolean) => {
      if (initial) {
        setLoading(true);
      }
      try {
        const data = await adapter.getPosts(fromDate, toDate);
        if (!active) {
          return;
        }
        setPosts(data);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }
        const msg = err instanceof Error ? err.message : "Failed to load posts.";
        setError(msg);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load(true);

    const unsubscribe = adapter.subscribe(() => {
      if (active) {
        void load(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fromDate, toDate]);

  const refetch = useCallback(() => fetchPosts(false), [fetchPosts]);

  return { posts, loading, error, refetch, setPosts };
}
