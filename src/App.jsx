import './App.css'

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Sirona Tender Intelligence Dashboard</h1>
      </header>

      <main className="main-content">
        <div className="placeholder-content">
          <h2>Welcome to the Tender Intelligence Dashboard</h2>
          <p>This dashboard will provide insights and analytics for tender opportunities.</p>
          <div className="info-cards">
            <div className="info-card">
              <h3>Active Tenders</h3>
              <p className="metric">--</p>
            </div>
            <div className="info-card">
              <h3>Opportunities</h3>
              <p className="metric">--</p>
            </div>
            <div className="info-card">
              <h3>In Progress</h3>
              <p className="metric">--</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; 2026 Sirona Medical. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
