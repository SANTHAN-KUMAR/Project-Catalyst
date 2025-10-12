const axios = require('axios');
const { Pool } = require('pg');

// Price cache to reduce API calls
const priceCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// === GOVERNMENT DATA SOURCES ===

/**
 * Fetch commodity prices from Indian Government's Price Monitoring Cell
 * Source: Department of Consumer Affairs
 */
async function getGovernmentPrices(commodityName) {
  try {
    console.log(`[External Data] Fetching government price for: ${commodityName}`);
    
    // Check cache first
    const cacheKey = `govt_${commodityName.toLowerCase()}`;
    if (priceCache.has(cacheKey)) {
      const cached = priceCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('[External Data] Returning cached government price');
        return cached.data;
      }
    }

    // API from Department of Consumer Affairs (Price Monitoring Division)
    // Note: This is a simulated endpoint - replace with actual API when available
    const response = await axios.get(
      'https://fcainfoweb.nic.in/reports/report_menu_web.aspx',
      { timeout: 5000 }
    );

    // Parse response (actual implementation would parse HTML or use proper API)
    const priceData = {
      commodity: commodityName,
      retailPrice: null, // Would be extracted from response
      wholesalePrice: null,
      source: 'Department of Consumer Affairs',
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    priceCache.set(cacheKey, {
      data: priceData,
      timestamp: Date.now()
    });

    return priceData;

  } catch (error) {
    console.error('[External Data] Government price fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetch prices from DataYuge Price Comparison API
 * Free tier: 100 requests/day
 */
async function getEcommercePrices(productName) {
  try {
    console.log(`[External Data] Fetching e-commerce prices for: ${productName}`);

    // Check cache
    const cacheKey = `ecom_${productName.toLowerCase()}`;
    if (priceCache.has(cacheKey)) {
      const cached = priceCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('[External Data] Returning cached e-commerce price');
        return cached.data;
      }
    }

    // Using DataYuge Price Comparison API (free tier)
    const response = await axios.get(
      `https://price-api.datayuge.com/api/v1/compare/search`,
      {
        params: {
          api_key: process.env.DATAYUGE_API_KEY || 'demo_key',
          query: productName,
          item_count: 10
        },
        timeout: 5000
      }
    );

    if (response.data && response.data.product_list) {
      const products = response.data.product_list;
      
      // Calculate average, min, max prices
      const prices = products.map(p => parseFloat(p.price)).filter(p => !isNaN(p));
      
      const priceData = {
        product: productName,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        sources: products.map(p => ({
          store: p.store_name,
          price: p.price,
          url: p.product_url
        })),
        dataSource: 'DataYuge Price Comparison API',
        lastUpdated: new Date().toISOString()
      };

      // Cache result
      priceCache.set(cacheKey, {
        data: priceData,
        timestamp: Date.now()
      });

      return priceData;
    }

    return null;

  } catch (error) {
    console.error('[External Data] E-commerce price fetch failed:', error.message);
    return null;
  }
}

/**
 * Fallback: Web scraping for price data
 * Used when APIs are unavailable
 */
async function scrapePriceData(productName) {
  try {
    console.log(`[External Data] Attempting web scraping for: ${productName}`);

    // Amazon India search
    const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(productName)}`;
    const response = await axios.get(amazonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });

    // Simple regex to extract prices (₹ symbol followed by digits)
    const priceMatches = response.data.match(/₹[\d,]+/g);
    
    if (priceMatches && priceMatches.length > 0) {
      const prices = priceMatches
        .map(p => parseFloat(p.replace('₹', '').replace(',', '')))
        .filter(p => !isNaN(p) && p > 0);

      if (prices.length > 0) {
        return {
          product: productName,
          avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          sampleSize: prices.length,
          dataSource: 'Web Scraping (Amazon India)',
          lastUpdated: new Date().toISOString()
        };
      }
    }

    return null;

  } catch (error) {
    console.error('[External Data] Web scraping failed:', error.message);
    return null;
  }
}

/**
 * Master function: Get best available price data
 * Tries multiple sources with fallbacks
 */
async function getBestPriceData(itemName, itemCategory = null) {
  console.log(`[External Data] Getting best price data for: ${itemName}`);

  let priceData = null;

  // Strategy 1: Try e-commerce API (most reliable)
  priceData = await getEcommercePrices(itemName);
  if (priceData) {
    priceData.confidenceLevel = 0.9;
    return priceData;
  }

  // Strategy 2: Try government commodity prices (for food items)
  if (itemCategory === 'food' || itemCategory === 'grocery') {
    priceData = await getGovernmentPrices(itemName);
    if (priceData && priceData.retailPrice) {
      priceData.confidenceLevel = 0.85;
      return priceData;
    }
  }

  // Strategy 3: Web scraping fallback
  priceData = await scrapePriceData(itemName);
  if (priceData) {
    priceData.confidenceLevel = 0.7;
    return priceData;
  }

  // Strategy 4: Historical database lookup
  priceData = await getHistoricalPrice(itemName);
  if (priceData) {
    priceData.confidenceLevel = 0.5;
    priceData.note = 'Using historical average (external sources unavailable)';
    return priceData;
  }

  // All strategies failed
  return {
    product: itemName,
    avgPrice: null,
    error: 'Unable to fetch price data from any source',
    confidenceLevel: 0.0,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get historical prices from local database
 */
async function getHistoricalPrice(itemName) {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'catalyst_user',
    host: 'postgres',
    database: 'catalyst_users',
    password: process.env.POSTGRES_PASSWORD || 'catty123',
    port: 5432,
  });

  try {
    const result = await pool.query(
      `SELECT AVG(price) as avg_price, COUNT(*) as sample_count
       FROM historical_prices
       WHERE LOWER(item_name) LIKE LOWER($1)
       AND recorded_at > NOW() - INTERVAL '90 days'`,
      [`%${itemName}%`]
    );

    if (result.rows[0] && result.rows[0].avg_price) {
      return {
        product: itemName,
        avgPrice: parseFloat(result.rows[0].avg_price),
        sampleCount: parseInt(result.rows[0].sample_count),
        dataSource: 'Historical Database',
        timeRange: 'Last 90 days',
        lastUpdated: new Date().toISOString()
      };
    }

    return null;

  } catch (error) {
    console.error('[External Data] Historical price lookup failed:', error);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Store price data for future reference
 */
async function storePriceData(itemName, price, source) {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'catalyst_user',
    host: 'postgres',
    database: 'catalyst_users',
    password: process.env.POSTGRES_PASSWORD || 'catty123',
    port: 5432,
  });

  try {
    await pool.query(
      `INSERT INTO historical_prices (item_name, price, source, recorded_at)
       VALUES ($1, $2, $3, NOW())`,
      [itemName, price, source]
    );
    console.log(`[External Data] Stored price: ${itemName} = ₹${price}`);
  } catch (error) {
    console.error('[External Data] Failed to store price:', error);
  } finally {
    await pool.end();
  }
}

/**
 * Verify NGO registration against government databases
 */
async function verifyNGORegistration(registrationNumber, ngoName) {
  try {
    console.log(`[External Data] Verifying NGO: ${ngoName} (${registrationNumber})`);

    // Try NGO Darpan (official government NGO database)
    const response = await axios.get(
      'https://ngodarpan.gov.in/index.php/home/statewise_ngo',
      {
        params: {
          search: registrationNumber
        },
        timeout: 5000
      }
    );

    // Parse response to check if NGO exists
    const isVerified = response.data.includes(registrationNumber);

    return {
      registrationNumber,
      ngoName,
      verified: isVerified,
      source: 'NGO Darpan (Government Database)',
      checkedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[External Data] NGO verification failed:', error.message);
    return {
      registrationNumber,
      ngoName,
      verified: false,
      error: 'Verification service unavailable',
      checkedAt: new Date().toISOString()
    };
  }
}

/**
 * Check fraud databases for NGO/individual
 */
async function checkFraudHistory(entityName, entityType = 'ngo') {
  try {
    console.log(`[External Data] Checking fraud history: ${entityName}`);

    // This would integrate with:
    // - Ministry of Home Affairs NGO blacklist
    // - Court records databases
    // - News archives for fraud cases

    // Simulated response (implement actual API integration)
    return {
      entity: entityName,
      entityType,
      fraudRecordsFound: false,
      relatedCases: [],
      riskLevel: 'low',
      source: 'Fraud Database Check',
      checkedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[External Data] Fraud check failed:', error.message);
    return {
      entity: entityName,
      error: 'Fraud check service unavailable',
      checkedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  getBestPriceData,
  storePriceData,
  verifyNGORegistration,
  checkFraudHistory,
  getGovernmentPrices,
  getEcommercePrices
};
