const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// FUNÇÃO PRINCIPAL: Buscar todos os meios de contato
async function getBusinessContact(business) {
  console.log(`🔍 Buscando contato para: ${business.name}`);
  
  const contact = {
    email: null,
    phone: null,
    whatsapp: null,
    website: business.website || null,
    social: {
      linkedin: null,
      facebook: null,
      instagram: null,
      twitter: null,
      youtube: null,
      tiktok: null
    },
    googleMaps: null,
    contactForm: null,
    address: business.address || null,
    fallback: null
  };

  // Se tem website, faz scraping
  if (business.website && business.website.startsWith('http')) {
    try {
      const scraped = await scrapeWebsiteContact(business.website);
      
      if (scraped.email) contact.email = scraped.email;
      if (scraped.phone) contact.phone = scraped.phone;
      if (scraped.whatsapp) contact.whatsapp = scraped.whatsapp;
      if (scraped.contactForm) contact.contactForm = scraped.contactForm;
      
      Object.keys(scraped.social).forEach(key => {
        if (scraped.social[key]) contact.social[key] = scraped.social[key];
      });
      
    } catch (error) {
      console.error(`  ❌ Erro ao scrapar: ${error.message}`);
    }
  } else {
    // SEM WEBSITE: Busca via Google
    console.log('  ⚠️ Sem website - buscando via Google');
    try {
      const googleData = await searchBusinessOnGoogle(business.name, business.city);
      
      if (googleData.social) {
        Object.keys(googleData.social).forEach(key => {
          if (googleData.social[key]) contact.social[key] = googleData.social[key];
        });
      }
      if (googleData.website) contact.website = googleData.website;
    } catch (error) {
      console.error(`  ❌ Erro na busca Google: ${error.message}`);
    }
  }

  // Google Maps link (sempre disponível)
  contact.googleMaps = `https://www.google.com/maps/search/${encodeURIComponent(business.name + ' ' + (business.city || ''))}`;

  // Fallback: Link do Google Search
  if (!contact.email && !contact.phone && !contact.whatsapp && 
      !Object.values(contact.social).some(v => v)) {
    contact.fallback = `https://www.google.com/search?q=${encodeURIComponent(business.name + ' ' + (business.city || '') + ' contact')}`;
    console.log('  ⚠️ Nenhum contato direto - usando fallback Google');
  } else {
    const found = [];
    if (contact.email) found.push('email');
    if (contact.phone) found.push('phone');
    if (contact.whatsapp) found.push('whatsapp');
    Object.keys(contact.social).forEach(k => {
      if (contact.social[k]) found.push(k);
    });
    console.log(`  ✅ Contatos encontrados: ${found.join(', ')}`);
  }

  return contact;
}

// Buscar empresa no Google (quando não tem website)
async function searchBusinessOnGoogle(businessName, city) {
  const query = encodeURIComponent(`${businessName} ${city} instagram facebook linkedin`);
  const searchUrl = `https://www.google.com/search?q=${query}`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 8000
    });

    const html = await response.text();
    
    const social = {
      instagram: extractSocialLink(html, 'instagram.com'),
      facebook: extractSocialLink(html, 'facebook.com'),
      linkedin: extractSocialLink(html, 'linkedin.com'),
      twitter: extractSocialLink(html, 'twitter.com') || extractSocialLink(html, 'x.com'),
      youtube: extractSocialLink(html, 'youtube.com'),
      tiktok: extractSocialLink(html, 'tiktok.com')
    };

    const websiteRegex = /https?:\/\/(?:www\.)?([a-z0-9-]+\.(?:com|com\.br|net|org|br))/gi;
    const websites = html.match(websiteRegex) || [];
    const website = websites.find(w => 
      !w.includes('google') && 
      !w.includes('facebook') && 
      !w.includes('instagram') &&
      !w.includes('linkedin')
    ) || null;

    return { social, website };
  } catch (error) {
    console.error('  ❌ Erro Google search:', error.message);
    return { social: {}, website: null };
  }
}

// Scraping do website
async function scrapeWebsiteContact(website) {
  const response = await fetch(website, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeLead/1.0)' }
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  // EMAIL
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex) || [];
  const validEmails = emails.filter(e => 
    !e.includes('example.com') && 
    !e.includes('yoursite.com') &&
    !e.includes('placeholder') &&
    !e.includes('test.com') &&
    !e.includes('@sentry') &&
    !e.includes('noreply')
  );
  const email = validEmails[0] || null;

  // TELEFONE (BR e US)
  const phoneRegex = /(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}|(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = html.match(phoneRegex) || [];
  const phone = phones[0] || null;

  // WHATSAPP
  const whatsappRegex = /wa\.me\/(\d+)|whatsapp.*?(\d{10,})/gi;
  const whatsappMatch = html.match(whatsappRegex);
  const whatsapp = whatsappMatch ? whatsappMatch[0] : null;

  // REDES SOCIAIS
  const social = {
    linkedin: extractSocialLink(html, 'linkedin.com'),
    facebook: extractSocialLink(html, 'facebook.com'),
    instagram: extractSocialLink(html, 'instagram.com'),
    twitter: extractSocialLink(html, 'twitter.com') || extractSocialLink(html, 'x.com'),
    youtube: extractSocialLink(html, 'youtube.com'),
    tiktok: extractSocialLink(html, 'tiktok.com')
  };

  // FORMULÁRIO DE CONTATO
  const contactForm = findContactPage($, website);

  return { email, phone, whatsapp, social, contactForm };
}

// Extrair links de redes sociais
function extractSocialLink(html, platform) {
  const regex = new RegExp(`https?://(?:www\.)?${platform.replace('.', '\\.')}/[^\\s"'<>)]+`, 'i');
  const match = html.match(regex);
  if (match) {
    let url = match[0];
    url = url.replace(/[,;)]$/, '');
    return url;
  }
  return null;
}

// Encontrar página de contato
function findContactPage($, baseUrl) {
  const contactLinks = $('a').filter((i, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href') || '';
    return text.includes('contact') || 
           text.includes('get in touch') || 
           text.includes('contato') ||
           href.includes('contact') ||
           href.includes('contato');
  });
  
  if (contactLinks.length > 0) {
    const href = contactLinks.first().attr('href');
    if (href) {
      try {
        return href.startsWith('http') ? href : new URL(href, baseUrl).href;
      } catch {
        return null;
      }
    }
  }
  
  return null;
}

module.exports = { 
  getBusinessContact,
  scrapeWebsiteContact
};
