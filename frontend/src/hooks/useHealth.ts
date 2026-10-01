import { useEffect, useState } from "react";
import { getHealth } from "../services/api";

export function useHealth() {
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => {
        if (!cancelled) setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
