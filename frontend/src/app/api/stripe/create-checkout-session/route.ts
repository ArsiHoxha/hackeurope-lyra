import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CREDIT_PACKS } from "@/lib/credits";

// Pick key based on mode sent by the client
function getStripeKey(mode: "test" | "live"): string | undefined {
  return mode === "test"
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_LIVE_SECRET_KEY;
}

export async function POST(req: NextRequest) {
  try {
    const { packId, userId, mode = "live" } = await req.json();

    const stripeKey = getStripeKey(mode as "test" | "live");
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });

    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://hackeurope-lyra.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // No payment_method_types → Stripe uses dynamic payment methods driven
      // by your Dashboard settings (Settings → Payment methods).  This is the
      // only way to surface newer methods such as Bancontact, EPS, and
      // Stablecoins/USDC — the legacy explicit list rejects them at the API
      // level even when they are Dashboard-enabled.
      // Ensure "Stablecoins and Crypto" is toggled ON at:
      // https://dashboard.stripe.com/settings/payment_methods
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.price, // already in cents
            product_data: {
              name: `Attestify ${pack.name} — ${pack.credits.toLocaleString()} Credits`,
              description: pack.description,
              images: [],
              metadata: {
                packId: pack.id,
                credits: String(pack.credits),
              },
            },
          },
        },
      ],
      metadata: {
        packId: pack.id,
        credits: String(pack.credits),
        userId: userId ?? "anonymous",
        mode,
      },
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}&mode=${mode}`,
      cancel_url: `${appUrl}/billing/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/create-checkout-session]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
