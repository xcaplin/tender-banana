/**
 * Vercel Serverless Function - Tender Analysis Proxy
 *
 * This function acts as a secure proxy between the frontend and Anthropic API.
 * It keeps the API key secure on the server side while allowing client requests.
 */

export default async function handler(req, res) {
  // Enable CORS for your domain
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*') // You can restrict this to your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured')
      return res.status(500).json({
        error: 'API key not configured on server'
      })
    }

    // Extract prompt from request body
    const { prompt } = req.body
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
      console.error(`Anthropic API error: ${response.status} - ${errorBody}`)

      // Return appropriate error
      if (response.status === 401) {
        return res.status(401).json({ error: 'Invalid API key configured on server' })
      } else if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
      } else {
        return res.status(response.status).json({
          error: `API error: ${response.status}`,
          details: errorBody
        })
      }
    }

    // Return successful response
    const data = await response.json()
    return res.status(200).json(data)

  } catch (error) {
    console.error('Error in analyze-tender function:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
