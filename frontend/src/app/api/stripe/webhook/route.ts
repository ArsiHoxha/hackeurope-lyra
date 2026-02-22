import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Disable body parsing so we can verify the Stripe signature
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Instantiate inside handler — never at module evaluation time
  const stripe = new Stripe(secretKey, { apiVersion: "2026-01-28.clover" });

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Handle completed checkouts ────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      const credits = Number(session.metadata?.credits ?? 0);
      const packId = session.metadata?.packId ?? "unknown";
      const userId = session.metadata?.userId ?? "anonymous";

      // In production: upsert credits in your database for `userId`
      console.log(
        `[stripe/webhook] ✅ ${credits} credits purchased (pack: ${packId}) for user: ${userId} — session: ${session.id}`
      );
    }
  }

  return NextResponse.json({ received: true });
}
