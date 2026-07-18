/**
 * The message catalog — every sentence a receipt can say, in one typed
 * interface. `summarize` and the renderers compose no wording of their own;
 * they call these entries with pre-formatted amounts.
 *
 * Entries are FUNCTIONS, not template strings, because languages reorder:
 * German puts the verb last, Spanish attaches the network with `de`, and no
 * `"You sent {x} to {y}"` template survives that. A catalog receives the
 * formatted pieces and owns the whole sentence.
 *
 * To localize: pass a bundled catalog (`import { de } from
 * "@hiero-hackers/hiero-receipts/locales/de"`) or your own object as
 * `SummaryOptions.messages` — spreading a bundled one and overriding entries
 * is the intended way to customize single sentences. The catalog's `locale`
 * also drives date wording and the decimal separator (digits stay ASCII and
 * exact; only the separator localizes) unless `SummaryOptions.locale`
 * overrides it.
 */

export interface Messages {
  /** BCP-47 tag driving dates and the decimal separator for this catalog. */
  readonly locale: string;

  /** `value` is the pre-wrapped fiat suffix (`" (≈ 14.50 USD)"`) or `""`. */
  earnedStakingReward(amount: string, value: string): string;
  sentHbar(amount: string, value: string, counterparty?: string): string;
  receivedHbar(amount: string, value: string, counterparty?: string): string;
  /** `amount` includes the token label, e.g. `"500.00 USDC (0.0.4444)"`. */
  sentToken(amount: string, counterparty?: string): string;
  receivedToken(amount: string, counterparty?: string): string;
  /** `nft` is the label + serial, e.g. `"0.0.9999 #7"`. */
  sentNft(nft: string, counterparty?: string): string;
  receivedNft(nft: string, counterparty?: string): string;
  readonly noChange: string;

  /**
   * Headlines for transactions that moved nothing for the payer, keyed by
   * txType normalized to bare uppercase letters (`CONTRACTCALL`). A missing
   * key falls back to {@link noChange}.
   */
  readonly headlines: Readonly<Partial<Record<string, string>>>;

  readonly networkFeeLabel: string;
  readonly dateLabel: string;
  readonly transactionLabel: string;
  readonly senderNoteLabel: string;
  readonly memoWarning: string;
  readonly statusFailed: string;

  provenanceVerified(block: number, network?: string): string;
  provenanceMirror(network?: string): string;
  provenanceStream(network?: string): string;

  /** Inside-parentheses fiat text, e.g. `"≈ 14.50 USD"`. */
  fiatApprox(amount: string, currency: string): string;
  /** Inside-parentheses under-a-cent text, e.g. `"< 0.01 USD"`. */
  fiatUnderOneCent(currency: string): string;

  /** Text renderer's header line. */
  receiptForAccount(account: string): string;
  /** HTML renderer's who-line (shorter). */
  receiptFor(account: string): string;
  readonly verifiedBadge: string;
  readonly unverifiedBadge: string;
}

const to = (party?: string): string => (party ? ` to ${party}` : "");
const from = (party?: string): string => (party ? ` from ${party}` : "");

/** The built-in English catalog — the library's default wording. */
export const en: Messages = {
  locale: "en-GB",

  earnedStakingReward: (amount, value) => `You earned a staking reward of ${amount}${value}`,
  sentHbar: (amount, value, party) => `You sent ${amount}${value}${to(party)}`,
  receivedHbar: (amount, value, party) => `You received ${amount}${value}${from(party)}`,
  sentToken: (amount, party) => `You sent ${amount}${to(party)}`,
  receivedToken: (amount, party) => `You received ${amount}${from(party)}`,
  sentNft: (nft, party) => `You sent an NFT (${nft})${to(party)}`,
  receivedNft: (nft, party) => `You received an NFT (${nft})${from(party)}`,
  noChange: "No change to your balance",

  headlines: {
    CONSENSUSSUBMITMESSAGE: "You submitted a message to a topic",
    CONSENSUSCREATETOPIC: "You created a topic",
    CONTRACTCALL: "You called a smart contract",
    CONTRACTCREATEINSTANCE: "You deployed a smart contract",
    CRYPTOAPPROVEALLOWANCE: "You granted a spending allowance",
    CRYPTODELETEALLOWANCE: "You revoked a spending allowance",
    CRYPTOCREATEACCOUNT: "You created an account",
    CRYPTOUPDATEACCOUNT: "You updated an account",
    TOKENASSOCIATE: "You associated a token with your account",
    TOKENDISSOCIATE: "You dissociated a token from your account",
    TOKENCREATION: "You created a token",
    TOKENMINT: "You minted tokens",
    TOKENBURN: "You burned tokens",
    SCHEDULECREATE: "You scheduled a transaction",
    SCHEDULESIGN: "You signed a scheduled transaction",
    FILECREATE: "You stored a file on the ledger",
    FILEUPDATE: "You updated a file on the ledger",
  },

  networkFeeLabel: "Network fee",
  dateLabel: "Date",
  transactionLabel: "Transaction",
  senderNoteLabel: "Sender's note",
  memoWarning:
    "This note was written by the transaction's sender — never visit links " +
    "or follow instructions from senders you don't know.",
  statusFailed: "This transaction failed — no transfer took place (a network fee may still apply).",

  provenanceVerified: (block, network) =>
    `Cryptographically verified against the ${network ? `${network} ` : ""}ledger (block ${block}).`,
  provenanceMirror: (network) =>
    `From the ${network ? `${network} ` : ""}mirror node — not independently verified.`,
  provenanceStream: (network) =>
    `From an unverified ${network ? `${network} ` : ""}stream — not independently verified.`,

  fiatApprox: (amount, currency) => `≈ ${amount} ${currency}`,
  fiatUnderOneCent: (currency) => `< 0.01 ${currency}`,

  receiptForAccount: (account) => `Receipt for account ${account}`,
  receiptFor: (account) => `Receipt for ${account}`,
  verifiedBadge: "Verified",
  unverifiedBadge: "Unverified",
};
