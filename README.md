# Sirona Tender Intelligence Dashboard

## Overview

Strategic tender opportunity tracker for Sirona Care & Health CIC, providing intelligent analysis of procurement opportunities across BNSSG region. The dashboard enables data-driven bid/no-bid decisions through automated strategic fit analysis and competitive intelligence.

## Features

- **Real-time Tender Tracking**: Monitor NHS and public sector procurement opportunities
- **Strategic Fit Analysis**: AI-powered alignment scoring against organizational capabilities
- **Competitive Intelligence**: Track competitors and identify market positioning
- **Risk Assessment**: Automated identification of weak spots and mitigation strategies
- **Bid/No-Bid Recommendations**: Data-driven decision support (Strong Go, Conditional Go, No Bid, Monitor)
- **Pipeline Analytics**: Interactive summary cards showing total value, urgent deadlines, and success metrics
- **Advanced Filtering**: Multi-dimensional filtering by status, recommendation, category, and deadline
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: WCAG AA compliant with keyboard navigation and screen reader support
- **Collapsible Panels**: Maximize screen space with expandable/collapsible sections

## Live Site

Visit the live dashboard at: **https://xcaplin.github.io/tender-banana/**

## How It Works

This application is a single-page React application that deploys automatically to GitHub Pages via GitHub Actions. Whenever changes are pushed to the main branch, the application is automatically rebuilt and deployed with zero downtime.

The dashboard loads tender data from a static JSON file and provides client-side filtering, sorting, and analysis - no backend infrastructure required.

## Project Structure

```
tender-banana/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions deployment workflow
├── public/
│   └── favicon.svg          # Sirona favicon
├── src/
│   ├── App.jsx              # Main application component with UI logic
│   ├── App.css              # Application styles and responsive design
│   ├── main.jsx             # React entry point
│   ├── index.css            # Global styles and CSS custom properties
│   └── data/
│       └── tenders.js       # Tender opportunity data
├── index.html               # HTML shell with meta tags
├── vite.config.js           # Vite build configuration
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

## Adding New Tenders

To add new tender opportunities to the dashboard:

1. Edit `src/data/tenders.js`
2. Add a new tender object following the existing structure:

```javascript
{
  id: "TND-2026-XXX",
  title: "Tender Title",
  organization: "Contracting Authority Name",
  value: 5000000,  // Contract value in pounds
  deadline: "2026-XX-XXTXX:XX:XXZ",  // ISO 8601 format
  status: "new",  // new | reviewing | go | no-go
  summary: "Brief one-line description...",
  detailedDescription: "Full multi-paragraph description...",
  sirona_fit: {
    alignment_score: 85,  // 0-100
    rationale: "Why this fits Sirona...",
    win_themes: [
      "Competitive advantage 1",
      "Competitive advantage 2",
      // ... up to 5 themes
    ],
    competitors: ["Company A", "Company B", "Company C"],
    weak_spots: ["Risk factor 1", "Risk factor 2"],
    recommendation: "Strong Go"  // Strong Go | Conditional Go | No Bid | Monitor
  },
  categories: ["Category 1", "Category 2"],
  region: "Region Name",
  url: "https://www.contractsfinder.service.gov.uk/notice/..."
}
```

3. Commit your changes to the main branch:

```bash
git add src/data/tenders.js
git commit -m "Add new tender: [Tender Title]"
git push origin main
```

4. GitHub Actions will automatically rebuild and deploy within 2-3 minutes

## Tender Data Structure Reference

Each tender requires the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier (e.g., "TND-2026-001") |
| `title` | String | Tender opportunity title |
| `organization` | String | Contracting authority name |
| `value` | Number | Contract value in pounds |
| `deadline` | String | Submission deadline (ISO 8601) |
| `status` | Enum | new \| reviewing \| go \| no-go |
| `summary` | String | One-line summary |
| `detailedDescription` | String | Full description (multi-paragraph) |
| `sirona_fit.alignment_score` | Number | Strategic fit score (0-100) |
| `sirona_fit.rationale` | String | Why this opportunity fits |
| `sirona_fit.win_themes` | Array | Competitive advantages (3-5 items) |
| `sirona_fit.competitors` | Array | Known competitors (3-5 items) |
| `sirona_fit.weak_spots` | Array | Risk factors (2-4 items) |
| `sirona_fit.recommendation` | Enum | Strong Go \| Conditional Go \| No Bid \| Monitor |
| `categories` | Array | Tender categories (2-4 items) |
| `region` | String | Geographic region |
| `url` | String | Link to Contracts Finder notice |

## Local Development (Optional)

If you want to run the dashboard locally for testing:

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/xcaplin/tender-banana.git
cd tender-banana
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Building Locally

To create a production build:
```bash
npm run build
```

To preview the production build:
```bash
npm run preview
```

## Deployment

### Automatic Deployment (Recommended)

Deployment is fully automated via GitHub Actions:

1. Make changes to your code
2. Commit and push to the `main` branch
3. GitHub Actions automatically:
   - Checks out the code
   - Installs Node.js 20 and dependencies
   - Builds the React application
   - Deploys to GitHub Pages

The site updates within 2-3 minutes at `https://xcaplin.github.io/tender-banana/`

### Manual Deployment

You can also manually trigger a deployment:

1. Go to the **Actions** tab in your GitHub repository
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"
4. Select the `main` branch
5. Click "Run workflow"

### Monitoring Deployments

Check deployment status:

- Visit the **Actions** tab in your repository
- Each deployment shows as a workflow run
- Click any run to view detailed build and deployment logs
- Green checkmark = successful deployment
- Red X = failed deployment (check logs for errors)

## Technology Stack

- **React 18**: Modern UI framework with hooks
- **Vite 6**: Lightning-fast build tool and dev server
- **CSS3**: Custom properties for theming, Grid and Flexbox for layouts
- **GitHub Pages**: Free hosting for static sites
- **GitHub Actions**: Automated CI/CD pipeline

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari 12+, Chrome Mobile)

## Accessibility

This dashboard meets WCAG 2.1 AA standards:

- Keyboard navigation support (Tab, Enter, Space, ESC)
- ARIA labels and roles for screen readers
- Skip-to-content link for keyboard users
- Color contrast ratios meet AA standards
- Focus indicators on all interactive elements
- Semantic HTML structure

## Future Enhancements

Potential features for future development:

- **CSV Export**: Download tender data and analytics
- **Contracts Finder API Integration**: Automatic tender discovery
- **Email Alerts**: Notifications for new high-value opportunities
- **Team Collaboration**: Comments and decision tracking
- **Historical Analytics**: Trend analysis and win/loss tracking
- **Custom Scoring Models**: Configurable alignment criteria
- **Multi-User Support**: Role-based access control

## Customization

### Branding Colors

Primary colors are defined in `src/index.css`:

```css
:root {
  --sirona-purple: #7B2D8E;
  --sirona-purple-light: #9B4DAE;
  --sirona-purple-dark: #5B1D6E;
  --background: #F5F5F7;
  --card-background: #FFFFFF;
  --text-primary: #1D1D1F;
  --text-secondary: #6E6E73;
  --border-color: #D2D2D7;
}
```

### Font Family

The Aptos font family is used throughout with fallbacks:

```css
font-family: Aptos, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif;
```

## Troubleshooting

### Deployment fails with 403 error

- Ensure GitHub Pages is enabled in repository settings
- Verify the workflow has permissions to deploy (Settings > Actions > General)
- Check that the branch name matches the workflow configuration

### Changes not appearing on live site

- Allow 2-3 minutes for GitHub Pages to update
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check Actions tab to confirm deployment succeeded

### Build fails locally

- Ensure you're using Node.js 16 or higher (`node --version`)
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Check console for specific error messages

## License

Copyright © 2026 Sirona Medical. All rights reserved.

## Support

For issues, questions, or feature requests:

- Open an issue on the [GitHub repository](https://github.com/xcaplin/tender-banana/issues)
- Contact the development team
- Review the [GitHub Actions logs](https://github.com/xcaplin/tender-banana/actions) for deployment issues

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test locally with `npm run dev` and `npm run build`
4. Commit with descriptive messages
5. Push to GitHub and create a Pull Request
6. Wait for review and approval before merging to `main`

---

Built with ❤️ by Sirona Medical
