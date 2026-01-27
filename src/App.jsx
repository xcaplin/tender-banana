import { useState, useMemo, useEffect, Component } from 'react'
import './App.css'
import tenders from './data/tenders.js'
import { fetchAndProcessTenders } from './services/tenderFetcher.js'
import {
  analyzeTenderWithClaude,
  analyzeTendersBatch,
  estimateAnalysisCost,
  setApiKey,
  getApiKey,
  checkApiStatus
} from './services/claudeAnalyzer.js'

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <header className="header" role="banner">
            <h1>Sirona Tender Intelligence Dashboard</h1>
          </header>
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>Something Went Wrong</h2>
            <p>We encountered an unexpected error. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="error-reload-btn"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all')
  const [recommendationFilter, setRecommendationFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState([])
  const [sortBy, setSortBy] = useState('deadline-asc')

  // Detail panel state
  const [selectedTenderId, setSelectedTenderId] = useState(null)

  // Collapse states
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false)
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false)

  // Loading state
  const [isLoading, setIsLoading] = useState(true)

  // Live data state
  const [dataSource, setDataSource] = useState('sample') // 'sample' | 'live'
  const [liveTenders, setLiveTenders] = useState([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isSearchParamsCollapsed, setIsSearchParamsCollapsed] = useState(false)
  const [showInfoTooltip, setShowInfoTooltip] = useState(false)

  // AI Analysis state
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyStatus, setApiKeyStatus] = useState(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [autoAnalyze, setAutoAnalyze] = useState(() => {
    const saved = localStorage.getItem('autoAnalyze')
    return saved ? JSON.parse(saved) : false
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, currentTender: null })
  const [sessionAnalysisCount, setSessionAnalysisCount] = useState(0)
  const [sessionAnalysisCost, setSessionAnalysisCost] = useState(0)
  const [analyzedTenders, setAnalyzedTenders] = useState(new Set())
  const [tenderAnalysisStatus, setTenderAnalysisStatus] = useState({}) // tenderId -> 'analyzing' | 'success' | 'error'

  // Search parameters for live data
  const [searchParams, setSearchParams] = useState(() => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('tenderSearchParams')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (error) {
        console.error('Error parsing saved search params:', error)
      }
    }
    return {
      keywords: 'community health NHS',
      location: 'Bristol, North Somerset, South Gloucestershire',
      minValue: '',
      maxValue: '',
      publishedFrom: '',
      publishedTo: ''
    }
  })

  // Simulate initial data load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // Load last fetch timestamp from localStorage
  useEffect(() => {
    const savedTimestamp = localStorage.getItem('lastTenderFetch')
    if (savedTimestamp) {
      setLastUpdated(savedTimestamp)
    }
  }, [])

  // Save search parameters to localStorage when they change
  useEffect(() => {
    localStorage.setItem('tenderSearchParams', JSON.stringify(searchParams))
  }, [searchParams])

  // Check API key status on mount
  useEffect(() => {
    const status = checkApiStatus()
    setApiKeyStatus(status)
  }, [])

  // Save auto-analyze preference when it changes
  useEffect(() => {
    localStorage.setItem('autoAnalyze', JSON.stringify(autoAnalyze))
  }, [autoAnalyze])

  // Auto-analyze new tenders when enabled
  useEffect(() => {
    if (autoAnalyze && apiKeyStatus?.isReady && dataSource === 'live' && liveTenders.length > 0 && !isAnalyzing) {
      const unanalyzed = liveTenders.filter(t => !t.ai_analyzed && !analyzedTenders.has(t.id) && tenderAnalysisStatus[t.id] !== 'analyzing')

      if (unanalyzed.length > 0) {
        console.log(`Auto-analyzing ${unanalyzed.length} new tenders...`)
        // Small delay to avoid immediate re-trigger
        const timer = setTimeout(() => {
          handleAnalyzeBatch(unanalyzed)
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [liveTenders, autoAnalyze, apiKeyStatus, dataSource, isAnalyzing])

  // Get selected tender object
  const selectedTender = selectedTenderId
    ? tenders.find(t => t.id === selectedTenderId)
    : null

  // Handle ESC key to close detail panel
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && selectedTenderId) {
        setSelectedTenderId(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedTenderId])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedTenderId) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedTenderId])

  // Get current tender source based on data mode
  const currentTenders = dataSource === 'live' ? liveTenders : tenders

  // Extract unique categories from all tenders
  const allCategories = useMemo(() => {
    const categorySet = new Set()
    currentTenders.forEach(tender => {
      tender.categories.forEach(cat => categorySet.add(cat))
    })
    return Array.from(categorySet).sort()
  }, [currentTenders])

  // Filter and sort tenders
  const filteredAndSortedTenders = useMemo(() => {
    let filtered = currentTenders.filter(tender => {
      // Status filter
      if (statusFilter !== 'all' && tender.status !== statusFilter) {
        return false
      }

      // Recommendation filter
      if (recommendationFilter !== 'all' && tender.sirona_fit.recommendation !== recommendationFilter) {
        return false
      }

      // Category filter
      if (categoryFilter.length > 0) {
        const hasCategory = categoryFilter.some(cat => tender.categories.includes(cat))
        if (!hasCategory) return false
      }

      return true
    })

    // Sort tenders
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'deadline-asc':
          return new Date(a.deadline) - new Date(b.deadline)
        case 'deadline-desc':
          return new Date(b.deadline) - new Date(a.deadline)
        case 'value-high':
          return b.value - a.value
        case 'value-low':
          return a.value - b.value
        case 'alignment-desc':
          return b.sirona_fit.alignment_score - a.sirona_fit.alignment_score
        default:
          return 0
      }
    })

    return sorted
  }, [statusFilter, recommendationFilter, categoryFilter, sortBy])

  // Format currency
  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `£${(value / 1000000).toFixed(1)}M`
    }
    return `£${(value / 1000).toFixed(0)}k`
  }

  // Format date and calculate days until deadline
  const formatDeadline = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const daysUntil = Math.ceil((date - now) / (1000 * 60 * 60 * 24))

    const formatted = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

    if (daysUntil < 0) {
      return { formatted, daysText: 'Expired', urgent: true }
    } else if (daysUntil === 0) {
      return { formatted, daysText: 'Today', urgent: true }
    } else if (daysUntil === 1) {
      return { formatted, daysText: '1 day', urgent: true }
    } else if (daysUntil <= 7) {
      return { formatted, daysText: `${daysUntil} days`, urgent: true }
    } else if (daysUntil <= 30) {
      return { formatted, daysText: `${daysUntil} days`, urgent: false }
    } else {
      return { formatted, daysText: `${Math.floor(daysUntil / 7)} weeks`, urgent: false }
    }
  }

  // Get badge color for recommendation
  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case 'Strong Go':
        return '#10B981'
      case 'Conditional Go':
        return '#F59E0B'
      case 'No Bid':
        return '#EF4444'
      case 'Monitor':
        return '#6B7280'
      default:
        return '#6B7280'
    }
  }

  // Get badge color for status
  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        return '#3B82F6'
      case 'reviewing':
        return '#F59E0B'
      case 'go':
        return '#10B981'
      case 'no-go':
        return '#EF4444'
      default:
        return '#6B7280'
    }
  }

  // Get recommendation icon
  const getRecommendationIcon = (recommendation) => {
    switch (recommendation) {
      case 'Strong Go':
        return '✓'
      case 'Conditional Go':
        return 'ℹ'
      case 'No Bid':
        return '✕'
      case 'Monitor':
        return '👁'
      default:
        return '•'
    }
  }

  // Toggle category selection
  const toggleCategory = (category) => {
    setCategoryFilter(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  // Summary card calculations
  const summaryStats = useMemo(() => {
    const now = new Date()

    // Total active opportunities
    const totalActive = filteredAndSortedTenders.length

    // Strong recommendations
    const strongGo = filteredAndSortedTenders.filter(
      t => t.sirona_fit.recommendation === 'Strong Go'
    )
    const strongGoCount = strongGo.length
    const strongGoValue = strongGo.reduce((sum, t) => sum + t.value, 0)

    // Average alignment
    const avgAlignment = totalActive > 0
      ? Math.round(
          filteredAndSortedTenders.reduce((sum, t) => sum + t.sirona_fit.alignment_score, 0) / totalActive
        )
      : 0

    // Urgent deadlines (within 30 days)
    const urgentTenders = filteredAndSortedTenders.filter(t => {
      const deadline = new Date(t.deadline)
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24))
      return daysUntil >= 0 && daysUntil <= 30
    })
    const urgentCount = urgentTenders.length

    // Total pipeline value
    const totalValue = filteredAndSortedTenders.reduce((sum, t) => sum + t.value, 0)

    return {
      totalActive,
      strongGoCount,
      strongGoValue,
      avgAlignment,
      urgentCount,
      totalValue
    }
  }, [filteredAndSortedTenders])

  // Card click handlers
  const handleStrongGoClick = () => {
    setRecommendationFilter('Strong Go')
  }

  const handleAlignmentClick = () => {
    setSortBy('alignment-desc')
  }

  const handleUrgentClick = () => {
    // Filter to show tenders with deadline within 30 days
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    setSortBy('deadline-asc')
    // Note: We can't directly filter by date range with current filters,
    // but sorting by deadline-asc will show urgent ones first
  }

  const handleValueClick = () => {
    setSortBy('value-high')
  }

  // Check if cards are in active state
  const isStrongGoActive = recommendationFilter === 'Strong Go'
  const isAlignmentActive = sortBy === 'alignment-desc'
  const isValueActive = sortBy === 'value-high'

  // Live data functions
  const handleFetchTenders = async () => {
    setIsFetching(true)
    setFetchError(null)

    try {
      console.log('Fetching tenders with params:', searchParams)

      // Build API parameters
      const apiParams = {
        keywords: searchParams.keywords || undefined,
        location: searchParams.location || undefined,
        minValue: searchParams.minValue ? parseInt(searchParams.minValue) : undefined,
        maxValue: searchParams.maxValue ? parseInt(searchParams.maxValue) : undefined,
        publishedFrom: searchParams.publishedFrom || undefined,
        publishedTo: searchParams.publishedTo || undefined,
      }

      const fetchedTenders = await fetchAndProcessTenders(apiParams)

      if (fetchedTenders && fetchedTenders.length > 0) {
        setLiveTenders(fetchedTenders)
        setDataSource('live')
        const timestamp = new Date().toISOString()
        setLastUpdated(timestamp)
        localStorage.setItem('lastTenderFetch', timestamp)
        console.log(`Successfully loaded ${fetchedTenders.length} tenders from live sources`)
      } else {
        setFetchError('No tenders found matching your search criteria. Try adjusting your parameters or use sample data.')
      }
    } catch (error) {
      console.error('Error fetching tenders:', error)
      setFetchError('Unable to fetch live data. This may be due to API access restrictions. You can continue using sample data or try again later.')
      setDataSource('sample') // Fall back to sample data
    } finally {
      setIsFetching(false)
    }
  }

  const handleRefreshData = () => {
    if (dataSource === 'live') {
      handleFetchTenders()
    }
  }

  const handleDataSourceToggle = () => {
    if (dataSource === 'sample') {
      // Switching to live mode - check if we have data
      if (liveTenders.length > 0) {
        setDataSource('live')
      } else {
        // No live data yet, stay in sample mode but expand search params
        setIsSearchParamsCollapsed(false)
      }
    } else {
      // Switching back to sample mode
      setDataSource('sample')
    }
  }

  const handleResetSearchParams = () => {
    setSearchParams({
      keywords: 'community health NHS',
      location: 'Bristol, North Somerset, South Gloucestershire',
      minValue: '',
      maxValue: '',
      publishedFrom: '',
      publishedTo: ''
    })
  }

  const handleSearchParamChange = (field, value) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // AI Analysis functions
  const handleSaveApiKey = () => {
    try {
      if (!apiKeyInput.trim()) {
        alert('Please enter an API key')
        return
      }
      setApiKey(apiKeyInput.trim())
      const status = checkApiStatus()
      setApiKeyStatus(status)
      setApiKeyInput('')
      alert('API key saved successfully!')
    } catch (error) {
      alert(`Error saving API key: ${error.message}`)
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    try {
      // Create a minimal test tender
      const testTender = {
        title: 'Test Tender',
        organization: 'Test Org',
        value: 100000,
        deadline: new Date().toISOString(),
        summary: 'This is a test tender for API connection validation.',
        detailedDescription: ''
      }

      await analyzeTenderWithClaude(testTender)
      alert('✓ Connection successful! Claude API is ready to use.')
    } catch (error) {
      alert(`✗ Connection failed: ${error.message}`)
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleAnalyzeSingleTender = async (tender) => {
    if (!apiKeyStatus?.isReady) {
      alert('Please configure your Anthropic API key in Settings first.')
      setShowSettingsModal(true)
      return
    }

    setTenderAnalysisStatus(prev => ({ ...prev, [tender.id]: 'analyzing' }))

    try {
      const enrichedTender = await analyzeTenderWithClaude(tender)

      // Update the tender in the appropriate list
      if (dataSource === 'live') {
        setLiveTenders(prev => prev.map(t => t.id === tender.id ? enrichedTender : t))
      }

      setTenderAnalysisStatus(prev => ({ ...prev, [tender.id]: 'success' }))
      setAnalyzedTenders(prev => new Set([...prev, tender.id]))
      setSessionAnalysisCount(prev => prev + 1)

      const cost = estimateAnalysisCost(1)
      setSessionAnalysisCost(prev => prev + cost.totalCostGBP)

    } catch (error) {
      console.error('Analysis error:', error)
      setTenderAnalysisStatus(prev => ({ ...prev, [tender.id]: 'error' }))
      alert(`Failed to analyze tender: ${error.message}`)
    }
  }

  const handleAnalyzeBatch = async (tendersToAnalyze) => {
    if (!apiKeyStatus?.isReady) {
      alert('Please configure your Anthropic API key in Settings first.')
      setShowSettingsModal(true)
      return
    }

    // Show cost estimate
    const cost = estimateAnalysisCost(tendersToAnalyze.length)
    const confirmed = window.confirm(
      `Analyze ${tendersToAnalyze.length} tenders?\n\n` +
      `Estimated cost: ${cost.formattedCostGBP} (${cost.formattedCostPerTenderGBP} per tender)\n\n` +
      `This will use the Claude API to generate strategic fit assessments.`
    )

    if (!confirmed) return

    setIsAnalyzing(true)
    setAnalysisProgress({ current: 0, total: tendersToAnalyze.length, currentTender: null })

    // Mark all as analyzing
    const statusUpdates = {}
    tendersToAnalyze.forEach(t => { statusUpdates[t.id] = 'analyzing' })
    setTenderAnalysisStatus(prev => ({ ...prev, ...statusUpdates }))

    try {
      const enrichedTenders = await analyzeTendersBatch(
        tendersToAnalyze,
        (current, total, tender) => {
          setAnalysisProgress({ current, total, currentTender: tender.title })
        }
      )

      // Update the tenders in the appropriate list
      if (dataSource === 'live') {
        setLiveTenders(prev => {
          const enrichedMap = new Map(enrichedTenders.map(t => [t.id, t]))
          return prev.map(t => enrichedMap.get(t.id) || t)
        })
      }

      // Update status for all analyzed tenders
      const successUpdates = {}
      enrichedTenders.forEach(t => {
        successUpdates[t.id] = t.ai_analyzed ? 'success' : 'error'
        if (t.ai_analyzed) {
          setAnalyzedTenders(prev => new Set([...prev, t.id]))
        }
      })
      setTenderAnalysisStatus(prev => ({ ...prev, ...successUpdates }))

      const successCount = enrichedTenders.filter(t => t.ai_analyzed).length
      setSessionAnalysisCount(prev => prev + successCount)
      setSessionAnalysisCost(prev => prev + cost.totalCostGBP)

      alert(`✓ Analysis complete!\n\nSuccessfully analyzed: ${successCount}/${tendersToAnalyze.length} tenders`)
    } catch (error) {
      console.error('Batch analysis error:', error)
      alert(`Analysis failed: ${error.message}`)
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress({ current: 0, total: 0, currentTender: null })
    }
  }

  // CSV Export functionality
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return ''
    const stringValue = String(value)
    // Escape double quotes by doubling them, and wrap in quotes if contains comma, quote, or newline
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
  }

  const formatDateForCSV = (dateString) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const generateCSV = () => {
    // CSV Headers
    const headers = [
      'Title',
      'Organization',
      'Value',
      'Deadline',
      'Status',
      'Recommendation',
      'Alignment Score',
      'Categories'
    ]

    // Convert tenders to CSV rows
    const rows = filteredAndSortedTenders.map(tender => [
      escapeCSV(tender.title),
      escapeCSV(tender.organization),
      tender.value, // Raw number, no currency symbol
      formatDateForCSV(tender.deadline),
      escapeCSV(tender.status),
      escapeCSV(tender.sirona_fit.recommendation),
      tender.sirona_fit.alignment_score,
      escapeCSV(tender.categories.join(', '))
    ])

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    return csvContent
  }

  const handleExportCSV = () => {
    if (filteredAndSortedTenders.length === 0) return

    const csvContent = generateCSV()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    // Generate filename with current date
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const filename = `sirona-tenders-${year}-${month}-${day}.csv`

    // Create temporary link and trigger download
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up the URL object
    URL.revokeObjectURL(url)
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="app">
        <header className="header">
          <h1>Sirona Tender Intelligence Dashboard</h1>
        </header>
        <div className="loading-container" role="status" aria-live="polite">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading tender opportunities...</p>
        </div>
      </div>
    )
  }

  // Empty data state (if no tenders exist at all for current source)
  if (currentTenders.length === 0 && dataSource === 'live') {
    return (
      <div className="app">
        <header className="header">
          <h1>Sirona Tender Intelligence Dashboard</h1>
        </header>
        <div className="empty-data-container">
          <div className="empty-icon">📋</div>
          <h2>No Live Tender Data</h2>
          <p>Click "Fetch Tenders" to load live opportunities from UK government procurement sources.</p>
          <button
            onClick={() => setDataSource('sample')}
            className="reset-filters-btn"
          >
            Switch to Sample Data
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Skip to main content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="header" role="banner">
        <div className="header-content">
          <h1>Sirona Tender Intelligence Dashboard</h1>
          <div className="header-controls">
            <button
              className="settings-btn"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Open settings"
              title="Settings"
            >
              ⚙️
            </button>

            <button
              className={`data-source-toggle ${dataSource === 'live' ? 'live-active' : ''}`}
              onClick={handleDataSourceToggle}
              aria-label={`Currently using ${dataSource} data. Click to toggle.`}
            >
              <span className="data-source-icon">{dataSource === 'live' ? '🔴' : '📋'}</span>
              <span className="data-source-text">
                {dataSource === 'live' ? 'Using Live Data' : 'Using Sample Data'}
              </span>
            </button>

            <div className="info-tooltip-container">
              <button
                className="info-icon-btn"
                onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                aria-label="Information about data sources"
              >
                ℹ️
              </button>
              {showInfoTooltip && (
                <div className="info-tooltip">
                  <button
                    className="tooltip-close"
                    onClick={() => setShowInfoTooltip(false)}
                    aria-label="Close tooltip"
                  >
                    ✕
                  </button>
                  <h4>About Data Sources</h4>
                  <ul>
                    <li><strong>Sample Data:</strong> Realistic preview with 10 NHS tenders</li>
                    <li><strong>Live Data:</strong> Real tenders from UK government procurement sources (Contracts Finder, Find a Tender)</li>
                    <li><strong>Note:</strong> Live data may have CORS restrictions in browser. AI strategic analysis is currently placeholder and will be enhanced in future releases.</li>
                  </ul>
                </div>
              )}
            </div>

            {dataSource === 'live' && (
              <button
                className="refresh-btn"
                onClick={handleRefreshData}
                disabled={isFetching}
                aria-label="Refresh live data"
              >
                <span className="refresh-icon">↻</span>
                <span className="refresh-text">Refresh</span>
              </button>
            )}
          </div>
        </div>

        {dataSource === 'live' && lastUpdated && (
          <div className="live-data-banner">
            Live Data Mode • Last updated: {formatLastUpdated(lastUpdated)}
          </div>
        )}
      </header>

      {/* Settings Modal */}
      {showSettingsModal && (
        <>
          <div
            className="detail-overlay"
            onClick={() => setShowSettingsModal(false)}
            aria-hidden="true"
          />
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button
              className="detail-close"
              onClick={() => setShowSettingsModal(false)}
              aria-label="Close settings"
            >
              ✕
            </button>

            <div className="settings-content">
              <h2 id="settings-title">Settings</h2>

              <div className="settings-section">
                <h3>Anthropic API Configuration</h3>
                <p className="settings-help-text">
                  Required for AI-powered tender analysis. Your API key is stored locally and never sent to our servers.
                </p>

                <div className="api-key-status">
                  <span className="status-label">Status:</span>
                  {apiKeyStatus?.isReady ? (
                    <span className="status-connected">
                      ✓ Connected ({apiKeyStatus.keyPreview})
                    </span>
                  ) : (
                    <span className="status-not-configured">
                      ✗ Not configured
                    </span>
                  )}
                </div>

                <div className="api-key-input-group">
                  <label htmlFor="api-key-input">Anthropic API Key</label>
                  <input
                    id="api-key-input"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className="api-key-input"
                  />
                </div>

                <div className="settings-actions">
                  <button
                    className="save-api-key-btn"
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim()}
                  >
                    Save API Key
                  </button>

                  <button
                    className="test-connection-btn"
                    onClick={handleTestConnection}
                    disabled={!apiKeyStatus?.isReady || isTestingConnection}
                  >
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                <p className="settings-help-link">
                  Get your API key from: <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Anthropic Console
                  </a>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search Parameters Panel - Only visible in live data mode or when no live data */}
      {(dataSource === 'live' || liveTenders.length === 0) && (
        <div className={`search-params-section ${isSearchParamsCollapsed ? 'collapsed' : ''}`}>
          <button
            className="collapse-toggle"
            onClick={() => setIsSearchParamsCollapsed(!isSearchParamsCollapsed)}
            aria-label={isSearchParamsCollapsed ? 'Expand search parameters' : 'Collapse search parameters'}
          >
            <span className="toggle-label">Search Parameters</span>
            <span className="toggle-icon">{isSearchParamsCollapsed ? '▼' : '▲'}</span>
          </button>

          <div
            className="search-params-content"
            style={{
              display: isSearchParamsCollapsed ? 'none' : 'block'
            }}
          >
            <div className="search-params-grid">
              <div className="param-group">
                <label htmlFor="keywords">Keywords</label>
                <input
                  id="keywords"
                  type="text"
                  value={searchParams.keywords}
                  onChange={(e) => handleSearchParamChange('keywords', e.target.value)}
                  placeholder="e.g., community health, mental health"
                  className="param-input"
                />
              </div>

              <div className="param-group">
                <label htmlFor="location">Location/Region</label>
                <input
                  id="location"
                  type="text"
                  value={searchParams.location}
                  onChange={(e) => handleSearchParamChange('location', e.target.value)}
                  placeholder="e.g., Bristol, North Somerset"
                  className="param-input"
                />
              </div>

              <div className="param-group">
                <label htmlFor="minValue">Min Value (£)</label>
                <input
                  id="minValue"
                  type="number"
                  value={searchParams.minValue}
                  onChange={(e) => handleSearchParamChange('minValue', e.target.value)}
                  placeholder="e.g., 100000"
                  className="param-input"
                />
              </div>

              <div className="param-group">
                <label htmlFor="maxValue">Max Value (£)</label>
                <input
                  id="maxValue"
                  type="number"
                  value={searchParams.maxValue}
                  onChange={(e) => handleSearchParamChange('maxValue', e.target.value)}
                  placeholder="e.g., 10000000"
                  className="param-input"
                />
              </div>

              <div className="param-group">
                <label htmlFor="publishedFrom">Published From</label>
                <input
                  id="publishedFrom"
                  type="date"
                  value={searchParams.publishedFrom}
                  onChange={(e) => handleSearchParamChange('publishedFrom', e.target.value)}
                  className="param-input"
                />
              </div>

              <div className="param-group">
                <label htmlFor="publishedTo">Published To</label>
                <input
                  id="publishedTo"
                  type="date"
                  value={searchParams.publishedTo}
                  onChange={(e) => handleSearchParamChange('publishedTo', e.target.value)}
                  className="param-input"
                />
              </div>
            </div>

            <div className="search-params-actions">
              <button
                className="fetch-tenders-btn"
                onClick={handleFetchTenders}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <span className="button-spinner"></span>
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Fetch Tenders</span>
                  </>
                )}
              </button>

              <button
                className="reset-params-btn"
                onClick={handleResetSearchParams}
                disabled={isFetching}
              >
                Reset Parameters
              </button>
            </div>

            {fetchError && (
              <div className="fetch-error-message" role="alert">
                <span className="error-icon">⚠️</span>
                <span>{fetchError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis Panel - Only visible when API is configured */}
      {apiKeyStatus?.isReady && dataSource === 'live' && liveTenders.length > 0 && (
        <div className="ai-analysis-section">
          <h3 className="ai-section-title">AI Analysis</h3>

          <div className="ai-controls">
            <label className="auto-analyze-checkbox">
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
              />
              <span>Automatically analyze new tenders with Claude</span>
            </label>

            <div className="analysis-buttons">
              <button
                className="analyze-btn analyze-unanalyzed-btn"
                onClick={() => {
                  const unanalyzed = liveTenders.filter(t => !t.ai_analyzed && !analyzedTenders.has(t.id))
                  if (unanalyzed.length === 0) {
                    alert('All tenders have already been analyzed!')
                    return
                  }
                  handleAnalyzeBatch(unanalyzed)
                }}
                disabled={isAnalyzing || isFetching}
              >
                Analyze Unanalyzed Tenders ({liveTenders.filter(t => !t.ai_analyzed && !analyzedTenders.has(t.id)).length})
              </button>

              <button
                className="analyze-btn analyze-all-btn"
                onClick={() => handleAnalyzeBatch(liveTenders)}
                disabled={isAnalyzing || isFetching}
              >
                Analyze All Tenders ({liveTenders.length})
              </button>
            </div>
          </div>

          {/* Cost Tracking */}
          {sessionAnalysisCount > 0 && (
            <div className="cost-tracking">
              <span className="cost-label">Session Analysis:</span>
              <span className="cost-value">
                {sessionAnalysisCount} {sessionAnalysisCount === 1 ? 'tender' : 'tenders'}
                {' '}(est. £{sessionAnalysisCost.toFixed(4)})
              </span>
              {sessionAnalysisCost > 1 && (
                <span className="cost-warning">⚠️ Approaching £1</span>
              )}
            </div>
          )}

          {/* Analysis Progress */}
          {isAnalyzing && (
            <div className="analysis-progress">
              <div className="progress-header">
                <span className="progress-text">
                  Analyzing {analysisProgress.current} of {analysisProgress.total} tenders...
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${(analysisProgress.current / analysisProgress.total) * 100}%`
                  }}
                />
              </div>
              {analysisProgress.currentTender && (
                <div className="current-tender-analyzing">
                  Current: {analysisProgress.currentTender}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className={`summary-section ${isSummaryCollapsed ? 'collapsed' : ''}`}>
        <button
          className="collapse-toggle"
          onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
          aria-label={isSummaryCollapsed ? 'Expand summary cards' : 'Collapse summary cards'}
        >
          <span className="toggle-label">Analytics Summary</span>
          <span className="toggle-icon">{isSummaryCollapsed ? '▼' : '▲'}</span>
        </button>
        <div className="summary-cards"
          style={{
            display: isSummaryCollapsed ? 'none' : 'grid'
          }}
        >
        {/* Card 1 - Total Active Opportunities (Informational) */}
        <div className="summary-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-label">Total Active Opportunities</div>
            <div className="card-value">{summaryStats.totalActive}</div>
          </div>
        </div>

        {/* Card 2 - Strong Recommendations (Clickable) */}
        <div
          className={`summary-card clickable ${isStrongGoActive ? 'active' : ''}`}
          onClick={handleStrongGoClick}
        >
          <div className="card-icon">✅</div>
          <div className="card-content">
            <div className="card-label">Strong Recommendations</div>
            <div className="card-value">{summaryStats.strongGoCount}</div>
            <div className="card-subtitle">{formatCurrency(summaryStats.strongGoValue)} total value</div>
          </div>
        </div>

        {/* Card 3 - Average Alignment (Clickable) */}
        <div
          className={`summary-card clickable ${isAlignmentActive ? 'active' : ''}`}
          onClick={handleAlignmentClick}
        >
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <div className="card-label">Average Alignment</div>
            <div className="card-value">{summaryStats.avgAlignment}%</div>
            <div className="card-subtitle">Strategic fit score</div>
          </div>
        </div>

        {/* Card 4 - Urgent Deadlines (Clickable) */}
        <div
          className="summary-card clickable"
          onClick={handleUrgentClick}
        >
          <div className="card-icon">⏰</div>
          <div className="card-content">
            <div className="card-label">Urgent Deadlines</div>
            <div className="card-value">{summaryStats.urgentCount}</div>
            <div className="card-subtitle">Within 30 days</div>
          </div>
        </div>

        {/* Card 5 - Total Pipeline Value (Clickable) */}
        <div
          className={`summary-card clickable ${isValueActive ? 'active' : ''}`}
          onClick={handleValueClick}
        >
          <div className="card-icon">💷</div>
          <div className="card-content">
            <div className="card-label">Total Pipeline Value</div>
            <div className="card-value">{formatCurrency(summaryStats.totalValue)}</div>
            <div className="card-subtitle">Combined contract value</div>
          </div>
        </div>
        </div>
      </div>

      <div className={`filter-section ${isFilterCollapsed ? 'collapsed' : ''}`}>
        <button
          className="collapse-toggle filter-toggle"
          onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
          aria-label={isFilterCollapsed ? 'Expand filters' : 'Collapse filters'}
        >
          <span className="toggle-label">Filters & Controls</span>
          <span className="toggle-icon">{isFilterCollapsed ? '▼' : '▲'}</span>
        </button>
        <div className="filter-bar"
          style={{
            display: isFilterCollapsed ? 'none' : 'block'
          }}
        >
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="go">Go</option>
              <option value="no-go">No-Go</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="recommendation-filter">Recommendation</label>
            <select
              id="recommendation-filter"
              value={recommendationFilter}
              onChange={(e) => setRecommendationFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Recommendations</option>
              <option value="Strong Go">Strong Go</option>
              <option value="Conditional Go">Conditional Go</option>
              <option value="No Bid">No Bid</option>
              <option value="Monitor">Monitor</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-filter">Sort By</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="deadline-asc">Deadline ↑ (Soonest)</option>
              <option value="deadline-desc">Deadline ↓ (Latest)</option>
              <option value="value-high">Value (High → Low)</option>
              <option value="value-low">Value (Low → High)</option>
              <option value="alignment-desc">Alignment ↓ (Best Match)</option>
            </select>
          </div>
        </div>

        <div className="category-filters">
          <label>Categories:</label>
          <div className="category-pills">
            {allCategories.map(category => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`category-pill ${categoryFilter.includes(category) ? 'active' : ''}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-bottom-row">
          <div className="tender-count">
            Showing <strong>{filteredAndSortedTenders.length}</strong> of <strong>{currentTenders.length}</strong> opportunities
            {dataSource === 'live' && <span className="data-source-badge">Live Data</span>}
          </div>

          <button
            className="export-btn"
            onClick={handleExportCSV}
            disabled={filteredAndSortedTenders.length === 0}
            aria-label={`Export ${filteredAndSortedTenders.length} tenders to CSV`}
          >
            <span className="export-icon">📥</span>
            <span className="export-text">
              Export {filteredAndSortedTenders.length === currentTenders.length ? 'All' : ''} ({filteredAndSortedTenders.length} {filteredAndSortedTenders.length === 1 ? 'tender' : 'tenders'})
            </span>
          </button>
        </div>
        </div>
      </div>

      <main className="main-content" id="main-content" role="main">
        <div className="tender-list">
          {filteredAndSortedTenders.length === 0 ? (
            <div className="no-results" role="status" aria-live="polite">
              <div className="no-results-icon">🔍</div>
              <h2>No Tenders Match Your Filters</h2>
              <p>Try adjusting your filter criteria or clearing all filters to see more opportunities.</p>
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setRecommendationFilter('all')
                  setCategoryFilter([])
                }}
                className="reset-filters-btn"
                aria-label="Clear all filters and show all tenders"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            filteredAndSortedTenders.map(tender => {
              const deadline = formatDeadline(tender.deadline)
              return (
                <div
                  key={tender.id}
                  className="tender-row"
                  onClick={() => setSelectedTenderId(tender.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedTenderId(tender.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${tender.title}`}
                >
                  <div className="tender-main">
                    <div className="tender-header">
                      <div className="tender-title-with-indicator">
                        {apiKeyStatus?.isReady && dataSource === 'live' && (
                          <span className="ai-analysis-indicator" title={
                            tenderAnalysisStatus[tender.id] === 'analyzing' ? 'Analyzing...' :
                            tenderAnalysisStatus[tender.id] === 'success' || tender.ai_analyzed ? 'AI Analyzed' :
                            tenderAnalysisStatus[tender.id] === 'error' ? 'Analysis Failed' :
                            'Not Analyzed'
                          }>
                            {tenderAnalysisStatus[tender.id] === 'analyzing' ? '⏳' :
                             tenderAnalysisStatus[tender.id] === 'success' || tender.ai_analyzed ? '✓' :
                             tenderAnalysisStatus[tender.id] === 'error' ? '✗' :
                             '○'}
                          </span>
                        )}
                        <h3 className="tender-title">{tender.title}</h3>
                      </div>
                      <div className="tender-badges">
                        {dataSource === 'sample' && (
                          <span className="data-source-badge sample-badge">Sample Analysis</span>
                        )}
                        {dataSource === 'live' && (tender.ai_analyzed || tenderAnalysisStatus[tender.id] === 'success') && (
                          <span className="data-source-badge ai-badge">AI Analysis</span>
                        )}
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(tender.status) }}
                        >
                          {tender.status}
                        </span>
                        <span
                          className="recommendation-badge"
                          style={{ backgroundColor: getRecommendationColor(tender.sirona_fit.recommendation) }}
                        >
                          {tender.sirona_fit.recommendation}
                        </span>
                      </div>
                    </div>
                    <p className="tender-organization">{tender.organization}</p>
                    <p className="tender-summary">{tender.summary}</p>
                  </div>

                  <div className="tender-metrics">
                    <div className="metric-item">
                      <label>Value</label>
                      <span className="metric-value">{formatCurrency(tender.value)}</span>
                    </div>
                    <div className="metric-item">
                      <label>Deadline</label>
                      <span className={`metric-value ${deadline.urgent ? 'urgent' : ''}`}>
                        {deadline.formatted}
                        <span className="days-until">{deadline.daysText}</span>
                      </span>
                    </div>
                    <div className="metric-item">
                      <label>Alignment</label>
                      <span className="metric-value alignment-score">
                        {tender.sirona_fit.alignment_score}% match
                      </span>
                    </div>
                    <div className="metric-item">
                      <label>Region</label>
                      <span className="metric-value">{tender.region}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* Detail Panel */}
      {selectedTender && (
        <>
          <div
            className="detail-overlay"
            onClick={() => setSelectedTenderId(null)}
            aria-hidden="true"
          />
          <div
            className="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <button
              className="detail-close"
              onClick={() => setSelectedTenderId(null)}
              aria-label="Close detail panel"
              autoFocus
            >
              ✕
            </button>

            <div className="detail-content">
              {/* Header Section */}
              <div className="detail-header">
                <h2 className="detail-title" id="detail-title">{selectedTender.title}</h2>
                <p className="detail-organization">{selectedTender.organization}</p>
                <div className="detail-header-badges">
                  <div className="detail-badge-item">
                    <label>Contract Value</label>
                    <span className="detail-value-badge">{formatCurrency(selectedTender.value)}</span>
                  </div>
                  <div className="detail-badge-item">
                    <label>Submission Deadline</label>
                    <span className={`detail-deadline-badge ${formatDeadline(selectedTender.deadline).urgent ? 'urgent' : ''}`}>
                      {formatDeadline(selectedTender.deadline).formatted}
                      <span className="days-text">({formatDeadline(selectedTender.deadline).daysText})</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Overview Section */}
              <div className="detail-section">
                <h3 className="section-heading">Tender Summary</h3>
                <p className="summary-text">{selectedTender.summary}</p>

                <a
                  href={selectedTender.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-tender-btn"
                >
                  View Full Tender Notice →
                </a>

                <div className="detailed-description">
                  {selectedTender.detailedDescription.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                <div className="tender-metadata">
                  <div className="metadata-item">
                    <label>Region</label>
                    <span>{selectedTender.region}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Categories</label>
                    <div className="category-tags">
                      {selectedTender.categories.map(cat => (
                        <span key={cat} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  </div>
                  <div className="metadata-item">
                    <label>Status</label>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(selectedTender.status) }}
                    >
                      {selectedTender.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Analysis Status for Live Data */}
              {dataSource === 'live' && apiKeyStatus?.isReady && (
                <div className="detail-section ai-analysis-status-section">
                  {(!selectedTender.ai_analyzed && tenderAnalysisStatus[selectedTender.id] !== 'success') ? (
                    <div className="ai-analysis-banner">
                      <div className="banner-content">
                        <span className="banner-icon">🤖</span>
                        <div className="banner-text">
                          <h4>AI Analysis Not Available</h4>
                          <p>This tender hasn't been analyzed by Claude yet. Click below to generate a strategic fit assessment.</p>
                        </div>
                      </div>
                      <button
                        className="analyze-single-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAnalyzeSingleTender(selectedTender)
                        }}
                        disabled={tenderAnalysisStatus[selectedTender.id] === 'analyzing'}
                      >
                        {tenderAnalysisStatus[selectedTender.id] === 'analyzing' ? 'Analyzing...' : 'Analyze This Tender'}
                      </button>
                    </div>
                  ) : (
                    <div className="ai-analysis-success-banner">
                      <span className="success-icon">✓</span>
                      <span>AI-Powered Strategic Analysis</span>
                      {tenderAnalysisStatus[selectedTender.id] === 'error' && (
                        <button
                          className="retry-analysis-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAnalyzeSingleTender(selectedTender)
                          }}
                        >
                          Retry Analysis
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sirona Fit Analysis Section */}
              <div className="detail-section sirona-fit-section">
                <h3 className="section-heading sirona-heading">Strategic Fit Analysis</h3>

                <div className="alignment-display">
                  <div className="alignment-circle">
                    <svg viewBox="0 0 100 100" className="progress-ring">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#E5E7EB"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="var(--sirona-purple)"
                        strokeWidth="8"
                        strokeDasharray={`${selectedTender.sirona_fit.alignment_score * 2.827} 283`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="alignment-score-display">
                      <span className="score-number">{selectedTender.sirona_fit.alignment_score}%</span>
                      <span className="score-label">Strategic Alignment</span>
                    </div>
                  </div>
                </div>

                <div className="fit-subsection">
                  <h4 className="subsection-heading">Why This Opportunity Fits Sirona</h4>
                  <p className="rationale-text">{selectedTender.sirona_fit.rationale}</p>
                </div>

                <div className="fit-subsection">
                  <h4 className="subsection-heading">Our Win Themes</h4>
                  <ul className="win-themes-list">
                    {selectedTender.sirona_fit.win_themes.map((theme, idx) => (
                      <li key={idx}>
                        <span className="check-icon">✓</span>
                        {theme}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="fit-subsection">
                  <h4 className="subsection-heading">Competitive Landscape</h4>
                  <div className="competitor-chips">
                    {selectedTender.sirona_fit.competitors.map((competitor, idx) => (
                      <span key={idx} className="competitor-chip">{competitor}</span>
                    ))}
                  </div>
                </div>

                <div className="fit-subsection">
                  <h4 className="subsection-heading">Risk Factors & Considerations</h4>
                  <ul className="risk-list">
                    {selectedTender.sirona_fit.weak_spots.map((risk, idx) => (
                      <li key={idx}>
                        <span className="warning-icon">⚠️</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendation Section */}
              <div className="detail-section recommendation-section">
                <h3 className="section-heading">Bid Decision Recommendation</h3>

                <div
                  className="recommendation-display"
                  style={{
                    backgroundColor: getRecommendationColor(selectedTender.sirona_fit.recommendation),
                    color: 'white'
                  }}
                >
                  <span className="recommendation-icon">
                    {getRecommendationIcon(selectedTender.sirona_fit.recommendation)}
                  </span>
                  <span className="recommendation-text">
                    {selectedTender.sirona_fit.recommendation}
                  </span>
                </div>

                <div className="recommendation-rationale">
                  <p><strong>Recommendation Rationale:</strong></p>
                  <p>{selectedTender.sirona_fit.rationale}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="footer">
        <p>&copy; 2026 Sirona Medical. All rights reserved.</p>
      </footer>
    </div>
  )
}

// Wrap App with Error Boundary
function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

export default AppWithErrorBoundary
