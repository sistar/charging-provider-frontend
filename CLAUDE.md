# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React/TypeScript frontend application for displaying IONITY electric vehicle charging prices. The application:
- Displays pricing data across European countries
- Shows per-kWh charging prices and subscription costs
- Converts non-EUR prices to EUR for comparison
- Built with React 19, TypeScript, Vite, and TailwindCSS 4
- Uses TanStack Query for data fetching and caching

## Development Commands

### Running the Application
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (TypeScript compile + Vite build)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on the codebase

### Testing
- `npm test` - Run tests in watch mode with Vitest
- `npm run test:ui` - Run tests with Vitest UI

## Architecture

### Data Flow
1. Fetches pricing data from backend API: `https://charging-provider-backend.onrender.com/api/prices`
2. Fetches exchange rates from: `https://api.exchangerate-api.com/v4/latest/EUR`
3. Displays prices grouped by country and provider
4. Converts non-EUR currencies to EUR for easy comparison

### Key Components
- **PriceTable** (`src/components/PriceTable.tsx`) - Main component that fetches and displays pricing data
  - Groups pricing models by country and provider
  - Calculates EUR conversions for non-EUR prices
  - Displays both monthly and yearly subscription options
  - Shows "Free - No subscription required" when neither subscription exists

### Data Model
The `PriceEntry` interface includes:
- `country`, `currency`, `provider`, `pricing_model_name` (strings)
- `price_kWh` (number) - Price per kilowatt-hour
- `monthly_subscription_price` (number, optional) - Monthly subscription fee
- `yearly_subscription_price` (number, optional) - Yearly subscription fee

### Technology Stack
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS 4** - Styling
- **TanStack Query** - Data fetching and caching
- **Axios** - HTTP client
- **Vitest** - Testing framework
- **Testing Library** - React component testing

## Deployment

### Production
- **Platform**: Vercel
- **Production URL**: https://charging-prices-dxrnwr4pw-ralf-sigmunds-projects.vercel.app
- **Deployment method**: Vercel CLI (`vercel --prod`)
- **Deployment trigger**: Manual deployment via CLI or automatic via Vercel GitHub integration

### Deploying
To deploy to production:
```bash
vercel --prod
```

The deployment will:
1. Build the TypeScript code
2. Bundle the application with Vite
3. Deploy to Vercel's production environment
4. Return a production URL and inspection link

## Environment
- No environment variables required (API URLs are hardcoded)
- All external dependencies are managed via npm
