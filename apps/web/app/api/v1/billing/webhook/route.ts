import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { creditCredits } from '@/lib/billing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    const supabase = getSupabaseAdmin();

    // Idempotency check
    const { data: existing } = await supabase
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .single();

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record event
    await supabase.from('stripe_events').insert({
      event_id: event.id,
      type: event.type,
    });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const credits = Number(session.metadata?.credits ?? 0);

      if (userId && credits > 0) {
        await creditCredits(
          supabase,
          userId,
          credits,
          'purchase',
          event.id,
          `Purchased ${credits.toLocaleString()} credits`,
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook handler failed' },
      { status: 400 },
    );
  }
}
