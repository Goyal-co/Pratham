/** Apply wallet credit first; returns net payable and remaining wallet. */
export function applyWallet(
  gross: number,
  walletCredit: number
): { walletApplied: number; payable: number; walletRemaining: number } {
  const walletApplied = Math.min(Math.max(walletCredit, 0), Math.max(gross, 0));
  return {
    walletApplied,
    payable: gross - walletApplied,
    walletRemaining: walletCredit - walletApplied,
  };
}

export function wouldExceedCreditLimit(
  outstanding: number,
  newPayable: number,
  creditLimit: number
): boolean {
  return outstanding + newPayable > creditLimit + 1e-9;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
