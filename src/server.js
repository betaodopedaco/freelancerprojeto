require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const corsOptions = {
  origin: [
    'http://localhost:3000',
'http://localhost:3001',
'https://freelancerprojeto.vercel.app',
'https://freelancer-novo.vercel.app',
'https://freelancerprojeto-odwtjfx9t-betaodopedacos-projects.vercel.app',
'https://freelancer-novo-betaodopedacos-projects.vercel.app',
'https://betaodopedaco.github.io',
'https://tofind.online',
'https://www.tofind.online'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Online!' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/scraping', require('./routes/scraping'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
