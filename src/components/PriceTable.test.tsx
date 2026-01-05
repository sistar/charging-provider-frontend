import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PriceTable from './PriceTable'
import axios from 'axios'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

// Mock data
const mockPricesData = [
  {
    _id: '1',
    country: 'Austria',
    currency: '€',
    provider: 'IONITY',
    pricing_model_name: 'IONITY PASSPORT POWER',
    price_kWh: 0.39,
    monthly_subscription_price: null,
    yearly_subscription_price: 17.99
  },
  {
    _id: '2',
    country: 'Switzerland',
    currency: 'CHF',
    provider: 'IONITY',
    pricing_model_name: 'IONITY PASSPORT POWER',
    price_kWh: 0.65,
    monthly_subscription_price: null,
    yearly_subscription_price: 19.99
  },
  {
    _id: '3',
    country: 'United Kingdom',
    currency: '£',
    provider: 'IONITY',
    pricing_model_name: 'IONITY PASSPORT POWER',
    price_kWh: 0.55,
    monthly_subscription_price: null,
    yearly_subscription_price: 15.99
  }
]

const mockExchangeRates = {
  CHF: 0.95,
  GBP: 0.85,
  USD: 1.08
}

describe('PriceTable', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
  })

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  it('should not display EUR price twice for EUR currency countries', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('prices')) {
        return Promise.resolve({ data: mockPricesData })
      }
      if (url.includes('exchangerate')) {
        return Promise.resolve({ data: { rates: mockExchangeRates } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    renderWithQueryClient(<PriceTable />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Austria')).toBeInTheDocument()
    })

    // Find the Austria IONITY card
    const austriaCard = screen.getByText('Austria').closest('.bg-white')
    expect(austriaCard).toBeInTheDocument()

    // Verify the price is displayed correctly with € symbol
    expect(austriaCard).toHaveTextContent('€0.39')
    
    // More specific check: verify there's no EUR conversion line (blue text) for EUR currencies
    const blueEurConversions = austriaCard?.querySelectorAll('.text-blue-600')
    const hasEurConversion = Array.from(blueEurConversions || []).some(el => 
      el.textContent?.includes('€0.39')
    )
    expect(hasEurConversion).toBe(false)

    // Verify there's no duplicate by counting exact matches in the full text
    const allText = austriaCard?.textContent || ''
    // Count occurrences of €0.39 - should be exactly 1 (the main price, not a conversion)
    const eurMatches = allText.match(/€0\.39/g) || []
    expect(eurMatches.length).toBe(1)
    
    // Ensure no blue EUR conversion text exists for this EUR currency
    const blueText = austriaCard?.querySelector('.text-blue-600')?.textContent
    if (blueText) {
      expect(blueText).not.toContain('€0.39')
    }
  })

  it('should display EUR conversion for non-EUR currencies', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('prices')) {
        return Promise.resolve({ data: mockPricesData })
      }
      if (url.includes('exchangerate')) {
        return Promise.resolve({ data: { rates: mockExchangeRates } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    renderWithQueryClient(<PriceTable />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Switzerland')).toBeInTheDocument()
    })

    // Find the Switzerland IONITY card
    const swissCard = screen.getByText('Switzerland').closest('.bg-white')
    expect(swissCard).toBeInTheDocument()

    // Check that CHF price is shown
    expect(swissCard).toHaveTextContent('CHF0.65')
    
    // Check that EUR conversion is also shown (0.65 / 0.95 ≈ 0.68)
    expect(swissCard).toHaveTextContent('€0.68')
    
    // Verify both original and converted prices exist
    const allText = swissCard?.textContent || ''
    expect(allText).toMatch(/CHF0\.65/)
    expect(allText).toMatch(/€0\.68/)
  })

  it('should properly handle subscription prices without EUR duplication', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('prices')) {
        return Promise.resolve({ data: mockPricesData })
      }
      if (url.includes('exchangerate')) {
        return Promise.resolve({ data: { rates: mockExchangeRates } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    renderWithQueryClient(<PriceTable />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Austria')).toBeInTheDocument()
    })

    // Find the Austria IONITY card
    const austriaCard = screen.getByText('Austria').closest('.bg-white')
    expect(austriaCard).toBeInTheDocument()

    // Check that EUR subscription price appears only once
    const allText = austriaCard?.textContent || ''
    const subscriptionMatches = allText.match(/€17\.99/g) || []
    expect(subscriptionMatches.length).toBe(1)

    // Verify subscription price is displayed correctly
    expect(austriaCard).toHaveTextContent('€17.99')
  })

  it('should display proper currency symbols for EUR vs non-EUR', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('prices')) {
        return Promise.resolve({ data: mockPricesData })
      }
      if (url.includes('exchangerate')) {
        return Promise.resolve({ data: { rates: mockExchangeRates } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    renderWithQueryClient(<PriceTable />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Austria')).toBeInTheDocument()
      expect(screen.getByText('Switzerland')).toBeInTheDocument()
      expect(screen.getByText('United Kingdom')).toBeInTheDocument()
    })

    // Check Austria (EUR) - should use € symbol
    const austriaCard = screen.getByText('Austria').closest('.bg-white')
    expect(austriaCard).toHaveTextContent('€0.39')
    expect(austriaCard).not.toHaveTextContent('EUR0.39')

    // Check Switzerland (CHF) - should show CHF and EUR conversion
    const swissCard = screen.getByText('Switzerland').closest('.bg-white')
    expect(swissCard).toHaveTextContent('CHF0.65')
    expect(swissCard).toHaveTextContent('€0.68')

    // Check UK (GBP) - should show £ and EUR conversion  
    const ukCard = screen.getByText('United Kingdom').closest('.bg-white')
    expect(ukCard).toHaveTextContent('£0.55')
    expect(ukCard).toHaveTextContent('€0.65') // 0.55 / 0.85 ≈ 0.65
  })
})