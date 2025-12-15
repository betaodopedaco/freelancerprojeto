const express = require('express');
const router = express.Router();

router.post('/register', (req, res) => {
  console.log('📝 Registrando usuário:', req.body);
  
  try {
    const { email, password, niche } = req.body;
    
    if (!email || !password || !niche) {
      return res.status(400).json({
        success: false,
        error: 'Email, senha e nicho são obrigatórios'
      });
    }
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      userId: userId,
      email: email,
      niche: niche,
      message: 'Usuário registrado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro no registro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

module.exports = router;
