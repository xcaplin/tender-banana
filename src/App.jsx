import { useState, useMemo, useEffect, Component } from 'react'
import './App.css'
import tenders from './data/tenders.js'

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

  // Simulate initial data load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

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

  // Extract unique categories from all tenders
  const allCategories = useMemo(() => {
    const categorySet = new Set()
    tenders.forEach(tender => {
      tender.categories.forEach(cat => categorySet.add(cat))
    })
    return Array.from(categorySet).sort()
  }, [])

  // Filter and sort tenders
  const filteredAndSortedTenders = useMemo(() => {
    let filtered = tenders.filter(tender => {
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

  // Empty data state (if no tenders exist at all)
  if (tenders.length === 0) {
    return (
      <div className="app">
        <header className="header">
          <h1>Sirona Tender Intelligence Dashboard</h1>
        </header>
        <div className="empty-data-container">
          <div className="empty-icon">📋</div>
          <h2>No Tender Data Available</h2>
          <p>There are currently no tender opportunities in the system. Please check back later.</p>
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
        <h1>Sirona Tender Intelligence Dashboard</h1>
      </header>

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

        <div className="tender-count">
          Showing <strong>{filteredAndSortedTenders.length}</strong> of <strong>{tenders.length}</strong> opportunities
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
                      <h3 className="tender-title">{tender.title}</h3>
                      <div className="tender-badges">
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
