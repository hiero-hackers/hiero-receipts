/**
 * Plain-language summary of a receipt — the human wording, in one place, so
 * the text and HTML renderers stay consistent. No jargon: "You sent 250 ℏ to
 * 0.0.8891", not "direction: out, counterparty: 0.0.8891".
 */
import type { FiatValue, Receipt } from "./receipt.js";
import { render, renderHbar } from "./money.js";

export interface ReceiptSummary {
  /** One plain sentence per thing that happened (the first is the headline). */
  readonly events: string[];
  /** Supporting detail rows (fee, value, date, note). */
  readonly details: { label: string; value: string }[];
  /** Present only when the transaction failed. */
  readonly statusNote?: string;
  /** Whether the data was proven, in plain words. */
  readonly provenance: string;
}

export interface SummaryOptions {
  /** Token id → decimal places, for readable token amounts. */
  readonly decimals?: Map<string, number>;
}

export function summarize(receipt: Receipt, opts: SummaryOptions = {}): ReceiptSummary {
  const decimals = opts.decimals ?? new Map<string, number>();
  const events: string[] = [];

  // The transferred-HBAR value is attached to the one line it describes, so
  // it is never mistaken for the total-including-fee. Claim it once.
  let hbarValue: FiatValue | undefined = receipt.fiat;
  const take = (): string => {
    const s = fiatSuffix(hbarValue);
    hbarValue = undefined;
    return s;
  };

  const staking = receipt.stakingRewardTinybar ?? 0n;
  const hbar = receipt.movements.find((m) => m.kind === "hbar")?.amount ?? 0n;
  const regular = hbar - staking; // the non-reward part of the HBAR movement

  if (staking > 0n) {
    // If the reward is the only HBAR movement, its value sits on this line.
    const value = regular === 0n ? take() : "";
    events.push(`You earned a staking reward of ${renderHbar(staking).trim()}${value}`);
  }
  if (regular < 0n) {
    const sent = -regular - receipt.feeTinybar; // amount transferred, fee excluded
    if (sent > 0n) events.push(`You sent ${renderHbar(sent).trim()}${take()}${to(receipt.counterparty)}`);
  } else if (regular > 0n) {
    events.push(`You received ${renderHbar(regular).trim()}${take()}${from(receipt.counterparty)}`);
  }

  for (const m of receipt.movements) {
    if (m.kind !== "token") continue;
    const abs = m.amount < 0n ? -m.amount : m.amount;
    const amount = render(abs, decimals.get(m.asset) ?? 0, ` ${m.asset}`).trim();
    events.push(m.amount < 0n ? `You sent ${amount}${to(receipt.counterparty)}` : `You received ${amount}${from(receipt.counterparty)}`);
  }

  for (const n of receipt.nft ?? []) {
    const which = `${n.tokenId} #${n.serial}`;
    events.push(n.direction === "in" ? `You received an NFT (${which})` : `You sent an NFT (${which})`);
  }

  if (events.length === 0) events.push("No change to your balance");

  const details: { label: string; value: string }[] = [];
  if (receipt.feeTinybar > 0n) {
    details.push({ label: "Network fee", value: `${renderHbar(receipt.feeTinybar).trim()}${fiatSuffix(receipt.feeFiat)}` });
  }
  details.push({ label: "Date", value: formatTimestamp(receipt.consensusTimestamp) });
  if (receipt.memo) details.push({ label: "Memo", value: receipt.memo });

  return {
    events,
    details,
    provenance:
      receipt.provenance.kind === "verified"
        ? `Cryptographically verified against the ledger (block ${receipt.provenance.block}).`
        : `From the mirror node — not independently verified.`,
    ...(receipt.status === "failed"
      ? { statusNote: "This transaction failed — no transfer took place (a network fee may still apply)." }
      : {}),
  };
}

const to = (party?: string): string => (party ? ` to ${party}` : "");
const from = (party?: string): string => (party ? ` from ${party}` : "");

/** An inline fiat suffix, e.g. " (≈ 12.83 USD)" or " (< 0.01 USD)". */
function fiatSuffix(fiat?: FiatValue): string {
  if (!fiat) return "";
  const abs = fiat.amount < 0n ? -fiat.amount : fiat.amount;
  const text = abs === 0n ? `< 0.01 ${fiat.currency}` : `≈ ${render(abs, 2, ` ${fiat.currency}`)}`;
  return ` (${text})`;
}

/** A Hedera consensus timestamp ("seconds.nanos") as a readable UTC date. */
export function formatTimestamp(consensusTimestamp: string): string {
  const seconds = Number(consensusTimestamp.split(".")[0]);
  if (!Number.isFinite(seconds)) return consensusTimestamp;
  const date = new Date(seconds * 1000);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${fmt.format(date)} UTC`;
}
