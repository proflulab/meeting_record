import { NextRequest } from 'next/server';
import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as const,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('✅ Received webhook event:');
    console.dir(event, { depth: null });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const paymentIntentId = session.payment_intent;
      if (typeof paymentIntentId === 'string') {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        console.log('💳 PaymentIntent data:');
        console.dir(paymentIntent, { depth: null });

        // 可选：保存到数据库，或其他后续逻辑
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (err: unknown) {
    console.error('❌ Webhook Error:', err instanceof Error ? err.message : 'Unknown error');
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
      status: 400,
    });
  }
}
