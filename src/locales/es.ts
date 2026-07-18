/**
 * Spanish receipt wording (`es-ES` — informal "tú", the register most
 * wallets use).
 *
 * Maintainer-authored; a native-speaker review before customer-facing use is
 * strongly encouraged — a receipt's credibility is its language. Dates and
 * decimal separators localize automatically via the catalog's `locale`.
 */
import type { Messages } from "../messages.js";

const a = (party?: string): string => (party ? ` a ${party}` : "");
const de = (party?: string): string => (party ? ` de ${party}` : "");

export const es: Messages = {
  locale: "es-ES",

  earnedStakingReward: (amount, value) => `Ganaste una recompensa de staking de ${amount}${value}`,
  sentHbar: (amount, value, party) => `Enviaste ${amount}${value}${a(party)}`,
  receivedHbar: (amount, value, party) => `Recibiste ${amount}${value}${de(party)}`,
  sentToken: (amount, party) => `Enviaste ${amount}${a(party)}`,
  receivedToken: (amount, party) => `Recibiste ${amount}${de(party)}`,
  sentNft: (nft, party) => `Enviaste un NFT (${nft})${a(party)}`,
  receivedNft: (nft, party) => `Recibiste un NFT (${nft})${de(party)}`,
  noChange: "Sin cambios en tu saldo",

  headlines: {
    CONSENSUSSUBMITMESSAGE: "Enviaste un mensaje a un topic",
    CONSENSUSCREATETOPIC: "Creaste un topic",
    CONTRACTCALL: "Llamaste a un contrato inteligente",
    CONTRACTCREATEINSTANCE: "Desplegaste un contrato inteligente",
    CRYPTOAPPROVEALLOWANCE: "Concediste una autorización de gasto",
    CRYPTODELETEALLOWANCE: "Revocaste una autorización de gasto",
    CRYPTOCREATEACCOUNT: "Creaste una cuenta",
    CRYPTOUPDATEACCOUNT: "Actualizaste una cuenta",
    TOKENASSOCIATE: "Asociaste un token a tu cuenta",
    TOKENDISSOCIATE: "Desasociaste un token de tu cuenta",
    TOKENCREATION: "Creaste un token",
    TOKENMINT: "Acuñaste tokens",
    TOKENBURN: "Quemaste tokens",
    SCHEDULECREATE: "Programaste una transacción",
    SCHEDULESIGN: "Firmaste una transacción programada",
    FILECREATE: "Guardaste un archivo en el ledger",
    FILEUPDATE: "Actualizaste un archivo en el ledger",
  },

  networkFeeLabel: "Comisión de red",
  dateLabel: "Fecha",
  transactionLabel: "Transacción",
  senderNoteLabel: "Nota del remitente",
  memoWarning:
    "Esta nota fue escrita por el remitente de la transacción — nunca visites " +
    "enlaces ni sigas instrucciones de remitentes que no conozcas.",
  statusFailed:
    "Esta transacción falló — no se realizó ninguna transferencia " +
    "(puede aplicarse una comisión de red).",

  provenanceVerified: (block, network) =>
    network
      ? `Verificado criptográficamente contra el ledger de ${network} (bloque ${block}).`
      : `Verificado criptográficamente contra el ledger (bloque ${block}).`,
  provenanceMirror: (network) =>
    network
      ? `Del mirror node de ${network} — sin verificación independiente.`
      : `Del mirror node — sin verificación independiente.`,
  provenanceStream: (network) =>
    network
      ? `De un stream sin verificar de ${network} — sin verificación independiente.`
      : `De un stream sin verificar — sin verificación independiente.`,

  fiatApprox: (amount, currency) => `≈ ${amount} ${currency}`,
  fiatUnderOneCent: (currency) => `< 0,01 ${currency}`,

  receiptForAccount: (account) => `Recibo de la cuenta ${account}`,
  receiptFor: (account) => `Recibo de ${account}`,
  verifiedBadge: "Verificado",
  unverifiedBadge: "No verificado",
};
