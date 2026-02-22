import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe(mode: "test" | "live") {
  const key =
    mode === "test"
      ? process.env.STRIPE_TEST_SECRET_KEY!
      : process.env.STRIPE_LIVE_SECRET_KEY!;
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const rawMode = req.nextUrl.searchParams.get("mode");
  const mode: "test" | "live" = rawMode === "test" ? "test" : "live";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  // Try the requested mode first; fall back to the other one so old
  // sessions without a mode param still resolve correctly.
  const keys: ("test" | "live")[] = mode === "test" ? ["test", "live"] : ["live", "test"];

  for (const k of keys) {
    try {
      const stripe = getStripe(k);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return NextResponse.json(
          { error: "Payment not completed" },
          { status: 402 }
        );
      }

      return NextResponse.json({
        sessionId: session.id,
        packId: session.metadata?.packId,
        credits: Number(session.metadata?.credits ?? 0),
        amountTotal: session.amount_total,
        currency: session.currency,
      });
    } catch {
      // Wrong key for this session — try the other one
    }
  }

  return NextResponse.json(
    { error: "Could not verify session" },
    { status: 500 }
  );
}
