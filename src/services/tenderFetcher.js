/**
 * Tender Fetcher Service - OCDS CSV Direct Download Method
 *
 * Downloads daily CSV files from data.gov.uk's S3 bucket
 * No CORS issues, no proxies needed
 * Data updated daily with all UK Contracts Finder notices
 */

// S3 base URL for OCDS CSV files
const S3_BASE_URL = 'https://cdp-sirsi-production-cfs-471112843276.s3.eu-west-2.amazonaws.com/Harvester-new'

/**
 * Generate URLs for CSV files covering the last N days
 */
function generateCSVUrls(daysBack = 30) {
  const urls = []
  const today = new Date()

  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    const url = `${S3_BASE_URL}/${year}-${month}/Contracts%20Finder%20OCDS%20${year}-${month}-${day}.csv`
    urls.push({ url, date: `${year}-${month}-${day}` })
  }

  return urls
}

/**
 * Fetch a single CSV file from S3
 */
async function fetchCSVFile(url, dateStr) {
  try {
    console.log(`Fetching OCDS CSV for ${dateStr}...`)
    const response = await fetch(url)

    if (!response.ok) {
      // File might not exist yet (future date or weekend)
      if (response.status === 404 || response.status === 403) {
        console.log(`No data available for ${dateStr} (404/403)`)
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const csvText = await response.text()
    console.log(`Downloaded ${csvText.length} characters for ${dateStr}`)
    return csvText

  } catch (error) {
    console.error(`Failed to fetch ${dateStr}:`, error.message)
    return null
  }
}

/**
 * Parse a CSV line handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result.map(v => v.replace(/^"|"$/g, '').trim())
}

/**
 * Parse OCDS CSV into tender objects
 */
function parseOCDSCSV(csvText) {
  if (!csvText || csvText.trim().length === 0) {
    return []
  }

  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    return [] // No data rows
  }

  // Parse header
  const headers = parseCSVLine(lines[0])
  console.log(`CSV has ${headers.length} columns and ${lines.length - 1} data rows`)

  // Debug logging to show column names
  console.log('CSV Column Headers:', headers)
  console.log('First 10 headers:', headers.slice(0, 10))
  console.log('Headers containing "title":', headers.filter(h => h.toLowerCase().includes('title')))
  console.log('Headers containing "buyer":', headers.filter(h => h.toLowerCase().includes('buyer')))
  console.log('Headers containing "tender":', headers.filter(h => h.toLowerCase().includes('tender')))
  console.log('Headers containing "value":', headers.filter(h => h.toLowerCase().includes('value')))

  const tenders = []

  // Parse each data row
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])

      // Create row object
      const row = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })

      // Extract tender fields from flattened OCDS structure
      // Common OCDS CSV column names (may vary slightly):
      const title = row['releases/0/tender/title'] || row['tender/title'] || 'Untitled Tender'
      const buyerName = row['releases/0/buyer/name'] || row['buyer/name'] || 'Unknown Organization'
      const valueAmount = row['releases/0/tender/value/amount'] || row['tender/value/amount'] || '0'
      const endDate = row['releases/0/tender/tenderPeriod/endDate'] || row['tender/tenderPeriod/endDate'] || ''
      const description = row['releases/0/tender/description'] || row['tender/description'] || ''
      const ocid = row['ocid'] || `tender-${i}`
      const region = row['releases/0/buyer/address/region'] || row['buyer/address/region'] || ''
      const locality = row['releases/0/buyer/address/locality'] || row['buyer/address/locality'] || ''

      // Skip if missing critical fields
      if (!title || title === 'Untitled Tender') {
        continue
      }

      // Parse value to number
      const value = parseFloat(valueAmount) || 100000

      // Parse deadline or set default
      const deadline = endDate || getDefaultDeadline()

      // Create tender object
      const tender = {
        id: ocid,
        title: title,
        organization: buyerName,
        value: value,
        deadline: deadline,
        summary: description.substring(0, 200) || title,
        detailedDescription: description || 'No description available',
        region: region || locality || 'UK',
        url: `https://www.contractsfinder.service.gov.uk/notice/${ocid}`,
        categories: extractCategories(title, description, row),
        status: 'new',
        source: 'Contracts Finder (OCDS CSV)',
        fetchedAt: new Date().toISOString(),
        sirona_fit: null, // To be filled by AI analysis
        _raw: row // Keep raw data for debugging
      }

      tenders.push(tender)

    } catch (error) {
      console.error(`Error parsing row ${i}:`, error.message)
      // Continue with next row
    }
  }

  console.log(`Successfully parsed ${tenders.length} tenders from CSV`)
  return tenders
}

/**
 * Get default deadline (30 days from now)
 */
function getDefaultDeadline() {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString()
}

/**
 * Extract categories from tender data
 */
function extractCategories(title, description, row) {
  const categories = []
  const text = `${title} ${description}`.toLowerCase()

  // Map keywords to categories
  const categoryMap = {
    'Healthcare': ['health', 'nhs', 'medical', 'clinical', 'hospital'],
    'Community Services': ['community', 'neighbourhood', 'local'],
    'Mental Health': ['mental health', 'psychiatric', 'psychological', 'wellbeing'],
    'Urgent Care': ['urgent care', 'emergency', 'out of hours', 'walk-in'],
    'Primary Care': ['primary care', 'gp', 'general practice', 'family practice'],
    'Integrated Care': ['integrated care', 'ics', 'icb', 'integrated health'],
    'Children & Young People': ['children', 'paediatric', 'pediatric', 'young people', 'youth'],
    'Social Care': ['social care', 'adult social', 'care homes'],
    'Rehabilitation': ['rehabilitation', 'therapy', 'physiotherapy', 'occupational therapy'],
    'Dental Services': ['dental', 'dentist', 'orthodontic']
  }

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      categories.push(category)
    }
  }

  // Check OCDS classification
  const mainCategory = row['releases/0/tender/mainProcurementCategory'] || row['tender/mainProcurementCategory'] || ''
  if (mainCategory.toLowerCase().includes('service') && categories.length === 0) {
    categories.push('Services')
  }

  return categories.length > 0 ? [...new Set(categories)] : ['Other']
}

/**
 * Apply client-side filters to tender list
 */
function applyFilters(tenders, searchParams) {
  let filtered = tenders

  console.log(`Applying filters to ${tenders.length} tenders...`)

  // Keywords filter
  if (searchParams.keywords && searchParams.keywords.trim()) {
    const keywords = searchParams.keywords.toLowerCase().trim()
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(keywords) ||
      t.summary.toLowerCase().includes(keywords) ||
      t.organization.toLowerCase().includes(keywords) ||
      t.detailedDescription.toLowerCase().includes(keywords)
    )
    console.log(`After keywords filter: ${filtered.length} tenders`)
  }

  // Location filter
  if (searchParams.location && searchParams.location.trim()) {
    const location = searchParams.location.toLowerCase().trim()
    filtered = filtered.filter(t =>
      t.region.toLowerCase().includes(location) ||
      t.organization.toLowerCase().includes(location)
    )
    console.log(`After location filter: ${filtered.length} tenders`)
  }

  // Value range filters
  if (searchParams.minValue) {
    const minVal = parseFloat(searchParams.minValue)
    filtered = filtered.filter(t => t.value >= minVal)
    console.log(`After min value filter: ${filtered.length} tenders`)
  }

  if (searchParams.maxValue) {
    const maxVal = parseFloat(searchParams.maxValue)
    filtered = filtered.filter(t => t.value <= maxVal)
    console.log(`After max value filter: ${filtered.length} tenders`)
  }

  // Date range filter (on deadline)
  if (searchParams.publishedFrom || searchParams.publishedTo) {
    filtered = filtered.filter(t => {
      if (!t.deadline) return false

      const deadline = new Date(t.deadline)
      const from = searchParams.publishedFrom ? new Date(searchParams.publishedFrom) : new Date('2000-01-01')
      const to = searchParams.publishedTo ? new Date(searchParams.publishedTo) : new Date('2100-01-01')

      return deadline >= from && deadline <= to
    })
    console.log(`After date filter: ${filtered.length} tenders`)
  }

  console.log(`Final filtered count: ${filtered.length} tenders`)
  return filtered
}

/**
 * Enrich tender with placeholder AI analysis data
 */
export async function enrichTenderWithAI(tender) {
  // Generate placeholder data
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
}

/**
 * Get random recommendation for placeholder
 */
function getRandomRecommendation() {
  const recommendations = ['Strong Go', 'Conditional Go', 'Monitor', 'No Bid']
  const weights = [0.25, 0.35, 0.30, 0.10]

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
 * Main function to fetch and process tenders
 */
export async function fetchAndProcessTenders(searchParams) {
  console.log('=== FETCHING TENDERS FROM DATA.GOV.UK ===')
  console.log('Search parameters:', searchParams)

  // Check cache first
  const cacheKey = 'ocds_tenders_cache'
  const cacheTimestampKey = 'ocds_tenders_cache_timestamp'
  const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

  const cachedTimestamp = sessionStorage.getItem(cacheTimestampKey)
  const now = Date.now()

  let allTenders = []

  if (cachedTimestamp && (now - parseInt(cachedTimestamp)) < CACHE_DURATION) {
    console.log('Using cached tender data')
    const cachedData = sessionStorage.getItem(cacheKey)
    if (cachedData) {
      try {
        allTenders = JSON.parse(cachedData)
        console.log(`Loaded ${allTenders.length} tenders from cache`)
      } catch (error) {
        console.error('Error parsing cached data:', error)
        allTenders = []
      }
    }
  }

  // Fetch fresh data if cache is empty or expired
  if (allTenders.length === 0) {
    console.log('Fetching fresh data from data.gov.uk S3...')

    // Get URLs for last 30 days
    const csvUrls = generateCSVUrls(30)
    console.log(`Generated ${csvUrls.length} CSV URLs to fetch`)

    // Fetch CSVs (limit concurrent requests)
    const BATCH_SIZE = 5
    for (let i = 0; i < csvUrls.length; i += BATCH_SIZE) {
      const batch = csvUrls.slice(i, i + BATCH_SIZE)
      const promises = batch.map(({ url, date }) => fetchCSVFile(url, date))
      const results = await Promise.all(promises)

      // Parse successful fetches
      for (const csvText of results) {
        if (csvText) {
          const tenders = parseOCDSCSV(csvText)
          allTenders.push(...tenders)
        }
      }

      console.log(`Progress: Fetched ${i + batch.length}/${csvUrls.length} days, ${allTenders.length} total tenders`)
    }

    // Remove duplicates by OCID
    const uniqueTenders = []
    const seenOcids = new Set()
    for (const tender of allTenders) {
      if (!seenOcids.has(tender.id)) {
        seenOcids.add(tender.id)
        uniqueTenders.push(tender)
      }
    }
    allTenders = uniqueTenders

    // Enrich with placeholder AI data
    allTenders = await Promise.all(allTenders.map(t => enrichTenderWithAI(t)))

    // Cache the results
    sessionStorage.setItem(cacheKey, JSON.stringify(allTenders))
    sessionStorage.setItem(cacheTimestampKey, now.toString())
    console.log(`Cached ${allTenders.length} tenders`)
  }

  // Apply filters
  const filtered = applyFilters(allTenders, searchParams)

  console.log(`=== FETCH COMPLETE ===`)
  console.log(`Total tenders: ${allTenders.length}`)
  console.log(`After filtering: ${filtered.length}`)

  return filtered
}

// Export configuration for external use
export const getConfig = () => ({
  S3_BASE_URL,
  CACHE_DURATION: 15 * 60 * 1000,
  DAYS_BACK: 30
})
