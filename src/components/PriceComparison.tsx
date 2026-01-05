import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface PriceEntry {
  _id: string;
  country: string;
  currency: string;
  provider: string;
  pricing_model_name: string;
  price_kWh: number;
  monthly_subscription_price?: number | null;
  yearly_subscription_price?: number | null;
}

interface ExchangeRates {
  [key: string]: number;
}

interface CountryPrice {
  country: string;
  priceEUR: number;
  originalPrice: number;
  currency: string;
}

const fetchPrices = async (): Promise<PriceEntry[]> => {
  const { data } = await axios.get("https://charging-provider-backend.onrender.com/api/prices");
  return data;
};

const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const { data } = await axios.get("https://api.exchangerate-api.com/v4/latest/EUR");
  return data.rates;
};

const convertToEUR = (price: number, currency: string, rates: ExchangeRates): number => {
  const cleanCurrency = currency.trim();
  if (cleanCurrency === "€" || cleanCurrency.toUpperCase() === "EUR") return price;

  const currencyMap: { [key: string]: string } = {
    "£": "GBP",
    "$": "USD",
    "€": "EUR",
    "kr": "SEK"  // Swedish Krona
  };

  const currencyCode = currencyMap[cleanCurrency] || cleanCurrency.toUpperCase();
  const rate = rates[currencyCode];
  if (!rate) return price;
  return price / rate;
};

const PriceComparison: React.FC = () => {
  const { data: pricesData, error: pricesError, isLoading: pricesLoading } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
  });

  const { data: exchangeRates, error: ratesError, isLoading: ratesLoading } = useQuery({
    queryKey: ["exchangeRates"],
    queryFn: fetchExchangeRates,
  });

  if (pricesLoading || ratesLoading) return <p className="text-center">Loading comparison...</p>;
  if (pricesError || ratesError) return <p className="text-center text-red-500">Error loading data</p>;

  // Filter for IONITY Power 365 and convert to EUR
  const power365Prices: CountryPrice[] = (pricesData || [])
    .filter(p => p.pricing_model_name === "IONITY Power 365")
    .map(p => ({
      country: p.country,
      priceEUR: exchangeRates ? convertToEUR(p.price_kWh, p.currency, exchangeRates) : p.price_kWh,
      originalPrice: p.price_kWh,
      currency: p.currency
    }))
    .sort((a, b) => a.priceEUR - b.priceEUR);

  if (power365Prices.length === 0) {
    return null;
  }

  const minPrice = Math.min(...power365Prices.map(p => p.priceEUR));
  const maxPrice = Math.max(...power365Prices.map(p => p.priceEUR));
  const priceRange = maxPrice - minPrice;

  // Group countries by price (rounded to 2 decimals)
  const priceGroups = power365Prices.reduce((groups, item) => {
    const roundedPrice = item.priceEUR.toFixed(2);
    if (!groups[roundedPrice]) {
      groups[roundedPrice] = [];
    }
    groups[roundedPrice].push(item);
    return groups;
  }, {} as Record<string, CountryPrice[]>);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 border border-gray-100">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">IONITY Power 365 Price Comparison</h2>
        <p className="text-gray-600">Per kWh pricing across Europe (converted to EUR)</p>
      </div>

      <div className="relative pt-12 pb-8">
        {/* Price axis line */}
        <div className="absolute left-0 right-0 h-2 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full"
             style={{ top: '50%', transform: 'translateY(-50%)' }}></div>

        {/* Country markers */}
        <div className="relative" style={{ minHeight: '300px' }}>
          {Object.entries(priceGroups).map(([priceStr, countries], groupIndex) => {
            const price = parseFloat(priceStr);
            const position = ((price - minPrice) / priceRange) * 100;
            const isEven = groupIndex % 2 === 0;
            const groupSize = countries.length;

            return countries.map((item, countryIndex) => {
              // Stack countries vertically when they share the same price
              const stackOffset = (countryIndex - (groupSize - 1) / 2) * 30;

              return (
                <div
                  key={item.country}
                  className="absolute"
                  style={{
                    left: `${position}%`,
                    top: '50%',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {/* Connector line */}
                  <div
                    className="absolute w-px bg-gray-400"
                    style={{
                      left: '50%',
                      height: Math.abs(stackOffset) + 80,
                      top: stackOffset < 0 ? stackOffset - 80 : 0,
                      transform: 'translateX(-50%)'
                    }}
                  ></div>

                  {/* Price point on the line */}
                  <div
                    className="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg"
                    style={{
                      left: '50%',
                      top: '0',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10
                    }}
                  ></div>

                  {/* Country label - stacked vertically */}
                  <div
                    className="absolute whitespace-nowrap"
                    style={{
                      left: isEven ? '100%' : 'auto',
                      right: isEven ? 'auto' : '100%',
                      top: `${stackOffset - 10}px`,
                      paddingLeft: isEven ? '12px' : '0',
                      paddingRight: isEven ? '0' : '12px',
                      textAlign: isEven ? 'left' : 'right'
                    }}
                  >
                    <div className="text-sm font-semibold text-gray-900">{item.country}</div>
                    <div className="text-base font-bold text-blue-600">€{item.priceEUR.toFixed(2)}</div>
                    {item.currency !== "€" && (
                      <div className="text-xs text-gray-500">
                        {item.currency}{item.originalPrice.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>

        {/* Price scale labels */}
        <div className="flex justify-between mt-8 text-sm text-gray-600">
          <div>
            <div className="font-semibold">Lowest</div>
            <div className="text-xl font-bold text-green-600">€{minPrice.toFixed(2)}/kWh</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Highest</div>
            <div className="text-xl font-bold text-red-600">€{maxPrice.toFixed(2)}/kWh</div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          Showing {power365Prices.length} countries with IONITY Power 365 pricing
        </p>
      </div>
    </div>
  );
};

export default PriceComparison;
