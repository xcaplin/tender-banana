/**
 * Claude API Integration for Tender Analysis
 *
 * Uses Anthropic's Claude API to analyze tender opportunities and generate
 * strategic fit assessments for Sirona Care & Health CIC.
 *
 * API Documentation: https://docs.anthropic.com/claude/reference/messages_post
 */

// Configuration
const API_CONFIG = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 2000,
  apiVersion: '2023-06-01',
  requestDelay: 500, // ms between batch requests to avoid rate limiting
}

// API Key Management
let apiKey = null

/**
 * Set the API key for Claude API requests
 * @param {string} key - Anthropic API key
 */
export const setApiKey = (key) => {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid API key provided')
  }
  apiKey = key
  // Persist to localStorage for convenience
  try {
    localStorage.setItem('anthropic_api_key', key)
  } catch (error) {
    console.warn('Unable to persist API key to localStorage:', error)
  }
}

/**
 * Get the current API key (from memory or localStorage)
 * @returns {string|null} API key or null if not set
 */
export const getApiKey = () => {
  if (apiKey) return apiKey

  // Try to load from localStorage
  try {
    const stored = localStorage.getItem('anthropic_api_key')
    if (stored) {
      apiKey = stored
      return apiKey
    }
  } catch (error) {
    console.warn('Unable to read API key from localStorage:', error)
  }

  // Try to load from environment variable (for development)
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
    apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    return apiKey
  }

  return null
}

/**
 * Clear the stored API key
 */
export const clearApiKey = () => {
  apiKey = null
  try {
    localStorage.removeItem('anthropic_api_key')
  } catch (error) {
    console.warn('Unable to clear API key from localStorage:', error)
  }
}

/**
 * Validate that an API key is configured
 * @throws {Error} if no API key is set
 */
const validateApiKey = () => {
  const key = getApiKey()
  if (!key) {
    throw new Error(
      'No API key configured. Please set your Anthropic API key using setApiKey() or add VITE_ANTHROPIC_API_KEY to your .env file. ' +
      'Get your API key from: https://console.anthropic.com/settings/keys'
    )
  }
  return key
}

/**
 * Build the analysis prompt for Claude
 * @param {Object} tender - Tender object to analyze
 * @returns {string} Formatted prompt for Claude
 */
const buildAnalysisPrompt = (tender) => {
  return `You are a procurement strategy advisor analyzing tender opportunities for Sirona Care & Health CIC.

**About Sirona Care & Health CIC:**
Sirona is a large NHS community and neighbourhood services provider operating across Bristol, North Somerset, and South Gloucestershire (BNSSG). Core services include:
- Community Health Services (district nursing, health visiting, therapies)
- Mental Health Services (community mental health teams, crisis support)
- Urgent Care Services (minor injuries units, urgent treatment centres)
- Integrated Care (multidisciplinary teams, care coordination)
- Specialist Services (children's health, sexual health, dental services)

**Tender to Analyze:**
- **Title:** ${tender.title}
- **Organization:** ${tender.organization}
- **Contract Value:** £${tender.value.toLocaleString()}
- **Deadline:** ${new Date(tender.deadline).toLocaleDateString('en-GB')}
- **Summary:** ${tender.summary}
${tender.detailedDescription ? `- **Detailed Description:** ${tender.detailedDescription}` : ''}

**Analysis Required:**
Please analyze this tender opportunity and provide your assessment in the following JSON format:

{
  "alignment_score": <number between 0-100>,
  "rationale": "<2-3 sentences explaining why Sirona should or shouldn't bid>",
  "win_themes": [
    "<specific strength 1>",
    "<specific strength 2>",
    "<specific strength 3>"
  ],
  "competitors": [
    "<likely competitor 1>",
    "<likely competitor 2>",
    "<likely competitor 3>"
  ],
  "weak_spots": [
    "<risk or concern 1>",
    "<risk or concern 2>"
  ],
  "recommendation": "<Strong Go | Conditional Go | No Bid | Monitor>",
  "categories": [
    "<relevant category from: Community Health, Mental Health, Urgent Care, Integrated Care, Primary Care, Specialist Services>"
  ]
}

**Guidance:**
- alignment_score: Consider service fit, geographic alignment (BNSSG region), organizational capacity, and strategic value
- rationale: Focus on strategic fit and business case strength
- win_themes: Identify 3-5 specific competitive advantages Sirona could leverage
- competitors: Name likely competing organizations (other NHS trusts, private healthcare providers, social enterprises)
- weak_spots: Highlight 2-4 genuine concerns or risks
- recommendation:
  * Strong Go (90-100% alignment): Excellent fit, pursue actively
  * Conditional Go (70-89% alignment): Good fit with some conditions to address
  * No Bid (0-49% alignment): Poor fit, do not pursue
  * Monitor (50-69% alignment): Moderate fit, watch for developments
- categories: Select all relevant service categories

Respond ONLY with the JSON object, no additional text or markdown formatting.`
}

/**
 * Parse Claude's response and extract JSON
 * @param {string} responseText - Claude's response text
 * @returns {Object} Parsed sirona_fit object
 */
const parseClaudeResponse = (responseText) => {
  try {
    // Remove markdown code fences if present
    let cleanedText = responseText.trim()
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '')
    }

    // Parse JSON
    const parsed = JSON.parse(cleanedText)

    // Validate required fields
    const required = ['alignment_score', 'rationale', 'win_themes', 'competitors', 'weak_spots', 'recommendation']
    for (const field of required) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Ensure categories exists (optional field)
    if (!parsed.categories) {
      parsed.categories = []
    }

    return parsed
  } catch (error) {
    console.error('Error parsing Claude response:', error)
    console.error('Response text:', responseText)
    throw new Error(`Failed to parse Claude response: ${error.message}`)
  }
}

/**
 * Make API request to Claude
 * @param {string} prompt - Analysis prompt
 * @returns {Promise<string>} Claude's response text
 */
const callClaudeAPI = async (prompt) => {
  const key = validateApiKey()

  try {
    const response = await fetch(API_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_CONFIG.apiVersion,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        max_tokens: API_CONFIG.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()

      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Anthropic API key and try again.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${errorBody}`)
      } else {
        throw new Error(`API error (${response.status}): ${errorBody}`)
      }
    }

    const data = await response.json()

    // Extract text from Claude's response
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      throw new Error('Invalid response format from Claude API')
    }

    const textContent = data.content.find(block => block.type === 'text')
    if (!textContent || !textContent.text) {
      throw new Error('No text content in Claude response')
    }

    return textContent.text
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Network error: Unable to reach Anthropic API. Please check your internet connection.')
    }
    throw error
  }
}

/**
 * Analyze a single tender using Claude API
 * @param {Object} tender - Tender object to analyze
 * @returns {Promise<Object>} Tender enriched with sirona_fit analysis
 */
export const analyzeTenderWithClaude = async (tender) => {
  try {
    console.log(`Analyzing tender: ${tender.title}`)

    // Build prompt
    const prompt = buildAnalysisPrompt(tender)

    // Call Claude API
    const responseText = await callClaudeAPI(prompt)

    // Parse response
    const sironaFit = parseClaudeResponse(responseText)

    // Return enriched tender
    return {
      ...tender,
      sirona_fit: sironaFit,
      ai_analyzed: true,
      analyzed_at: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Error analyzing tender "${tender.title}":`, error)

    // Return tender with error indicator and fallback data
    return {
      ...tender,
      sirona_fit: {
        alignment_score: 50,
        rationale: `Unable to analyze: ${error.message}`,
        win_themes: ['Analysis pending'],
        competitors: ['Unknown'],
        weak_spots: ['AI analysis failed'],
        recommendation: 'Monitor',
        categories: []
      },
      ai_analyzed: false,
      analysis_error: error.message
    }
  }
}

/**
 * Analyze multiple tenders in batch with progress tracking
 * @param {Array<Object>} tenders - Array of tenders to analyze
 * @param {Function} onProgress - Callback function called after each tender (index, total, tender)
 * @returns {Promise<Array<Object>>} Array of enriched tenders
 */
export const analyzeTendersBatch = async (tenders, onProgress) => {
  if (!Array.isArray(tenders) || tenders.length === 0) {
    throw new Error('Invalid tenders array provided')
  }

  // Validate API key before starting batch
  validateApiKey()

  const results = []
  const total = tenders.length

  console.log(`Starting batch analysis of ${total} tenders...`)

  for (let i = 0; i < total; i++) {
    const tender = tenders[i]

    try {
      // Analyze tender
      const enrichedTender = await analyzeTenderWithClaude(tender)
      results.push(enrichedTender)

      // Call progress callback
      if (typeof onProgress === 'function') {
        onProgress(i + 1, total, enrichedTender)
      }

      // Add delay between requests (except after last one)
      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.requestDelay))
      }
    } catch (error) {
      console.error(`Failed to analyze tender ${i + 1}/${total}:`, error)

      // Add tender with error to results
      results.push({
        ...tender,
        sirona_fit: {
          alignment_score: 50,
          rationale: 'Analysis failed',
          win_themes: [],
          competitors: [],
          weak_spots: ['Analysis error'],
          recommendation: 'Monitor',
          categories: []
        },
        ai_analyzed: false,
        analysis_error: error.message
      })

      // Still call progress callback
      if (typeof onProgress === 'function') {
        onProgress(i + 1, total, results[results.length - 1])
      }
    }
  }

  console.log(`Batch analysis complete: ${results.filter(t => t.ai_analyzed).length}/${total} successful`)

  return results
}

/**
 * Estimate the cost of analyzing tenders
 * @param {number} tenderCount - Number of tenders to analyze
 * @returns {Object} Cost estimation with breakdown
 */
export const estimateAnalysisCost = (tenderCount) => {
  if (!Number.isInteger(tenderCount) || tenderCount < 1) {
    throw new Error('Invalid tender count provided')
  }

  // Cost estimation based on Claude Sonnet 4 pricing
  // Input: $3 per million tokens
  // Output: $15 per million tokens
  // Estimate: ~1000 input tokens per tender, ~500 output tokens per tender

  const avgInputTokensPerTender = 1000
  const avgOutputTokensPerTender = 500

  const totalInputTokens = tenderCount * avgInputTokensPerTender
  const totalOutputTokens = tenderCount * avgOutputTokensPerTender

  const inputCostUSD = (totalInputTokens / 1_000_000) * 3
  const outputCostUSD = (totalOutputTokens / 1_000_000) * 15
  const totalCostUSD = inputCostUSD + outputCostUSD

  // Convert to GBP (approximate rate: 1 USD = 0.79 GBP)
  const totalCostGBP = totalCostUSD * 0.79

  return {
    tenderCount,
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    inputCostUSD,
    outputCostUSD,
    totalCostUSD,
    totalCostGBP,
    costPerTenderUSD: totalCostUSD / tenderCount,
    costPerTenderGBP: totalCostGBP / tenderCount,
    formattedCostGBP: `£${totalCostGBP.toFixed(4)}`,
    formattedCostPerTenderGBP: `£${(totalCostGBP / tenderCount).toFixed(4)}`
  }
}

/**
 * Check if the API is configured and ready to use
 * @returns {Object} Status object with isReady flag and message
 */
export const checkApiStatus = () => {
  const key = getApiKey()

  if (!key) {
    return {
      isReady: false,
      message: 'No API key configured. Please set your Anthropic API key.',
      instructions: 'Get your API key from: https://console.anthropic.com/settings/keys'
    }
  }

  return {
    isReady: true,
    message: 'API key configured and ready to use',
    keyPreview: `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
  }
}

// Export configuration for reference
export const getConfig = () => ({ ...API_CONFIG })
