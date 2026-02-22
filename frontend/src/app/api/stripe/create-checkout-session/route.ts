import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CREDIT_PACKS } from "@/lib/credits";

// Pick key based on mode sent by the client
function getStripe(mode: "test" | "live") {
  const key =
    mode === "test"
      ? process.env.STRIPE_TEST_SECRET_KEY!
      : process.env.STRIPE_LIVE_SECRET_KEY!;
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: NextRequest) {
  try {
    const { packId, userId, mode = "live" } = await req.json();
    const stripe = getStripe(mode as "test" | "live");

    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
