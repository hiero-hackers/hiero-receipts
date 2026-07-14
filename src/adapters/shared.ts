/**
 * Small helpers shared by the source adapters, so the mapping logic they have
 * in common lives in one place.
 */
import type { HbarLeg } from "../normalized.js";
import { toBigInt } from "../money.js";

/** A ledger result string ("SUCCESS", …) → the receipt's status. */
export function statusOf(result: string): "success" | "failed" {
  return result === "SUCCESS" ? "success" : "failed";
}

/** Map raw `{ account, amount }` legs (numbers or strings) into exact `HbarLeg`s. */
export function hbarLegs(legs: readonly { account: string; amount: number | string }[]): HbarLeg[] {
  return legs.map((leg) => ({ account: leg.account, amount: toBigInt(leg.amount) }));
}
