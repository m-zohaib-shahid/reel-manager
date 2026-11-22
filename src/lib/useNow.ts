import { useEffect, useState } from "react";

export function useNow(intervalMs = 30000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
