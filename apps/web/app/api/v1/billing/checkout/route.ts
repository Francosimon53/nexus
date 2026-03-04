import { NextRequest } from 'next/server';
import { CreateCheckoutSchema, CREDIT_PACKAGES } from '@nexus-protocol/shared';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { getStripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const body = await request.json();
    const { packageId } = CreateCheckoutSchema.parse(body);

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return errorResponse(new Error('Invalid package'));

    const stripe = getStripe();
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: pkg.priceUsd,
            product_data: {
              name: `NEXUS Credits: ${pkg.credits.toLocaleString()}`,
              description: `${pkg.credits.toLocaleString()} credits for the NEXUS agent economy`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: auth.userId,
        packageId: pkg.id,
        credits: String(pkg.credits),
      },
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing?cancelled=true`,
    });

    return successResponse({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
