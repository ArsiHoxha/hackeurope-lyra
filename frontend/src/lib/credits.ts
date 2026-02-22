// Attestify Credits — localStorage-based credit wallet
// In production, replace with server-side balance stored in your database.

const CREDITS_KEY = "attestify_credits";
const CREDITS_CHANGE_EVENT = "attestify-credits-change";

export interface CreditTransaction {
  id: string;
  type: "purchase" | "usage";
  amount: number; // positive = earned, negative = spent
  description: string;
  timestamp: number;
  sessionId?: string; // Stripe session ID for purchases
}

export interface CreditWallet {
  balance: number;
  transactions: CreditTransaction[];
}

function defaultWallet(): CreditWallet {
  return { balance: 0, transactions: [] };
}

export function getWallet(): CreditWallet {
  if (typeof window === "undefined") return defaultWallet();
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    return raw ? JSON.parse(raw) : defaultWallet();
  } catch {
    return defaultWallet();
  }
}

function saveWallet(wallet: CreditWallet) {
  localStorage.setItem(CREDITS_KEY, JSON.stringify(wallet));
  window.dispatchEvent(
    new CustomEvent(CREDITS_CHANGE_EVENT, { detail: { balance: wallet.balance } })
  );
}

export function getBalance(): number {
  return getWallet().balance;
}

/** Add credits after a successful Stripe purchase */
export function addCredits(
  amount: number,
  description: string,
  sessionId?: string
): void {
  const wallet = getWallet();
  // Idempotency: skip if this session was already processed
  if (sessionId && wallet.transactions.some((t) => t.sessionId === sessionId)) {
    return;
  }
  wallet.balance += amount;
  wallet.transactions.unshift({
    id: crypto.randomUUID(),
    type: "purchase",
    amount,
    description,
    timestamp: Date.now(),
    sessionId,
  });
  saveWallet(wallet);
}

/** Deduct credits for an API operation. Returns false if insufficient balance. */
export function spendCredits(amount: number, description: string): boolean {
  const wallet = getWallet();
  if (wallet.balance < amount) return false;
  wallet.balance -= amount;
  wallet.transactions.unshift({
    id: crypto.randomUUID(),
    type: "usage",
    amount: -amount,
    description,
    timestamp: Date.now(),
  });
  saveWallet(wallet);
  return true;
}

export function onCreditsChange(cb: (balance: number) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<{ balance: number }>).detail.balance);
  window.addEventListener(CREDITS_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CREDITS_CHANGE_EVENT, handler);
}

// ── Credit costs ─────────────────────────────────────────────────────
export const CREDIT_COSTS = {
  text_watermark: 1,
  text_verify: 1,
  image_watermark: 2,
  image_verify: 2,
  audio_watermark: 3,
  audio_verify: 3,
  video_watermark: 5,
  video_verify: 5,
  youtube_scan: 3,
} as const;

// ── Credit packs (must match what the API route creates in Stripe) ────
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // USD cents
  popular?: boolean;
  description: string;
  features: string[];
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    price: 900, // $9
    description: "Perfect for individuals and quick tests.",
    features: [
      "100 text operations",
      "50 image operations",
      "33 audio scans",
      "20 video operations",
      "No expiry",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    credits: 500,
    price: 3900, // $39
    popular: true,
    description: "Best value for small teams and power users.",
    features: [
      "500 text operations",
      "250 image operations",
      "166 audio scans",
      "100 video operations",
      "No expiry",
    ],
  },
  {
    id: "business",
    name: "Business",
    credits: 2000,
    price: 14900, // $149
    description: "Ideal for agencies processing at scale.",
    features: [
      "2,000 text operations",
      "1,000 image operations",
      "666 audio scans",
      "400 video operations",
      "No expiry",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: 10000,
    price: 49900, // $499
    description: "Maximum scale for large organisations.",
    features: [
      "10,000 text operations",
      "5,000 image operations",
      "3,333 audio scans",
      "2,000 video operations",
      "No expiry + priority support",
    ],
  },
];
