// link.js - Fetches affiliate links from link.txt
let cachedLinks = [];

async function loadAffiliateLinks() {
  try {
    const response = await fetch('link.txt');
    if (!response.ok) throw new Error('Failed to load link.txt');
    const text = await response.text();
    // Split by newline and filter out empty lines
    cachedLinks = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log('✅ Affiliate links loaded:', cachedLinks);
    return cachedLinks;
  } catch (error) {
    console.error('❌ Error loading link.txt:', error);
    // Fallback dummy links (so buttons still work)
    cachedLinks = [
      '#',
      '#',
      '#',
      '#',
      '#',
      '#'
    ];
    return cachedLinks;
  }
}

function getAffiliateLinks() {
  return cachedLinks;
}

// Expose for global use
window.getAffiliateLinks = getAffiliateLinks;
window.loadAffiliateLinks = loadAffiliateLinks;
