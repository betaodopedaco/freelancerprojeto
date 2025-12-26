require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51RwtmoAWeQiFq7TbTjODNsZzLkSkRu9cqtStzrOZBGrJpiJ19UH3BERYJLRR9TMIAqMBcUpAUw7J42carAmB6ozq00l3K8Fy6i');
const fs = require('fs');
const path = require('path');
const app = express();

// ========== CONFIGURAÇÃO DE PREÇOS POR REGIÃO ==========
const PRICE_CONFIG = {
  US: {
    priceId: 'price_1SiekyAWeQiFq7TbYedYcX1f', // ✅ USA - $7/mês
    amount: 700, // $7.00
    currency: 'usd',
    symbol: '$',
    displayPrice: '$7'
  },
  IN: {
    priceId: 'price_1SiekyAWeQiFq7TbFj5Ko28Z', // ✅ Índia - ₹30/mês
    amount: 3000, // ₹30.00
    currency: 'inr',
    symbol: '₹',
    displayPrice: '₹30'
  },
  BR: {
    priceId: 'price_1SiekyAWeQiFq7Tbn445VScH', // ✅ Brasil - R$10/mês
    amount: 1000, // R$10.00
    currency: 'brl',
    symbol: 'R$',
    displayPrice: 'R$10'
  }
};

// ========== RATE LIMITING (15 requisições por hora) ==========
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 15, // 15 requisições
  message: {
    error: 'Limite de requisições atingido. Tente novamente em 1 hora.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Você atingiu o limite de 15 requisições gratuitas por hora.',
      message: 'Assine o plano Premium para buscas ilimitadas!',
      upgradeUrl: '/pricing'
    });
  }
});

// Rate limit específico para usuários NÃO pagos
const checkUserLimit = async (req, res, next) => {
  const { email } = req.body || req.query;
  
  if (!email) {
    return next();
  }

  const user = findUser(email);
  
  // Se é usuário PREMIUM, não aplica rate limit
  if (user?.isPaid) {
    return next();
  }
  
  // Se não é premium, aplica o rate limit
  apiLimiter(req, res, next);
};

// ✅ CORS ATUALIZADO PARA PRODUÇÃO
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://freelancerprojeto.vercel.app',
    'https://freelancer-novo.vercel.app',
    'https://tofind.online',
    'http://tofind.online',
    'https://www.tofind.online',
    'http://www.tofind.online'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Database simples para usuários
const DB_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, '[]');
}

const getUsers = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveUsers = (users) => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));

const findUser = (email) => getUsers().find(u => u.email === email);

const updateUser = (email, updates) => {
  const users = getUsers();
  const index = users.findIndex(u => u.email === email);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    saveUsers(users);
    return users[index];
  }
  const newUser = { email, isPaid: false, ...updates };
  users.push(newUser);
  saveUsers(users);
  return newUser;
};

// Endpoint de saúde
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Online!' });
});

// ========== DETECTAR PAÍS DO USUÁRIO ==========
app.get('/api/detect-country', async (req, res) => {
  try {
    // Pega o IP do usuário
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Usa uma API gratuita para detectar o país
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();
    
    let country = 'US'; // Default
    
    if (data.country_code === 'BR') country = 'BR';
    else if (data.country_code === 'IN') country = 'IN';
    else if (data.country_code === 'US') country = 'US';
    
    const pricing = PRICE_CONFIG[country];
    
    res.json({
      country,
      pricing: {
        amount: pricing.displayPrice,
        currency: pricing.currency,
        priceId: pricing.priceId
      }
    });
  } catch (error) {
    // Se der erro, retorna default (USA)
    res.json({
      country: 'US',
      pricing: PRICE_CONFIG.US
    });
  }
});

// ========== CRIAR CHECKOUT STRIPE (COM REGIÃO) ==========
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { email, country = 'US' } = req.body;

    // Valida o país
    if (!PRICE_CONFIG[country]) {
      return res.status(400).json({ error: 'País inválido' });
    }

    const pricing = PRICE_CONFIG[country];

    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? 'https://tofind.online'
      : 'http://localhost:3001';

    // Cria checkout com o preço correto da região
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

    res.json({ 
      url: session.url,
      pricing: pricing.displayPrice
    });
  } catch (error) {
    console.error('❌ Erro Stripe:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== CRIAR PAGAMENTO PAYPAL ==========
app.post('/api/create-paypal-order', async (req, res) => {
  try {
    const { email, country = 'US' } = req.body;
    
    const pricing = PRICE_CONFIG[country];
    
    // TODO: Implementar integração com PayPal SDK
    // Por enquanto retorna estrutura básica
    
    res.json({
      message: 'PayPal em desenvolvimento',
      pricing: pricing.displayPrice,
      // orderID: 'PAYPAL_ORDER_ID_AQUI'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== VERIFICAR PAGAMENTO ==========
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const email = session.metadata.userEmail;
      updateUser(email, {
        isPaid: true,
        stripeCustomerId: session.customer,
        country: session.metadata.country,
        planType: session.metadata.planType
      });

      return res.json({
        success: true,
        message: '✅ Você é PREMIUM!'
      });
    }

    res.json({ success: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CHECAR STATUS DO USUÁRIO ==========
app.post('/api/check-status', (req, res) => {
  const { email } = req.body;
  const user = findUser(email);

  res.json({
    isPaid: user?.isPaid || false,
    country: user?.country || 'US',
    planType: user?.planType || 'free'
  });
});

// ========== ENDPOINT COM RATE LIMIT (EXEMPLO) ==========
app.post('/api/search', checkUserLimit, async (req, res) => {
  try {
    const { query, email } = req.body;
    
    // Sua lógica de busca aqui
    const results = {
      query,
      results: ['Resultado 1', 'Resultado 2', 'Resultado 3']
    };
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== WEBHOOK STRIPE ==========
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_...'
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.metadata.userEmail;
      updateUser(email, { 
        isPaid: true, 
        stripeCustomerId: session.customer,
        country: session.metadata.country,
        planType: session.metadata.planType
      });
      console.log(`✅ ${email} virou PREMIUM via webhook!`);
    }

    if (event.type === 'customer.subscription.deleted') {
      // Quando a assinatura é cancelada
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);
      const email = customer.email;
      updateUser(email, { isPaid: false });
      console.log(`❌ ${email} cancelou o Premium`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send('Webhook Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Frontend URL: https://tofind.online`);
  console.log(`🔒 CORS configured for production`);
  console.log(`⏱️  Rate Limit: 15 requisições/hora (usuários gratuitos)`);
  console.log(`💰 Preços por região configurados: US, IN, BR`);
});

module.exports = app;
