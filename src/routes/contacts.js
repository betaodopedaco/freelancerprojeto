const express = require('express');
const router = express.Router();

const userLimits = {};

router.post('/', (req, res) => {
  console.log('📞 Coletando contato:', req.body);
  
  try {
    const { businessId, businessName, businessWebsite, userEmail, niche } = req.body;
    
    // Simular limite
    const today = new Date().toISOString().split('T')[0];
    if (!userLimits[userEmail]) {
      userLimits[userEmail] = { remaining: 200, lastReset: today };
    }
    
    const limit = userLimits[userEmail];
    if (limit.remaining <= 0) {
      return res.status(429).json({
        success: false,
        error: 'Limite diário atingido'
      });
    }
    
    limit.remaining--;
    
    // Gerar contatos de demonstração
    const areaCodes = ['11', '21', '31', '41', '51'];
    const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
    const phoneNum = Math.floor(10000000 + Math.random() * 90000000);
    
    const contact = {
      phone: `(${areaCode}) 9${phoneNum.toString().substring(0, 4)}-${phoneNum.toString().substring(4)}`,
      email: `contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`
    };
    
    console.log(`✅ Contato coletado: ${contact.phone}, ${contact.email}`);
    
    res.json({
      success: true,
      data: {
        contact: contact,
        dailyLimit: {
          remaining: limit.remaining,
          used: 200 - limit.remaining,
          total: 200
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao coletar contato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

module.exports = router;
