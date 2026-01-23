# Sirona Tender Intelligence Dashboard

A GitHub Pages-compatible React application for tracking and analyzing tender opportunities. Built with React, Vite, and styled with Sirona's brand colors.

## Features

- Single-page React application
- No backend requirements
- Sirona purple branding (#7B2D8E)
- Aptos font family with fallbacks
- Responsive design for mobile and desktop
- Optimized for GitHub Pages deployment

## Prerequisites

**For deployment to GitHub Pages:**
- A GitHub account with repository access
- Git (for pushing code)

**For local development (optional):**
- Node.js (version 16 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/xcaplin/tender-banana.git
cd tender-banana
```

2. Install dependencies:
```bash
npm install
```

## Development

To run the application locally:

```bash
npm run dev
```

This will start the development server at `http://localhost:5173` (default Vite port).

## Building

To create a production build:

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

## Deployment to GitHub Pages

This project uses GitHub Actions to automatically build and deploy to GitHub Pages whenever code is pushed to the `main` or `master` branch.

### Initial Setup

1. Push your code to the `main` branch on GitHub
2. Go to your repository on GitHub
3. Navigate to **Settings > Pages**
4. Under "Source", select **"GitHub Actions"**
5. The workflow will automatically trigger on push

### Automatic Deployment

The deployment process is fully automated:
- When you push to `main` or `master`, GitHub Actions automatically:
  1. Checks out the code
  2. Installs Node.js and dependencies
  3. Builds the React application
  4. Deploys the `dist/` folder to GitHub Pages

Your site will be live at `https://xcaplin.github.io/tender-banana/`

### Manual Deployment

You can also manually trigger a deployment:
1. Go to the **Actions** tab in your repository
2. Select the "Deploy to GitHub Pages" workflow
3. Click "Run workflow"
4. Select the branch and click "Run workflow"

### Deployment Status

Check the status of your deployments:
- Visit the **Actions** tab in your repository
- Each deployment will show as a workflow run
- Click on any run to see detailed logs

## Project Structure

```
tender-banana/
├── .github/
│   └── workflows/
│       └── deploy.yml  # GitHub Actions deployment workflow
├── public/              # Static assets
├── src/
│   ├── App.css         # App component styles
│   ├── App.jsx         # Main App component
│   ├── index.css       # Global styles
│   └── main.jsx        # Application entry point
├── .gitignore          # Git ignore file
├── index.html          # HTML template
├── package.json        # Project dependencies and scripts
├── vite.config.js      # Vite configuration
└── README.md          # This file
```

## Customization

### Branding Colors

The primary Sirona purple color and related variables are defined in `src/index.css`:

```css
:root {
  --sirona-purple: #7B2D8E;
  --sirona-purple-light: #9B4DAE;
  --sirona-purple-dark: #5B1D6E;
}
```

### Font Family

The Aptos font is used throughout the application with fallbacks defined in `src/index.css`.

## Technologies Used

- React 18
- Vite 6
- CSS3 (Custom Properties)
- GitHub Pages for hosting
- GitHub Actions for automated deployment

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Copyright © 2026 Sirona Medical. All rights reserved.

## Support

For issues or questions, please open an issue on the GitHub repository.
