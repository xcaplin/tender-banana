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

- Node.js (version 16 or higher)
- npm or yarn package manager
- Git

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

### Initial Setup

1. Ensure your repository is set up on GitHub
2. Make sure the `base` path in `vite.config.js` matches your repository name

### Deploy

To deploy to GitHub Pages:

```bash
npm run deploy
```

This command will:
1. Build the application for production
2. Deploy the `dist/` folder to the `gh-pages` branch
3. Make the site available at `https://xcaplin.github.io/tender-banana/`

### GitHub Pages Configuration

After deploying, ensure GitHub Pages is enabled:
1. Go to your repository on GitHub
2. Navigate to Settings > Pages
3. Under "Source", select "Deploy from a branch"
4. Select the `gh-pages` branch and `/ (root)` folder
5. Click Save

Your site will be live at `https://xcaplin.github.io/tender-banana/`

## Project Structure

```
tender-banana/
├── public/              # Static assets
├── src/
│   ├── App.css         # App component styles
│   ├── App.jsx         # Main App component
│   ├── index.css       # Global styles
│   └── main.jsx        # Application entry point
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
- gh-pages for deployment

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
