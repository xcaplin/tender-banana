/**
 * Tender Data Fetcher Service
 *
 * Fetches live tender data from UK government procurement sources:
 * - Contracts Finder API (https://www.contractsfinder.service.gov.uk)
 * - Find a Tender Service (https://www.find-tender.service.gov.uk)
 *
 * Note: Direct browser calls may face CORS issues. Consider using a CORS proxy
 * or implementing a backend proxy service for production use.
 */

// Configuration
const CONFIG = {
  CONTRACTS_FINDER_API: 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCID/Search',
  FIND_A_TENDER_API: 'https://www.find-tender.service.gov.uk/api/1.0/notices',
  CORS_PROXY: 'https://corsproxy.io/?', // CORS proxy for development
  USE_CORS_PROXY: true, // Toggle CORS proxy usage
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
  RATE_LIMIT_DELAY: 1000, // 1 second between API calls
}

// Cache management
let lastFetchTime = 0

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
 * Rate limiting - ensure minimum delay between API calls
 */
const rateLimitDelay = async () => {
  const now = Date.now()
  const timeSinceLastFetch = now - lastFetchTime

  if (timeSinceLastFetch < CONFIG.RATE_LIMIT_DELAY) {
    const delay = CONFIG.RATE_LIMIT_DELAY - timeSinceLastFetch
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  lastFetchTime = Date.now()
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
 * Fetch tenders from Contracts Finder API
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
export const fetchContractsFinderTenders = async (params = {}) => {
  try {
    const cacheKey = `cf_tenders_${JSON.stringify(params)}`

    // Check cache first
    if (isCacheValid(cacheKey)) {
      console.log('Returning cached Contracts Finder data')
      return getCachedData(cacheKey)
    }

    // Rate limiting
    await rateLimitDelay()

    // Build query parameters
    const queryParams = new URLSearchParams()
    if (params.keywords) queryParams.append('keywords', params.keywords)
    if (params.location) queryParams.append('location', params.location)
    if (params.minValue) queryParams.append('minValue', params.minValue)
    if (params.maxValue) queryParams.append('maxValue', params.maxValue)
    if (params.publishedFrom) queryParams.append('publishedFrom', params.publishedFrom)
    if (params.publishedTo) queryParams.append('publishedTo', params.publishedTo)

    const url = `${CONFIG.CONTRACTS_FINDER_API}?${queryParams.toString()}`
    const proxiedUrl = buildProxiedUrl(url)

    console.log('Fetching from Contracts Finder API:', url)

    const response = await fetch(proxiedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Contracts Finder API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Parse and map to our tender structure
    const tenders = parseContractsFinderData(data)

    // Cache the results
    setCachedData(cacheKey, tenders)

    return tenders
  } catch (error) {
    console.error('Error fetching Contracts Finder tenders:', error)

    // Return user-friendly error message
    if (error.message.includes('CORS')) {
      console.warn('CORS error detected. Consider using a backend proxy or enabling CORS proxy.')
    }

    return []
  }
}

/**
 * Parse Contracts Finder API response
 */
const parseContractsFinderData = (data) => {
  try {
    // Contracts Finder API structure may vary
    // This is a generic parser that handles common response formats
    const notices = data.results || data.notices || data || []

    return notices.map((notice, index) => ({
      id: notice.ocid || notice.id || `CF-${Date.now()}-${index}`,
      title: notice.title || notice.name || 'Untitled Tender',
      organization: notice.buyer?.name || notice.organisation || 'Unknown Organization',
      value: parseValue(notice.value || notice.minValue || notice.estimatedValue),
      deadline: parseDate(notice.closing || notice.deadline || notice.closingDate),
      status: 'new',
      summary: notice.description || notice.summary || 'No summary available',
      detailedDescription: notice.description || notice.summary || 'No detailed description available',
      url: notice.url || notice.link || `https://www.contractsfinder.service.gov.uk/notice/${notice.id}`,
      region: notice.region || extractRegion(notice.buyer?.address) || 'UK',
      categories: extractCategories(notice),
      source: 'Contracts Finder',
      fetchedAt: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Error parsing Contracts Finder data:', error)
    return []
  }
}

/**
 * Fetch tenders from Find a Tender Service (FTS)
 *
 * @param {Object} params - Search parameters
 * @returns {Promise<Array>} Array of tender objects
 */
export const fetchFindATenderData = async (params = {}) => {
  try {
    const cacheKey = `fts_tenders_${JSON.stringify(params)}`

    // Check cache first
    if (isCacheValid(cacheKey)) {
      console.log('Returning cached Find a Tender data')
      return getCachedData(cacheKey)
    }

    // Rate limiting
    await rateLimitDelay()

    // Build query parameters
    const queryParams = new URLSearchParams()
    if (params.keywords) queryParams.append('q', params.keywords)
    if (params.publishedFrom) queryParams.append('publishedFrom', params.publishedFrom)
    if (params.publishedTo) queryParams.append('publishedTo', params.publishedTo)

    const url = `${CONFIG.FIND_A_TENDER_API}?${queryParams.toString()}`
    const proxiedUrl = buildProxiedUrl(url)

    console.log('Fetching from Find a Tender API:', url)

    const response = await fetch(proxiedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Find a Tender API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Parse and map to our tender structure
    const tenders = parseFindATenderData(data)

    // Cache the results
    setCachedData(cacheKey, tenders)

    return tenders
  } catch (error) {
    console.error('Error fetching Find a Tender data:', error)

    if (error.message.includes('CORS')) {
      console.warn('CORS error detected. Consider using a backend proxy or enabling CORS proxy.')
    }

    return []
  }
}

/**
 * Parse Find a Tender API response
 */
const parseFindATenderData = (data) => {
  try {
    const notices = data.results || data.notices || data || []

    return notices.map((notice, index) => ({
      id: notice.ocid || notice.id || `FTS-${Date.now()}-${index}`,
      title: notice.title || 'Untitled Tender',
      organization: notice.organisation?.name || notice.buyer?.name || 'Unknown Organization',
      value: parseValue(notice.value || notice.estimatedValue),
      deadline: parseDate(notice.deadline || notice.closingDate),
      status: 'new',
      summary: notice.description || 'No summary available',
      detailedDescription: notice.description || 'No detailed description available',
      url: notice.url || `https://www.find-tender.service.gov.uk/Notice/${notice.id}`,
      region: notice.region || 'UK',
      categories: extractCategories(notice),
      source: 'Find a Tender',
      fetchedAt: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Error parsing Find a Tender data:', error)
    return []
  }
}

/**
 * Merge tender data from multiple sources and remove duplicates
 *
 * @param {Array} contractsFinderData - Tenders from Contracts Finder
 * @param {Array} findATenderData - Tenders from Find a Tender
 * @returns {Array} Merged and deduplicated tender array
 */
export const mergeTenderData = (contractsFinderData, findATenderData) => {
  try {
    const allTenders = [...contractsFinderData, ...findATenderData]

    // Remove duplicates by matching title + organization
    const uniqueTenders = []
    const seen = new Set()

    for (const tender of allTenders) {
      const key = `${tender.title.toLowerCase().trim()}|${tender.organization.toLowerCase().trim()}`

      if (!seen.has(key)) {
        seen.add(key)
        uniqueTenders.push(tender)
      } else {
        console.log('Duplicate tender removed:', tender.title)
      }
    }

    console.log(`Merged ${allTenders.length} tenders, removed ${allTenders.length - uniqueTenders.length} duplicates`)

    return uniqueTenders
  } catch (error) {
    console.error('Error merging tender data:', error)
    return []
  }
}

/**
 * Enrich tender with AI-generated strategic fit analysis
 *
 * TODO: Integrate with Claude API to generate:
 * - alignment_score (based on Sirona's service portfolio)
 * - rationale
 * - win_themes
 * - competitors
 * - weak_spots
 * - recommendation
 *
 * For now, returns placeholder data.
 *
 * FUTURE IMPLEMENTATION:
 * - Use Anthropic API to analyze tender against Sirona's capabilities
 * - Consider: community health, NHS services, BNSSG region
 * - Generate strategic recommendations based on tender requirements
 * - Identify competitive advantages and risk factors
 *
 * @param {Object} tender - Tender object to enrich
 * @returns {Object} Tender with sirona_fit data
 */
export const enrichTenderWithAI = async (tender) => {
  try {
    // TODO: Replace with actual Claude API call
    // Example API structure:
    // const response = await fetch('https://api.anthropic.com/v1/messages', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'x-api-key': API_KEY,
    //     'anthropic-version': '2023-06-01'
    //   },
    //   body: JSON.stringify({
    //     model: 'claude-3-5-sonnet-20241022',
    //     max_tokens: 1024,
    //     messages: [{
    //       role: 'user',
    //       content: `Analyze this tender for Sirona Care & Health: ${JSON.stringify(tender)}`
    //     }]
    //   })
    // })

    // Placeholder sirona_fit data
    const placeholderFit = {
      alignment_score: Math.floor(Math.random() * 30) + 60, // 60-90%
      recommendation: getRandomRecommendation(),
      rationale: 'AI analysis pending - placeholder data. This tender will be analyzed against Sirona\'s service portfolio once AI integration is complete.',
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
        'AI analysis not yet implemented',
        'Strategic fit to be determined',
        'Detailed requirements need review'
      ]
    }

    return {
      ...tender,
      sirona_fit: placeholderFit
    }
  } catch (error) {
    console.error('Error enriching tender with AI:', error)

    // Return tender with minimal sirona_fit data
    return {
      ...tender,
      sirona_fit: {
        alignment_score: 50,
        recommendation: 'Monitor',
        rationale: 'Unable to analyze - error occurred',
        win_themes: [],
        competitors: [],
        weak_spots: ['Analysis failed']
      }
    }
  }
}

/**
 * Main orchestration function to fetch and process all tender data
 *
 * @param {Object} searchParams - Search parameters for APIs
 * @returns {Promise<Array>} Complete tender array ready for dashboard
 */
export const fetchAndProcessTenders = async (searchParams = {}) => {
  try {
    console.log('Starting tender data fetch and processing...')

    // Fetch from both sources in parallel
    const [contractsFinderData, findATenderData] = await Promise.all([
      fetchContractsFinderTenders(searchParams),
      fetchFindATenderData(searchParams)
    ])

    console.log(`Fetched ${contractsFinderData.length} tenders from Contracts Finder`)
    console.log(`Fetched ${findATenderData.length} tenders from Find a Tender`)

    // Merge and deduplicate
    const mergedTenders = mergeTenderData(contractsFinderData, findATenderData)

    // Enrich each tender with AI analysis
    const enrichedTenders = await Promise.all(
      mergedTenders.map(tender => enrichTenderWithAI(tender))
    )

    console.log(`Successfully processed ${enrichedTenders.length} tenders`)

    return enrichedTenders
  } catch (error) {
    console.error('Error in fetchAndProcessTenders:', error)
    return []
  }
}

// Helper functions

/**
 * Parse value from various formats to number
 */
const parseValue = (value) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[£$,]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  if (value?.amount) return parseFloat(value.amount)
  return 0
}

/**
 * Parse date from various formats to ISO string
 */
const parseDate = (dateValue) => {
  if (!dateValue) {
    // Default to 30 days from now if no deadline
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    return defaultDate.toISOString()
  }

  try {
    const date = new Date(dateValue)
    return date.toISOString()
  } catch (error) {
    console.error('Error parsing date:', error)
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    return defaultDate.toISOString()
  }
}

/**
 * Extract region from address object
 */
const extractRegion = (address) => {
  if (!address) return 'UK'
  return address.region || address.locality || address.city || 'UK'
}

/**
 * Extract categories from tender notice
 */
const extractCategories = (notice) => {
  const categories = []

  // Extract from CPV codes or classifications
  if (notice.classification || notice.cpv) {
    const classification = notice.classification || notice.cpv
    if (classification.includes('health') || classification.includes('Health')) {
      categories.push('Healthcare')
    }
    if (classification.includes('social') || classification.includes('Social')) {
      categories.push('Social Care')
    }
  }

  // Extract from title and description
  const text = `${notice.title || ''} ${notice.description || ''}`.toLowerCase()

  if (text.includes('health') || text.includes('nhs')) {
    categories.push('Healthcare')
  }
  if (text.includes('community')) {
    categories.push('Community Services')
  }
  if (text.includes('mental health')) {
    categories.push('Mental Health')
  }
  if (text.includes('children') || text.includes('young people')) {
    categories.push('Children & Young People')
  }
  if (text.includes('rehabilitation') || text.includes('therapy')) {
    categories.push('Rehabilitation')
  }
  if (text.includes('dental')) {
    categories.push('Dental Services')
  }

  // Default category if none found
  if (categories.length === 0) {
    categories.push('Other')
  }

  return [...new Set(categories)] // Remove duplicates
}

/**
 * Get random recommendation for placeholder
 */
const getRandomRecommendation = () => {
  const recommendations = ['Strong Go', 'Conditional Go', 'Monitor', 'No Bid']
  const weights = [0.3, 0.4, 0.2, 0.1] // Probability weights

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

// Export configuration for external use
export const getConfig = () => ({ ...CONFIG })

export const updateConfig = (updates) => {
  Object.assign(CONFIG, updates)
}
