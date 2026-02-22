import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
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
      amountTotal: session.amount_total, // in cents
      currency: session.currency,
    });
  } catch (err) {
    console.error("[stripe/verify-session]", err);
    return NextResponse.json(
      { error: "Could not verify session" },
      { status: 500 }
    );
  }
}
