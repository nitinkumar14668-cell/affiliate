// api/products.js - Vercel serverless function
// Scrapes Amazon product details from URLs given in link.txt

const fs = require('fs');
const path = require('path');

// Helper: fetch HTML with proper headers
async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

// Extract product details from Amazon HTML
function parseAmazonProduct(html, originalUrl) {
  // Helper to get meta tag content
  const getMeta = (name) => {
    const match = html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i'));
    return match ? match[1] : null;
  };

  // Title
  let title = getMeta('title') || '';
  if (!title) {
    const titleMatch = html.match(/<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
    if (titleMatch) title = titleMatch[1].trim();
    else {
      const ogTitle = getMeta('og:title');
      if (ogTitle) title = ogTitle;
    }
  }
  title = title.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // Image
  let image = getMeta('og:image');
  if (!image) {
    const imgMatch = html.match(/"large":"([^"]+)"/);
    if (imgMatch) image = imgMatch[1];
    else {
      const imgTag = html.match(/<img[^>]+id="landingImage"[^>]+src="([^"]+)"/);
      if (imgTag) image = imgTag[1];
    }
  }

  // Price
  let price = null;
  const priceMatch = html.match(/<span class="a-price-whole">(\d+)[^<]*<\/span><span class="a-price-fraction">(\d+)<\/span>/);
  if (priceMatch) price = `₹${priceMatch[1]}.${priceMatch[2]}`;
  else {
    const priceWhole = html.match(/"priceAmount":"([\d.]+)"/);
    if (priceWhole) price = `₹${priceWhole[1]}`;
    else {
      const simplePrice = html.match(/<span class="a-offscreen">([^<]+)<\/span>/);
      if (simplePrice) price = simplePrice[1];
    }
  }
  if (!price) price = 'Price not available';

  // Rating
  let rating = null;
  const ratingMatch = html.match(/<span class="a-icon-alt">([\d.]+) out of 5 stars<\/span>/);
  if (ratingMatch) rating = parseFloat(ratingMatch[1]);
  else {
    const ratingJson = html.match(/"rating":([\d.]+)/);
    if (ratingJson) rating = parseFloat(ratingJson[1]);
  }
  if (!rating) rating = 4.0;

  // Description (short)
  let description = '';
  const descMatch = html.match(/<div id="productDescription"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (descMatch) description = descMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 120);
  else {
    const bulletPoints = html.match(/<div id="feature-bullets"[^>]*>[\s\S]*?<li>([\s\S]*?)<\/li>/i);
    if (bulletPoints) description = bulletPoints[1].replace(/<[^>]*>/g, '').trim().substring(0, 120);
  }
  if (!description) description = 'Premium product on Amazon';

  return {
    image: image || 'https://via.placeholder.com/400x260?text=No+Image',
    name: title || 'Amazon Product',
    price: price,
    description: description,
    rating: rating,
    link: originalUrl
  };
}

module.exports = async (req, res) => {
  // Enable CORS for frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Read link.txt from the project root (Vercel: process.cwd() is the deployment root)
    const txtPath = path.join(process.cwd(), 'link.txt');
    let links = [];
    if (fs.existsSync(txtPath)) {
      const content = fs.readFileSync(txtPath, 'utf-8');
      links = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    } else {
      return res.status(404).json({ error: 'link.txt not found' });
    }

    const products = [];
    for (const url of links) {
      try {
        console.log(`Scraping: ${url}`);
        const html = await fetchHTML(url);
        const product = parseAmazonProduct(html, url);
        products.push(product);
      } catch (err) {
        console.error(`Failed to scrape ${url}:`, err.message);
        products.push({
          image: 'https://via.placeholder.com/400x260?text=Error',
          name: 'Failed to load product',
          price: 'N/A',
          description: `Could not fetch: ${err.message}`,
          rating: 0,
          link: url
        });
      }
    }
    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
