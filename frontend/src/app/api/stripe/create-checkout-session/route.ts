import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CREDIT_PACKS } from "@/lib/credits";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function POST(req: NextRequest) {
  try {
    const { packId, userId } = await req.json();

    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
      },
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
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
