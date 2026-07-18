/**
 * Plain-language summary of a receipt — assembled here, worded by a
 * {@link Messages} catalog (English built-in, other locales via
 * `SummaryOptions.messages`), so the text and HTML renderers stay
 * consistent. No jargon: "You sent 250 ℏ to 0.0.8891", not
 * "direction: out, counterparty: 0.0.8891".
 */
import type { FiatValue, Receipt } from "./receipt.js";
import { HBAR_DECIMALS, renderLocalized } from "./money.js";
import { en, type Messages } from "./messages.js";

export interface ReceiptSummary {
  /** One plain sentence per thing that happened (the first is the headline). */
  readonly events: string[];
  /** Supporting detail rows (fee, value, date, note). */
  readonly details: { label: string; value: string }[];
  /** Present only when the transaction failed. */
  readonly statusNote?: string;
  /**
   * Present when the sender's note looks actionable (contains a link or
   * domain) under the `"warn"` memo policy — a caution the renderers must
   * display beside the note.
   */
  readonly memoWarning?: string;
  /** Whether the data was proven, in plain words. */
  readonly provenance: string;
}

export interface SummaryOptions {
  /** Token id → decimal places, for readable token amounts. */
  readonly decimals?: Map<string, number>;
  /**
   * Token id → display symbol, e.g. `"0.0.4444" → "USDC"`, rendering
   * `500.00 USDC (0.0.4444)`. The id always stays visible: symbols are
   * chosen by token creators and are neither unique nor trustworthy — the
   * id is the receipt's honest part. Symbols are sanitized like memos.
   */
  readonly symbols?: Map<string, string>;
  /**
   * How to treat the sender-written memo — the one part of a receipt the
   * counterparty authors ("claim your reward at …" dust memos are a
   * documented scam pattern precisely because explorers render them):
   *
   * - `"warn"` (default): show it, defang URL-shaped content, and attach a
   *   caution when it looks actionable.
   * - `"show"`: show it untouched (control characters still collapsed) —
   *   for contexts where the sender is trusted.
   * - `"hide"`: omit it entirely — e.g. automated statements to customers.
   */
  readonly memo?: "warn" | "show" | "hide";
  /**
   * The wording — a {@link Messages} catalog. Bundled locales live behind
   * subpath imports (`@hiero-hackers/hiero-receipts/locales/de`); spread one
   * and override entries to customize single sentences. Default: English.
   */
  readonly messages?: Messages;
  /**
   * BCP-47 locale for dates and the decimal separator (digits stay ASCII
   * and exact). Defaults to the message catalog's own locale — `"en-GB"`
   * for the built-in English.
   */
  readonly locale?: string;
  /**
   * IANA time zone for dates (default `"UTC"`). The default renders with a
   * ` UTC` suffix; a custom zone renders with its own short name (`GMT+1`,
   * `PDT`, …) so the reader always knows which clock the date is on.
   */
  readonly timeZone?: string;
}

export function summarize(receipt: Receipt, opts: SummaryOptions = {}): ReceiptSummary {
  const decimals = opts.decimals ?? new Map<string, number>();
  const msgs = opts.messages ?? en;
  const locale = opts.locale ?? msgs.locale;
  const hbarAmount = (tinybar: bigint): string =>
    renderLocalized(tinybar, HBAR_DECIMALS, locale, " ℏ").trim();
  const events: string[] = [];

  // The transferred-HBAR value is attached to the one line it describes, so
  // it is never mistaken for the total-including-fee. Claim it once.
  let hbarValue: FiatValue | undefined = receipt.fiat;
  const take = (): string => {
    const s = fiatSuffix(hbarValue, msgs, locale);
    hbarValue = undefined;
    return s;
  };

  const staking = receipt.stakingRewardTinybar ?? 0n;
  const hbar = receipt.movements.find((m) => m.kind === "hbar")?.amount ?? 0n;
  const regular = hbar - staking; // the non-reward part of the HBAR movement

  if (staking > 0n) {
    // If the reward is the only HBAR movement, its value sits on this line.
    const value = regular === 0n ? take() : "";
    events.push(msgs.earnedStakingReward(hbarAmount(staking), value));
  }
  if (regular < 0n) {
    const sent = -regular - receipt.feeTinybar; // amount transferred, fee excluded
    if (sent > 0n) events.push(msgs.sentHbar(hbarAmount(sent), take(), receipt.counterparty));
  } else if (regular > 0n) {
    events.push(msgs.receivedHbar(hbarAmount(regular), take(), receipt.counterparty));
  }

  for (const m of receipt.movements) {
    if (m.kind !== "token") continue;
    const abs = m.amount < 0n ? -m.amount : m.amount;
    const amount = renderLocalized(
      abs,
      decimals.get(m.asset) ?? 0,
      locale,
      ` ${tokenLabel(m.asset, opts)}`,
    ).trim();
    events.push(
      m.amount < 0n
        ? msgs.sentToken(amount, receipt.counterparty)
        : msgs.receivedToken(amount, receipt.counterparty),
    );
  }

  for (const n of receipt.nft ?? []) {
    const which = `${tokenLabel(n.tokenId, opts, " ")} #${n.serial}`;
    events.push(
      n.direction === "in"
        ? msgs.receivedNft(which, receipt.counterparty)
        : msgs.sentNft(which, receipt.counterparty),
    );
  }

  // Nothing moved for this account. If it initiated the transaction, say
  // what it *did* — a contract call or an allowance is not "no change" to a
  // human. A mere bystander keeps the neutral wording.
  if (events.length === 0) {
    const headline =
      receipt.payer === receipt.account
        ? msgs.headlines[receipt.txType.replace(/[^a-z]/gi, "").toUpperCase()]
        : undefined;
    events.push(headline ?? msgs.noChange);
  }

  const details: { label: string; value: string }[] = [];
  if (receipt.feeTinybar > 0n) {
    details.push({
      label: msgs.networkFeeLabel,
      value: `${hbarAmount(receipt.feeTinybar)}${fiatSuffix(receipt.feeFiat, msgs, locale)}`,
    });
  }
  details.push({
    label: msgs.dateLabel,
    value: formatTimestamp(receipt.consensusTimestamp, {
      locale,
      ...(opts.timeZone !== undefined ? { timeZone: opts.timeZone } : {}),
    }),
  });
  // The ledger reference — what a reader quotes to look the transaction up
  // in an explorer, or to dispute it.
  details.push({ label: msgs.transactionLabel, value: receipt.transactionId });

  // The memo is the counterparty's voice, not the receipt's: label it as
  // such, and under the default policy break any one-tap path to a link.
  const memoPolicy = opts.memo ?? "warn";
  let memoWarning: string | undefined;
  if (receipt.memo && memoPolicy !== "hide") {
    const note = sanitizeInline(receipt.memo);
    const actionable = memoPolicy === "warn" && URL_LIKE.test(note);
    details.push({ label: msgs.senderNoteLabel, value: actionable ? defangUrls(note) : note });
    if (actionable) memoWarning = msgs.memoWarning;
  }

  const p = receipt.provenance;
  return {
    events,
    details,
    ...(memoWarning !== undefined ? { memoWarning } : {}),
    provenance:
      p.kind === "verified"
        ? msgs.provenanceVerified(p.block, p.network)
        : p.source === "mirror"
          ? msgs.provenanceMirror(p.network)
          : msgs.provenanceStream(p.network),
    ...(receipt.status === "failed" ? { statusNote: msgs.statusFailed } : {}),
  };
}

/**
 * A token's display label: `USDC (0.0.4444)` when the caller supplied a
 * symbol, else the bare id. `separator` swaps the parenthesized form for
 * `USDC 0.0.4444` where the caller is already inside parentheses (NFTs).
 */
function tokenLabel(tokenId: string, opts: SummaryOptions, separator?: string): string {
  const symbol = opts.symbols?.get(tokenId);
  if (!symbol) return tokenId;
  const clean = sanitizeInline(symbol);
  if (!clean) return tokenId;
  return separator !== undefined ? `${clean}${separator}${tokenId}` : `${clean} (${tokenId})`;
}

/**
 * On-ledger memos are ≤ 100 bytes; anything longer did not come from the
 * ledger. The cap also bounds every regex that later scans the note.
 */
const MAX_NOTE_LENGTH = 512;

/**
 * Collapse control characters (newlines, tabs, C0/C1) to single spaces.
 * The memo is attacker-writable — anyone can send a transaction to any
 * account — and an embedded newline would let a memo forge extra lines in
 * the plain-text receipt ("You received 999 ℏ …"). A receipt's entire job
 * is to be trustworthy, so free-text from the ledger renders inline, always.
 */
const sanitizeInline = (s: string): string => {
  const bounded = s.length > MAX_NOTE_LENGTH ? `${s.slice(0, MAX_NOTE_LENGTH)}…` : s;
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  return bounded.replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ").trim();
};

/**
 * Does the note contain something actionable — a URL or a bare domain?
 * Deliberately loose: a false positive only attaches a caution that is true
 * of every sender-written note, while a miss hands a phishing link the
 * receipt's credibility. The TLD width goes to 24 because crypto scams
 * favor exactly the long ones (`.network`, `.finance`, `.capital`) and the
 * longest real TLDs are under that.
 */
const URL_LIKE = /https?:\/\/|www\.|\b[a-z0-9-]{2,}\.[a-z]{2,24}(?:\/|\b)/i;

/**
 * Defang URL-shaped substrings — `https://evil.site` → `hxxps://evil[.]site`
 * — because mail clients auto-linkify URL shapes even in plain text. The
 * visible mangling is the point: a reader can still retype the address
 * deliberately, but there is no one-tap path, and the mangling itself
 * signals quarantined content.
 */
const defangUrls = (s: string): string =>
  // eslint-disable-next-line security/detect-unsafe-regex -- input is capped at MAX_NOTE_LENGTH by sanitizeInline, bounding the worst-case scan
  s.replace(/(?:https?:\/\/|www\.)\S*|\b[a-z0-9-]{2,}\.[a-z]{2,24}(?:\/\S*)?/gi, (url) =>
    url.replace(/\./g, "[.]").replace(/^(https?)/i, (scheme) => scheme.replace(/t/gi, "x")),
  );

/** An inline fiat suffix, e.g. " (≈ 12.83 USD)" or " (< 0.01 USD)". */
function fiatSuffix(fiat: FiatValue | undefined, msgs: Messages, locale: string): string {
  if (!fiat) return "";
  const abs = fiat.amount < 0n ? -fiat.amount : fiat.amount;
  const text =
    abs === 0n
      ? msgs.fiatUnderOneCent(fiat.currency)
      : msgs.fiatApprox(renderLocalized(abs, 2, locale), fiat.currency);
  return ` (${text})`;
}

export interface TimestampOptions {
  /** BCP-47 locale (default `"en-GB"`). */
  readonly locale?: string;
  /** IANA time zone (default `"UTC"`). */
  readonly timeZone?: string;
}

// Formatters are cached per locale+zone — Intl.DateTimeFormat construction is
// expensive relative to formatting, and receipts are often generated in
// batches.
const DATE_FORMATS = new Map<string, Intl.DateTimeFormat>();
function dateFormat(locale: string, timeZone: string): Intl.DateTimeFormat {
  const key = `${locale} ${timeZone}`;
  let format = DATE_FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      // The default UTC rendering keeps its terse trailing " UTC"; any other
      // zone carries its own short name so the clock is never ambiguous.
      ...(timeZone === "UTC" ? {} : { timeZoneName: "short" as const }),
    });
    DATE_FORMATS.set(key, format);
  }
  return format;
}

/**
 * A Hedera consensus timestamp ("seconds.nanos") as a readable date — UTC and
 * `en-GB` by default, or any locale/zone via {@link TimestampOptions}.
 */
export function formatTimestamp(consensusTimestamp: string, opts: TimestampOptions = {}): string {
  const seconds = Number(consensusTimestamp.split(".")[0]);
  if (!Number.isFinite(seconds)) return consensusTimestamp;
  const timeZone = opts.timeZone ?? "UTC";
  const text = dateFormat(opts.locale ?? "en-GB", timeZone).format(new Date(seconds * 1000));
  return timeZone === "UTC" ? `${text} UTC` : text;
}
