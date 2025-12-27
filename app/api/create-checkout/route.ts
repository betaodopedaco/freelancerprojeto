import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, country = 'US' } = body;

    const PRICE_CONFIG: Record<string, any> = {
      US: { priceId: 'price_1SiekyAWeQiFq7TbYedYcX1f', amount: 700, currency: 'usd', symbol: '$', displayPrice: '$7' },
      IN: { priceId: 'price_1SiekyAWeQiFq7TbFj5Ko28Z', amount: 3000, currency: 'inr', symbol: '₹', displayPrice: '₹30' },
      BR: { priceId: 'price_1SiekyAWeQiFq7Tbn445VScH', amount: 1000, currency: 'brl', symbol: 'R$', displayPrice: 'R$10' }
    };

    if (!PRICE_CONFIG[country]) {
      return NextResponse.json({ error: 'País inválido' }, { status: 400 });
    }

    const pricing = PRICE_CONFIG[country];
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction ? 'https://tofind.online' : 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: pricing.currency,
          product_data: { name: 'FIND Premium', description: 'Buscas ilimitadas + acesso total' },
          unit_amount: pricing.amount,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: `${frontendUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?payment=cancelled`,
      metadata: { userEmail: email, country: country, planType: 'premium' }
    });

    return NextResponse.json({ url: session.url, pricing: pricing.displayPrice });
  } catch (error: any) {
    console.error('❌ Erro Stripe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
