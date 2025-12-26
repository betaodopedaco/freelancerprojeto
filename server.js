require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');
const app = express();

// CONFIGURAÇÃO DE PREÇOS POR REGIÃO
const PRICE_CONFIG = {
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

// RATE LIMITING
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { error: 'Limite atingido. Assine Premium!' }
});

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://tofind.online', 'https://www.tofind.online'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');

const getUsers = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveUsers = (users) => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
const findUser = (email) => getUsers().find(u => u.email === email);
const updateUser = (email, updates) => {
  const users = getUsers();
  const index = users.findIndex(u => u.email === email);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
  } else {
    users.push({ email, isPaid: false, ...updates });
  }
  saveUsers(users);
  return users[index !== -1 ? index : users.length - 1];
};

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Online!' });
});

app.get('/api/detect-country', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();
    
    let country = 'US';
    if (data.country_code === 'BR') country = 'BR';
    else if (data.country_code === 'IN') country = 'IN';
    
    res.json({ country, pricing: PRICE_CONFIG[country] });
  } catch (error) {
    res.json({ country: 'US', pricing: PRICE_CONFIG.US });
  }
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { email, country = 'US' } = req.body;
    const pricing = PRICE_CONFIG[country] || PRICE_CONFIG.US;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: pricing.priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || 'https://tofind.online'}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://tofind.online'}/?payment=cancelled`,
      metadata: { userEmail: email, country, planType: 'premium' }
    });
    
    res.json({ url: session.url, pricing: pricing.displayPrice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      const email = session.metadata?.userEmail;
      if (email) {
        updateUser(email, { isPaid: true, stripeCustomerId: session.customer });
        return res.json({ success: true, message: '✅ Premium ativado!' });
      }
    }
    res.json({ success: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-status', (req, res) => {
  const { email } = req.body;
  const user = findUser(email);
  res.json({ isPaid: user?.isPaid || false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
