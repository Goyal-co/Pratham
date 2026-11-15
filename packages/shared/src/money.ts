/**
 * Wallet-centric money model:
 * - wallet can be positive (prepaid) or negative (borrowed)
 * - creditLimit is max borrow → wallet may not go below -creditLimit
 */

/** Room left before hitting the borrow floor (after optional holds). */
export function creditAvailable(
  wallet: number,
  creditLimit: number,
  held = 0
): number {
  return wallet - held + creditLimit;
}

/** True if charging `amount` would push wallet below -creditLimit. */
export function wouldExceedCreditLimit(
  wallet: number,
  amount: number,
  creditLimit: number,
  held = 0
): boolean {
  return wallet - held - amount < -creditLimit - 1e-9;
}

/** How much is owed (positive number if wallet is negative). */
export function debtFromWallet(wallet: number): number {
  return Math.max(0, -wallet);
}

/** @deprecated use creditAvailable — kept for older call sites during transition */
export function creditRemaining(
  creditLimit: number,
  outstandingOrWalletDebt: number,
  held = 0
): number {
  return Math.max(0, creditLimit - outstandingOrWalletDebt - held);
}

/** @deprecated wallet is charged in full; kept for rare prepaid splits */
export function applyWallet(
  gross: number,
  walletCredit: number
): { walletApplied: number; payable: number; walletRemaining: number } {
  const positive = Math.max(walletCredit, 0);
  const walletApplied = Math.min(positive, Math.max(gross, 0));
  return {
    walletApplied,
    payable: gross - walletApplied,
    walletRemaining: walletCredit - walletApplied,
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
