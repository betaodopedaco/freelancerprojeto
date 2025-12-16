const express = require('express');
const router = express.Router();

router.post('/generate', (req, res) => {
  console.log('📄 Gerando contrato:', req.body);
  
  try {
    const { niche, experience, contractType = 'basic' } = req.body;
    
    const templates = {
      basic: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: [NOME DA EMPRESA]
CONTRATADO: ${niche === 'web_designer' ? 'Web Designer' : niche === 'developer' ? 'Desenvolvedor' : 'Especialista em Marketing'}

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de ${niche} por parte do CONTRATADO.

CLÁUSULA SEGUNDA - DO PRAZO
O prazo para execução dos serviços será combinado conforme escopo a ser definido.

CLÁUSULA TERCEIRA - DO VALOR
O valor dos serviços será acordado conforme complexidade e prazo.

São Paulo, ${new Date().toLocaleDateString('pt-BR')}

_______________________________________
CONTRATANTE

_______________________________________
CONTRATADO`,

      development: `CONTRATO DE DESENVOLVIMENTO DE SOFTWARE

CLIENTE: [NOME DA EMPRESA]
DESENVOLVEDOR: ${niche === 'developer' ? 'Desenvolvedor' : 'Prestador de Serviços'}

1. ESCOPO DO PROJETO
Desenvolvimento de solução digital conforme especificações técnicas.

2. PRAZOS E ENTREGAS
- Entrega em fases conforme cronograma aprovado
- Revisões e ajustes inclusos

3. PROPRIEDADE INTELECTUAL
Todo código fonte desenvolvido será de propriedade do CLIENTE após pagamento integral.

4. GARANTIA
90 dias de garantia para correção de bugs críticos.

${new Date().toLocaleDateString('pt-BR')}`,

      marketing: `CONTRATO DE MARKETING DIGITAL

CONTRATANTE: [NOME DA EMPRESA]
CONTRATADO: Especialista em Marketing Digital

OBJETIVOS:
- Aumento de visibilidade online
- Geração de leads qualificados
- Gestão de redes sociais

METRÍCAS DE DESEMPENHO:
- Relatórios mensais de desempenho
- Ajustes estratégicos conforme resultados

INVESTIMENTO:
Valor mensal conforme pacote selecionado.

São Paulo, ${new Date().toLocaleDateString('pt-BR')}`
    };
    
    const contract = templates[contractType] || templates.basic;
    
    res.json({
      success: true,
      contract: contract,
      metadata: {
        niche: niche,
        experience: experience,
        contractType: contractType,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao gerar contrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

module.exports = router;
