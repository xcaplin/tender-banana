/**
 * Tender Data Fetcher Service
 *
 * Fetches live tender data from UK government Contracts Finder using the Open Contracting Data Standard (OCDS) API.
 * Data sourced from: https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search
 *
 * Uses CORS proxy for browser-based access to public OCDS data.
 */

// Configuration
const CONFIG = {
  OCDS_API_BASE: 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search',
  CORS_PROXY: 'https://corsproxy.io/?',
  USE_CORS_PROXY: true,
  CACHE_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
  DEFAULT_LIMIT: 100, // Number of records to fetch per request
  MAX_RETRIES: 2,
}

/**
 * Check if cached data is still valid
 */
const isCacheValid = (cacheKey) => {
  const cached = sessionStorage.getItem(cacheKey)
  if (!cached) return false

  try {
    const { timestamp } = JSON.parse(cached)
    return Date.now() - timestamp < CONFIG.CACHE_DURATION
  } catch (error) {
    console.error('Error reading cache:', error)
    return false
  }
}

/**
 * Get cached data
 */
const getCachedData = (cacheKey) => {
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (!cached) return null

    const { data } = JSON.parse(cached)
    return data
  } catch (error) {
    console.error('Error parsing cached data:', error)
    return null
  }
}

/**
 * Set cached data
 */
const setCachedData = (cacheKey, data) => {
  try {
    const cacheObject = {
      timestamp: Date.now(),
      data
    }
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheObject))
  } catch (error) {
    console.error('Error setting cache:', error)
  }
}

/**
 * Build URL with CORS proxy if enabled
 */
const buildProxiedUrl = (url) => {
  if (CONFIG.USE_CORS_PROXY && CONFIG.CORS_PROXY) {
    return CONFIG.CORS_PROXY + encodeURIComponent(url)
  }
  return url
}

/**
 * Fetch tenders from Contracts Finder OCDS API
 *
 * @param {Object} params - Search parameters
 * @param {string} params.keywords - Search keywords
 * @param {string} params.location - Location/region filter
 * @param {number} params.minValue - Minimum contract value
 * @param {number} params.maxValue - Maximum contract value
 * @param {string} params.publishedFrom - Start date (YYYY-MM-DD)
 * @param {string} params.publishedTo - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of tender objects
 */
export const fetchOCDSTenders = async (params = {}, retryCount = 0) => {
  try {
    const cacheKey = `ocds_tenders_${JSON.stringify(params)}`

    // Check cache first
    if (isCacheValid(cacheKey)) {
      console.log('Returning cached OCDS data')
      const cachedData = getCachedData(cacheKey)
      return cachedData || []
    }

    // Set default date range if not provided (last 90 days)
    const today = new Date()
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(today.getDate() - 90)

    const publishedFrom = params.publishedFrom || ninetyDaysAgo.toISOString().split('T')[0]
    const publishedTo = params.publishedTo || today.toISOString().split('T')[0]

    // Build query parameters for OCDS API
    const queryParams = new URLSearchParams({
      publishedFrom: publishedFrom,
      publishedTo: publishedTo,
      limit: CONFIG.DEFAULT_LIMIT.toString()
    })

    const url = `${CONFIG.OCDS_API_BASE}?${queryParams.toString()}`
    const proxiedUrl = buildProxiedUrl(url)

    console.log('Fetching from Contracts Finder OCDS API:', url)
    console.log('Date range:', publishedFrom, 'to', publishedTo)

    const response = await fetch(proxiedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`OCDS API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Debug logging to test API response
    console.log('OCDS API Response:', {
      url: proxiedUrl,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      dataStructure: Object.keys(data),
      firstRelease: data.releases?.[0]
    })

    // Parse and map to our tender structure
    let tenders = parseOCDSResponse(data, params)

    // Apply client-side filtering
    tenders = applyFilters(tenders, params)

    console.log(`Successfully fetched and filtered ${tenders.length} tenders from OCDS API`)

    // Cache the results
    setCachedData(cacheKey, tenders)

    return tenders

  } catch (error) {
    console.error('Error fetching OCDS tenders:', error)

    // Retry logic
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`Retrying... Attempt ${retryCount + 1} of ${CONFIG.MAX_RETRIES}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
      return fetchOCDSTenders(params, retryCount + 1)
    }

    // Return empty array on final failure
    return []
  }
}

/**
 * Parse OCDS API response and map to our tender structure
 *
 * OCDS structure:
 * - releases[] array containing tender notices
 * - Each release has: ocid, id, date, buyer, tender, awards, contracts
 *
 * @param {Object} data - OCDS API response
 * @param {Object} params - Original search parameters
 * @returns {Array} Parsed tender objects
 */
const parseOCDSResponse = (data, params) => {
  try {
    // OCDS API returns releases array
    const releases = data.releases || []

    if (releases.length === 0) {
      console.warn('No releases found in OCDS response')
      return []
    }

    console.log(`Parsing ${releases.length} releases from OCDS data`)

    return releases
      .filter(release => release.tender) // Only include releases with tender data
      .map((release, index) => {
        try {
          const tender = release.tender
          const buyer = release.buyer || {}

          // Extract value - OCDS uses tender.value object
          const value = extractValue(tender)

          // Extract deadline - OCDS uses tender.tenderPeriod.endDate
          const deadline = extractDeadline(tender)

          // Build tender URL
          const tenderUrl = buildTenderUrl(release)

          return {
            id: release.ocid || release.id || `OCDS-${Date.now()}-${index}`,
            title: tender.title || 'Untitled Tender',
            organization: buyer.name || 'Unknown Organization',
            value: value,
            deadline: deadline,
            status: 'new',
            summary: tender.description || 'No summary available',
            detailedDescription: tender.description || 'No detailed description available',
            url: tenderUrl,
            region: extractRegion(buyer),
            categories: extractCategories(tender),
            source: 'Contracts Finder (OCDS)',
            fetchedAt: new Date().toISOString(),
            ocid: release.ocid,
            publishedDate: release.date || release.publishedDate,
            // Keep raw OCDS data for reference
            _raw: {
              ocid: release.ocid,
              tender: tender,
              buyer: buyer
            }
          }
        } catch (error) {
          console.error('Error parsing individual release:', error, release)
          return null
        }
      })
      .filter(tender => tender !== null) // Remove any failed parses

  } catch (error) {
    console.error('Error parsing OCDS response:', error)
    return []
  }
}

/**
 * Apply client-side filters to tender data
 * Since OCDS API has limited query parameters, we filter on the client side
 */
const applyFilters = (tenders, params) => {
  let filtered = [...tenders]

  // Keywords filter - search in title and description
  if (params.keywords) {
    const keywords = params.keywords.toLowerCase().split(' ')
    filtered = filtered.filter(tender => {
      const searchText = `${tender.title} ${tender.summary} ${tender.organization}`.toLowerCase()
      return keywords.some(keyword => searchText.includes(keyword))
    })
  }

  // Location filter - search in region and buyer address
  if (params.location) {
    const location = params.location.toLowerCase()
    filtered = filtered.filter(tender => {
      const locationText = `${tender.region} ${tender.organization}`.toLowerCase()
      return locationText.includes(location)
    })
  }

  // Value range filter
  if (params.minValue) {
    filtered = filtered.filter(tender => tender.value >= params.minValue)
  }

  if (params.maxValue) {
    filtered = filtered.filter(tender => tender.value <= params.maxValue)
  }

  console.log(`Filtered ${tenders.length} tenders down to ${filtered.length} matching criteria`)

  return filtered
}

/**
 * Extract value from OCDS tender object
 * OCDS structure: tender.value.amount (number) and tender.value.currency (string)
 */
const extractValue = (tender) => {
  if (!tender) return 0

  // Check tender.value.amount
  if (tender.value && tender.value.amount) {
    return parseFloat(tender.value.amount) || 0
  }

  // Check tender.minValue
  if (tender.minValue && tender.minValue.amount) {
    return parseFloat(tender.minValue.amount) || 0
  }

  // Check tender.estimatedValue
  if (tender.estimatedValue && tender.estimatedValue.amount) {
    return parseFloat(tender.estimatedValue.amount) || 0
  }

  // Default minimum value for tenders
  return 100000
}

/**
 * Extract deadline from OCDS tender object
 * OCDS structure: tender.tenderPeriod.endDate (ISO date string)
 */
const extractDeadline = (tender) => {
  if (!tender) return getDefaultDeadline()

  // Check tender.tenderPeriod.endDate
  if (tender.tenderPeriod && tender.tenderPeriod.endDate) {
    try {
      return new Date(tender.tenderPeriod.endDate).toISOString()
    } catch (error) {
      console.error('Error parsing tenderPeriod.endDate:', error)
    }
  }

  // Check tender.contractPeriod.endDate as fallback
  if (tender.contractPeriod && tender.contractPeriod.endDate) {
    try {
      return new Date(tender.contractPeriod.endDate).toISOString()
    } catch (error) {
      console.error('Error parsing contractPeriod.endDate:', error)
    }
  }

  return getDefaultDeadline()
}

/**
 * Get default deadline (30 days from now)
 */
const getDefaultDeadline = () => {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString()
}

/**
 * Build tender URL from OCDS release
 */
const buildTenderUrl = (release) => {
  // Contracts Finder URLs follow pattern: /Notice/{id}
  if (release.id) {
    return `https://www.contractsfinder.service.gov.uk/Notice/${release.id}`
  }

  // Fallback to OCID-based URL
  if (release.ocid) {
    return `https://www.contractsfinder.service.gov.uk/Search/Results?ocid=${release.ocid}`
  }

  return 'https://www.contractsfinder.service.gov.uk/'
}

/**
 * Extract region from OCDS buyer object
 */
const extractRegion = (buyer) => {
  if (!buyer) return 'UK'

  // Check buyer.address
  if (buyer.address) {
    const address = buyer.address
    return address.region || address.locality || address.countryName || 'UK'
  }

  return 'UK'
}

/**
 * Extract categories from OCDS tender object
 * Uses tender.classification and tender.mainProcurementCategory
 */
const extractCategories = (tender) => {
  const categories = new Set()

  if (!tender) return ['Other']

  // Check mainProcurementCategory
  if (tender.mainProcurementCategory) {
    const category = tender.mainProcurementCategory
    if (category.includes('services') || category.includes('Services')) {
      categories.add('Professional Services')
    }
    if (category.includes('goods') || category.includes('Goods')) {
      categories.add('Goods & Supplies')
    }
    if (category.includes('works') || category.includes('Works')) {
      categories.add('Construction & Works')
    }
  }

  // Check classification (CPV codes)
  if (tender.classification) {
    const classification = tender.classification
    const desc = (classification.description || '').toLowerCase()
    const scheme = classification.scheme || ''

    if (desc.includes('health') || desc.includes('medical')) {
      categories.add('Healthcare')
    }
    if (desc.includes('social')) {
      categories.add('Social Care')
    }
  }

  // Check title and description for keywords
  const text = `${tender.title || ''} ${tender.description || ''}`.toLowerCase()

  if (text.includes('health') || text.includes('nhs') || text.includes('medical')) {
    categories.add('Healthcare')
  }
  if (text.includes('community')) {
    categories.add('Community Services')
  }
  if (text.includes('mental health') || text.includes('mental')) {
    categories.add('Mental Health')
  }
  if (text.includes('children') || text.includes('young people') || text.includes('youth')) {
    categories.add('Children & Young People')
  }
  if (text.includes('rehabilitation') || text.includes('therapy') || text.includes('physiotherapy')) {
    categories.add('Rehabilitation')
  }
  if (text.includes('dental') || text.includes('dentist')) {
    categories.add('Dental Services')
  }
  if (text.includes('care') && !categories.has('Healthcare')) {
    categories.add('Social Care')
  }

  // Return as array, with default if empty
  const categoryArray = Array.from(categories)
  return categoryArray.length > 0 ? categoryArray : ['Other']
}

/**
 * Enrich tender with AI-generated strategic fit analysis
 * Note: This now uses placeholder data. Real AI analysis is done via the Claude analyzer service.
 */
export const enrichTenderWithAI = async (tender) => {
  try {
    // Placeholder sirona_fit data
    // Real AI analysis should use src/services/claudeAnalyzer.js
    const placeholderFit = {
      alignment_score: Math.floor(Math.random() * 30) + 60, // 60-90%
      recommendation: getRandomRecommendation(),
      rationale: 'This tender requires AI analysis. Use the "Analyze This Tender" feature for detailed strategic fit assessment.',
      win_themes: [
        'Community-focused healthcare delivery',
        'Integrated care experience',
        'Local knowledge and presence'
      ],
      competitors: [
        'Local NHS Trusts',
        'Other community health providers',
        'National healthcare organizations'
      ],
      weak_spots: [
        'Competitive landscape to be assessed',
        'Strategic fit requires detailed analysis',
        'Resource requirements need review'
      ],
      categories: tender.categories || []
    }

    return {
      ...tender,
      sirona_fit: placeholderFit
    }
  } catch (error) {
    console.error('Error enriching tender with AI:', error)

    return {
      ...tender,
      sirona_fit: {
        alignment_score: 50,
        recommendation: 'Monitor',
        rationale: 'Unable to generate initial analysis',
        win_themes: [],
        competitors: [],
        weak_spots: ['Analysis pending'],
        categories: tender.categories || []
      }
    }
  }
}

/**
 * Get random recommendation for placeholder
 */
const getRandomRecommendation = () => {
  const recommendations = ['Strong Go', 'Conditional Go', 'Monitor', 'No Bid']
  const weights = [0.25, 0.35, 0.30, 0.10] // Probability weights

  const random = Math.random()
  let cumulative = 0

  for (let i = 0; i < recommendations.length; i++) {
    cumulative += weights[i]
    if (random < cumulative) {
      return recommendations[i]
    }
  }

  return 'Monitor'
}

/**
 * Main orchestration function to fetch and process tender data
 *
 * @param {Object} searchParams - Search parameters for API
 * @returns {Promise<Array>} Complete tender array ready for dashboard
 */
export const fetchAndProcessTenders = async (searchParams = {}) => {
  try {
    console.log('Starting OCDS tender data fetch and processing...')
    console.log('Search parameters:', searchParams)

    // Fetch from OCDS API
    const ocdsTenders = await fetchOCDSTenders(searchParams)

    console.log(`Fetched ${ocdsTenders.length} tenders from OCDS API`)

    if (ocdsTenders.length === 0) {
      console.warn('No tenders returned from OCDS API. Try adjusting your search parameters.')
      return []
    }

    // Enrich each tender with placeholder AI analysis
    const enrichedTenders = await Promise.all(
      ocdsTenders.map(tender => enrichTenderWithAI(tender))
    )

    console.log(`Successfully processed ${enrichedTenders.length} tenders`)

    return enrichedTenders
  } catch (error) {
    console.error('Error in fetchAndProcessTenders:', error)
    return []
  }
}

// Export configuration for external use
export const getConfig = () => ({ ...CONFIG })

export const updateConfig = (updates) => {
  Object.assign(CONFIG, updates)
}
