import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('🔥 INICIANDO create-checkout');
  
  try {
    const body = await req.json();
    console.log('📦 Body recebido:', body);
    
    const { email, country = 'US' } = body;

    const PRICE_CONFIG: Record<string, any> = {
      US: {
        priceId: 'price_1SiekyAWeQiFq7TbYedYcX1f',
        amount: 700,
        currency: 'usd',
        symbol: '$',
        displayPrice: '$7'
      },
      IN: {
        priceId: 'price_1SiekyAWeQiFq7TbFj5Ko28Z',
        amount: 3000,
        currency: 'inr',
        symbol: '₹',
        displayPrice: '₹30'
      },
      BR: {
        priceId: 'price_1SiekyAWeQiFq7Tbn445VScH',
        amount: 1000,
        currency: 'brl',
        symbol: 'R$',
        displayPrice: 'R$10'
      }
    };

    if (!PRICE_CONFIG[country]) {
      console.log('❌ País inválido:', country);
      return NextResponse.json({ error: 'País inválido' }, { status: 400 });
    }

    const pricing = PRICE_CONFIG[country];
    console.log('💰 Pricing selecionado:', pricing);

    // TEMPORÁRIO: chave hardcoded para teste
    const STRIPE_KEY = 'sk_test_51RwtmoAWeQiFq7TbTjODNsZzLkSkRu9cqtStzrOZBGrJpiJ19UH3BERYJLRR9TMIAqMBcUpAUw7J42carAmB6ozq00l3K8Fy6i';

    console.log('📡 Iniciando Stripe...');
    const stripe = require('stripe')(STRIPE_KEY);

    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? 'https://tofind.online'
      : 'http://localhost:3000';

    console.log('🌐 Frontend URL:', frontendUrl);

    console.log('🎫 Criando sessão Stripe...');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: pricing.currency,
            product_data: {
              name: 'FIND Premium',
              description: 'Buscas ilimitadas + acesso total',
            },
            unit_amount: pricing.amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?payment=cancelled`,
      metadata: {
        userEmail: email,
        country: country,
        planType: 'premium'
      }
    });

    console.log('✅ Sessão criada com sucesso!');
    console.log('🔗 URL:', session.url);

    return NextResponse.json({
      url: session.url,
      pricing: pricing.displayPrice
    });
  } catch (error: any) {
    console.error('❌ ERRO COMPLETO:', error);
    console.error('❌ Mensagem:', error.message);
    console.error('❌ Stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
