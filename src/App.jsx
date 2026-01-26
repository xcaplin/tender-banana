import { useState, useMemo, useEffect } from 'react'
import './App.css'
import tenders from './data/tenders.js'

function App() {
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all')
  const [recommendationFilter, setRecommendationFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState([])
  const [sortBy, setSortBy] = useState('deadline-asc')

  // Detail panel state
  const [selectedTenderId, setSelectedTenderId] = useState(null)

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

  return (
    <div className="app">
      <header className="header">
        <h1>Sirona Tender Intelligence Dashboard</h1>
      </header>

      <div className="filter-bar">
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

      <main className="main-content">
        <div className="tender-list">
          {filteredAndSortedTenders.length === 0 ? (
            <div className="no-results">
              <p>No tenders match your filter criteria.</p>
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setRecommendationFilter('all')
                  setCategoryFilter([])
                }}
                className="reset-filters-btn"
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
          />
          <div className="detail-panel">
            <button
              className="detail-close"
              onClick={() => setSelectedTenderId(null)}
              aria-label="Close detail panel"
            >
              ✕
            </button>

            <div className="detail-content">
              {/* Header Section */}
              <div className="detail-header">
                <h2 className="detail-title">{selectedTender.title}</h2>
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

export default App
