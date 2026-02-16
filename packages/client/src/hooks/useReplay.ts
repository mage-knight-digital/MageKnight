import { useContext } from "react";
import { ReplayContext, type ReplayContextValue } from "../context/ReplayContext";

/** Returns replay context if in replay mode, null otherwise. Safe to call anywhere. */
export function useReplay(): ReplayContextValue | null {
  return useContext(ReplayContext);
}
