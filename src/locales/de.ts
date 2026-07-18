/**
 * German receipt wording (`de-DE` — formal "Sie").
 *
 * Maintainer-authored; a native-speaker review before customer-facing use is
 * strongly encouraged — a receipt's credibility is its language. Dates and
 * decimal separators localize automatically via the catalog's `locale`.
 */
import type { Messages } from "../messages.js";

const an = (party?: string): string => (party ? ` an ${party}` : "");
const von = (party?: string): string => (party ? ` von ${party}` : "");

export const de: Messages = {
  locale: "de-DE",

  earnedStakingReward: (amount, value) =>
    `Sie haben eine Staking-Belohnung von ${amount}${value} erhalten`,
  sentHbar: (amount, value, party) => `Sie haben ${amount}${value}${an(party)} gesendet`,
  receivedHbar: (amount, value, party) => `Sie haben ${amount}${value}${von(party)} erhalten`,
  sentToken: (amount, party) => `Sie haben ${amount}${an(party)} gesendet`,
  receivedToken: (amount, party) => `Sie haben ${amount}${von(party)} erhalten`,
  sentNft: (nft, party) => `Sie haben ein NFT (${nft})${an(party)} gesendet`,
  receivedNft: (nft, party) => `Sie haben ein NFT (${nft})${von(party)} erhalten`,
  noChange: "Keine Änderung Ihres Kontostands",

  headlines: {
    CONSENSUSSUBMITMESSAGE: "Sie haben eine Nachricht an ein Topic gesendet",
    CONSENSUSCREATETOPIC: "Sie haben ein Topic erstellt",
    CONTRACTCALL: "Sie haben einen Smart Contract aufgerufen",
    CONTRACTCREATEINSTANCE: "Sie haben einen Smart Contract bereitgestellt",
    CRYPTOAPPROVEALLOWANCE: "Sie haben eine Ausgabefreigabe erteilt",
    CRYPTODELETEALLOWANCE: "Sie haben eine Ausgabefreigabe widerrufen",
    CRYPTOCREATEACCOUNT: "Sie haben ein Konto erstellt",
    CRYPTOUPDATEACCOUNT: "Sie haben ein Konto aktualisiert",
    TOKENASSOCIATE: "Sie haben einen Token mit Ihrem Konto verknüpft",
    TOKENDISSOCIATE: "Sie haben einen Token von Ihrem Konto getrennt",
    TOKENCREATION: "Sie haben einen Token erstellt",
    TOKENMINT: "Sie haben Token geprägt",
    TOKENBURN: "Sie haben Token verbrannt",
    SCHEDULECREATE: "Sie haben eine Transaktion geplant",
    SCHEDULESIGN: "Sie haben eine geplante Transaktion signiert",
    FILECREATE: "Sie haben eine Datei im Ledger gespeichert",
    FILEUPDATE: "Sie haben eine Datei im Ledger aktualisiert",
  },

  networkFeeLabel: "Netzwerkgebühr",
  dateLabel: "Datum",
  transactionLabel: "Transaktion",
  senderNoteLabel: "Notiz des Absenders",
  memoWarning:
    "Diese Notiz stammt vom Absender der Transaktion — besuchen Sie niemals " +
    "Links und folgen Sie keinen Anweisungen von Absendern, die Sie nicht kennen.",
  statusFailed:
    "Diese Transaktion ist fehlgeschlagen — es fand keine Überweisung statt " +
    "(eine Netzwerkgebühr kann dennoch anfallen).",

  provenanceVerified: (block, network) =>
    network
      ? `Kryptographisch gegen das ${network}-Ledger verifiziert (Block ${block}).`
      : `Kryptographisch gegen das Ledger verifiziert (Block ${block}).`,
  provenanceMirror: (network) =>
    network
      ? `Vom ${network}-Mirror-Node — nicht unabhängig verifiziert.`
      : `Vom Mirror-Node — nicht unabhängig verifiziert.`,
  provenanceStream: (network) =>
    network
      ? `Aus einem unverifizierten ${network}-Stream — nicht unabhängig verifiziert.`
      : `Aus einem unverifizierten Stream — nicht unabhängig verifiziert.`,

  fiatApprox: (amount, currency) => `≈ ${amount} ${currency}`,
  fiatUnderOneCent: (currency) => `< 0,01 ${currency}`,

  receiptForAccount: (account) => `Beleg für Konto ${account}`,
  receiptFor: (account) => `Beleg für ${account}`,
  verifiedBadge: "Verifiziert",
  unverifiedBadge: "Nicht verifiziert",
};
