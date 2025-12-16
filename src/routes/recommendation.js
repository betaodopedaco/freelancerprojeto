const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { getBusinessContact } = require('../services/scraper');

// ==================== MAPEAMENTO DE NICHOS ====================
const NICHE_MAPPING = {
  web_designer: [
    'amenity=restaurant',
    'amenity=cafe', 
    'shop=bakery',
    'shop=clothes',
    'shop=hairdresser',
    'shop=beauty',
    'amenity=bar',
    'shop=florist',
    'amenity=pharmacy'
  ],
  social_media: [
    'shop=clothes',
    'shop=jewelry',
    'amenity=restaurant',
    'leisure=fitness_centre',
    'shop=beauty',
    'shop=cosmetics',
    'amenity=fast_food'
  ],
  seo: [
    'shop=electronics',
    'shop=furniture',
    'amenity=restaurant',
    'office=company',
    'shop=car',
    'shop=bicycle'
  ],
  content_creator: [
    'amenity=cinema',
    'amenity=theatre',
    'shop=books',
    'office=advertising',
    'tourism=hotel',
    'leisure=sports_centre'
  ]
};

// ==================== BUSCA NO OVERPASS API (EMPRESAS REAIS) ====================
async function searchBusinessesWithOverpass(lat, lon, radius, niche) {
  const tags = NICHE_MAPPING[niche] || NICHE_MAPPING.web_designer;
  const queries = tags.map(tag => `node(around:${radius},${lat},${lon})[${tag}];`).join('');

  const overpassQuery = `
    [out:json][timeout:30];
    (
      ${queries}
    );
    out body;
  `;

  console.log(`📍 Buscando empresas REAIS: nicho=${niche}, raio=${radius}m`);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    const data = await response.json();
    console.log(`✅ Overpass retornou ${data.elements?.length || 0} resultados REAIS`);
    return data.elements || [];
  } catch (error) {
    console.error('❌ Erro na busca Overpass:', error);
    return [];
  }
}

// ==================== GERAR PITCH COM GROQ ====================
async function generateDetailedPitchWithGroq(businessName, businessType, niche) {
  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (!groqApiKey) {
    const fallbackPitches = {
      web_designer: `Hi! I'm a web design specialist. I noticed ${businessName} could benefit from a modern, professional website to attract more customers online.`,
      social_media: `Hi! I specialize in social media growth. ${businessName} could significantly increase engagement and reach with a tailored social strategy.`,
      seo: `Hi! I'm an SEO expert. I can help ${businessName} rank higher on Google and attract more organic traffic to boost sales.`,
      content_creator: `Hi! I create high-quality content. ${businessName} could benefit from engaging content that converts visitors into customers.`
    };
    return fallbackPitches[niche] || fallbackPitches.web_designer;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a professional sales pitch writer. Create SHORT (2-3 sentences), persuasive pitches in English.'
          },
          {
            role: 'user',
            content: `Create a brief sales pitch for a ${niche} freelancer approaching "${businessName}" (a ${businessType} business). Focus on benefits and results.`
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error('❌ Erro Groq API:', error);
  }

  return `Hi! I'm a ${niche.replace('_', ' ')} specialist. I can help ${businessName} grow their business with professional services tailored to their needs.`;
}

// ==================== LIMPAR E VALIDAR DADOS ====================
async function validateAndCleanBusiness(business, index, lat, lon, niche) {
  const businessLat = business.lat || lat;
  const businessLon = business.lon || lon;

  const distance = Math.sqrt(
    Math.pow((businessLat - lat) * 111, 2) +
    Math.pow((businessLon - lon) * 85, 2)
  ).toFixed(1);

  let name = business.tags?.name || business.tags?.['brand:name'] || business.tags?.operator || 'Local Business';

  let phone = business.tags?.phone || business.tags?.['contact:phone'] || '';
  let email = business.tags?.email || business.tags?.['contact:email'] || '';
  let website = business.tags?.website || business.tags?.url || business.tags?.['contact:website'] || '';

  if (phone) {
    phone = phone.replace(/[^\d+]/g, '').substring(0, 15);
  }

  if (email && !email.includes('@')) {
    email = '';
  }

  if (website && !website.startsWith('http')) {
    website = 'https://' + website;
  }

  const categories = {
    web_designer: ['Web Design', 'Digital Marketing', 'Online Presence'],
    social_media: ['Social Media', 'Digital Marketing', 'Brand Building'],
    seo: ['SEO', 'Digital Marketing', 'Online Visibility'],
    content_creator: ['Content Creation', 'Marketing', 'Brand Storytelling']
  };

  const nicheCategories = categories[niche] || categories.web_designer;
  const category = nicheCategories[Math.floor(Math.random() * nicheCategories.length)];

  let compatibilityScore = 50;
  const businessType = (business.tags?.amenity || business.tags?.shop || business.tags?.office || '').toLowerCase();
  const businessName = (business.tags?.name || '').toLowerCase();

  const COMPATIBILITY_MAPPING = {
    web_designer: ['restaurant', 'cafe', 'shop', 'salon', 'pharmacy', 'bar', 'bakery'],
    social_media: ['clothes', 'beauty', 'jewelry', 'restaurant', 'salon'],
    seo: ['shop', 'office', 'company', 'electronics'],
    content_creator: ['hotel', 'tourism', 'cinema', 'theatre', 'books']
  };

  const nicheCompat = COMPATIBILITY_MAPPING[niche] || [];
  if (nicheCompat.some(comp => businessType.includes(comp) || businessName.includes(comp))) {
    compatibilityScore = 90;
  }

  const potentialScore = compatibilityScore;
  const rating = (Math.random() * 2 + 3).toFixed(1);

  let address = 'Address not available';
  if (business.tags) {
    const street = business.tags['addr:street'] || '';
    const city = business.tags['addr:city'] || business.tags['addr:suburb'] || '';
    const postcode = business.tags['addr:postcode'] || '';
    
    if (street || city) {
      address = `${street}${street && city ? ', ' : ''}${city}${postcode ? ' - ' + postcode : ''}`;
    } else {
      address = `Near ${businessLat.toFixed(4)}, ${businessLon.toFixed(4)}`;
    }
  }

  // ENRIQUECIMENTO SEMPRE
  let enrichedContact = { social: {}, contactForm: null, fallback: null, googleMaps: null };
  
  try {
    const contactData = await getBusinessContact({
      name: name,
      website: website || null,
      city: business.tags?.['addr:city'] || 'Unknown',
      address: address
    });
    
    if (contactData.email && !email) email = contactData.email;
    if (contactData.phone && !phone) phone = contactData.phone;
    enrichedContact = {
      social: contactData.social || {},
      contactForm: contactData.contactForm,
      fallback: contactData.fallback,
      googleMaps: `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + (business.tags?.['addr:city'] || ''))}`
    };
  } catch (error) {
    console.error(`⚠️ Erro ao enriquecer ${name}:`, error.message);
    enrichedContact.googleMaps = `https://www.google.com/maps/search/${encodeURIComponent(name)}`;
  }

  const uniqueId = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${businessLat.toFixed(6)}_${businessLon.toFixed(6)}_${index}`;

  return {
    id: uniqueId,
    name: name,
    description: `${category} business located ${distance}km away.`,
    address: address,
    distance: parseFloat(distance),
    rating: parseFloat(rating),
    phone: phone,
    email: email,
    website: website || undefined,
    social: enrichedContact.social,
    contactForm: enrichedContact.contactForm,
    contactFallback: enrichedContact.fallback,
    googleMaps: enrichedContact.googleMaps,
    category: category,
    potentialScore: potentialScore,
    isNew: index < 3
  };
}

// ==================== ROTA PRINCIPAL ====================
router.post('/', async (req, res) => {
  try {
    const { lat, lon, niche, radius = 5000, offset = 0 } = req.body;

    if (!lat || !lon || !niche) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: lat, lon, niche'
      });
    }

    console.log(`\n🔍 Nova busca REAL: lat=${lat}, lon=${lon}, niche=${niche}`);

    const businessesData = await searchBusinessesWithOverpass(lat, lon, radius, niche);

    let allBusinesses = [];

    if (businessesData.length > 0) {
      // DEDUPLICAÇÃO ÚNICA
      const seenNames = new Map();
      
      const deduplicatedBusinesses = businessesData
        .filter(business => business.tags && (business.tags.name || business.tags.operator))
        .filter(business => {
          const name = (business.tags?.name || business.tags?.operator || '').toLowerCase().trim();
          
          if (!name) return false;
          
          if (seenNames.has(name)) {
            console.log(`  🗑️ Ignorando duplicata: ${name}`);
            return false;
          }
          
          seenNames.set(name, true);
          return true;
        });

      console.log(`✅ Deduplicado: ${businessesData.length} → ${deduplicatedBusinesses.length} empresas únicas`);

      const validBusinesses = deduplicatedBusinesses.slice(0, 50);

      console.log(`✅ ${validBusinesses.length} empresas REAIS encontradas`);

      allBusinesses = await Promise.all(
        validBusinesses.map(async (business, index) => {
          const cleanedBusiness = await validateAndCleanBusiness(business, index, lat, lon, niche);

          if (process.env.GROQ_API_KEY) {
            try {
              const pitch = await generateDetailedPitchWithGroq(
                cleanedBusiness.name,
                cleanedBusiness.category,
                niche
              );
              cleanedBusiness.description = pitch;
            } catch (error) {
              console.warn('⚠️ Pitch padrão usado');
            }
          }

          return cleanedBusiness;
        })
      );
    } else {
      console.log('⚠️ Nenhuma empresa encontrada no raio especificado');
      return res.json({
        success: true,
        data: {
          businesses: [],
          metadata: {
            totalFound: 0,
            hasMore: false,
            nextOffset: 0,
            currentOffset: 0,
            radius: radius,
            niche: niche
          },
          allBusinesses: []
        },
        message: 'No businesses found in this area. Try expanding the search radius.'
      });
    }

    allBusinesses.sort((a, b) => b.potentialScore - a.potentialScore);
    
    console.log(`📊 Total final: ${allBusinesses.length} empresas REAIS únicas`);
    
    const totalFound = allBusinesses.length;
    const hasMore = totalFound > offset + 5;
    const businesses = allBusinesses.slice(offset, offset + 5);

    console.log(`📊 Retornando ${businesses.length} de ${totalFound} empresas REAIS`);

    res.json({
      success: true,
      data: {
        businesses: businesses,
        metadata: {
          totalFound: totalFound,
          hasMore: hasMore,
          nextOffset: hasMore ? offset + 5 : offset,
          currentOffset: offset,
          radius: radius,
          niche: niche
        },
        allBusinesses: allBusinesses
      }
    });

  } catch (error) {
    console.error('❌ Erro na rota:', error);
    res.status(500).json({
      success: false,
      error: 'Internal error',
      details: error.message
    });
  }
});

router.post('/next-batch', async (req, res) => {
  try {
    const { allBusinesses, offset, niche } = req.body;

    if (!allBusinesses || !Array.isArray(allBusinesses)) {
      return res.status(400).json({
        success: false,
        error: 'Parameter allBusinesses is required and must be an array'
      });
    }

    const totalFound = allBusinesses.length;
    const hasMore = totalFound > offset + 5;
    const nextBatch = allBusinesses.slice(offset, offset + 5);

    res.json({
      success: true,
      data: {
        businesses: nextBatch,
        metadata: {
          totalFound: totalFound,
          hasMore: hasMore,
          nextOffset: hasMore ? offset + 5 : offset,
          currentOffset: offset,
          niche: niche
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro next-batch:', error);
    res.status(500).json({
      success: false,
      error: 'Internal error',
      details: error.message
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Recommendations API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
