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

interface HouseholdPrice {
  country: string;
  priceEUR: number;
}

const fetchPrices = async (): Promise<PriceEntry[]> => {
  const { data } = await axios.get("https://charging-provider-backend.onrender.com/api/prices");
  return data;
};

const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const { data } = await axios.get("https://api.exchangerate-api.com/v4/latest/EUR");
  return data.rates;
};

const fetchHouseholdPrices = async (): Promise<HouseholdPrice[]> => {
  const { data } = await axios.get("/nrg_pc_204_page_linear.csv");

  // Parse CSV - handle quoted fields properly
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const lines = data.split('\n').slice(1); // Skip header
  const prices: HouseholdPrice[] = [];

  // Country name mapping from CSV to our charging data
  const countryMap: { [key: string]: string } = {
    'Czechia': 'Czech Republic',
    'North Macedonia': 'Macedonia'
  };

  for (const line of lines) {
    if (!line.trim()) continue;

    const columns = parseCSVLine(line);
    if (columns.length < 11) continue;

    let country = columns[8];
    const priceStr = columns[10];

    // Skip aggregated regions
    if (country.includes('Euro area') || country.includes('European Union')) continue;

    // Map country names to match our charging data
    country = countryMap[country] || country;

    const price = parseFloat(priceStr);
    if (!isNaN(price) && price > 0) {
      prices.push({ country, priceEUR: price });
    }
  }

  return prices;
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

  const { data: householdData, error: householdError, isLoading: householdLoading } = useQuery({
    queryKey: ["householdPrices"],
    queryFn: fetchHouseholdPrices,
  });

  if (pricesLoading || ratesLoading || householdLoading) return <p className="text-center">Loading comparison...</p>;
  if (pricesError || ratesError || householdError) return <p className="text-center text-red-500">Error loading data</p>;

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

  // Add 8% padding on each side so min/max prices aren't at the edges
  const padding = priceRange * 0.08;
  const paddedMin = minPrice - padding;
  const paddedMax = maxPrice + padding;
  const paddedRange = paddedMax - paddedMin;

  // Create household price lookup
  const householdPriceMap = new Map<string, number>();
  (householdData || []).forEach(h => {
    householdPriceMap.set(h.country, h.priceEUR);
  });

  // Filter charging prices to only countries with household data
  const countriesWithBothPrices = power365Prices.filter(p => householdPriceMap.has(p.country));

  // Calculate household price range
  const householdPrices = Array.from(householdPriceMap.values());
  const minHousehold = Math.min(...householdPrices);
  const maxHousehold = Math.max(...householdPrices);
  const householdRange = maxHousehold - minHousehold;
  const householdPadding = householdRange * 0.08;
  const paddedMinHousehold = minHousehold - householdPadding;
  const paddedMaxHousehold = maxHousehold + householdPadding;
  const paddedRangeHousehold = paddedMaxHousehold - paddedMinHousehold;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 border border-gray-100">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">IONITY Power 365 vs Household Electricity Prices</h2>
        <p className="text-gray-600">Comparing charging prices with household electricity costs across Europe (all in EUR/kWh)</p>
      </div>

      <div className="relative py-8">
        {/* Dual-bar visualization */}
        <div className="relative" style={{ minHeight: '600px' }}>
          {/* Charging price bar (top) */}
          <div className="mb-6">
            <div className="text-sm font-semibold text-gray-700 mb-2">IONITY Power 365 Charging Price</div>
            <div className="relative h-3 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full mb-2"></div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>€{minPrice.toFixed(2)}/kWh</span>
              <span>€{maxPrice.toFixed(2)}/kWh</span>
            </div>
          </div>

          {/* Household price bar (bottom) */}
          <div className="mb-12">
            <div className="text-sm font-semibold text-gray-700 mb-2">Household Electricity Price</div>
            <div className="relative h-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full mb-2"></div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>€{minHousehold.toFixed(2)}/kWh</span>
              <span>€{maxHousehold.toFixed(2)}/kWh</span>
            </div>
          </div>

          {/* Country connectors and labels */}
          <svg className="absolute top-0 left-0 right-0" style={{ height: '600px', width: '100%' }} preserveAspectRatio="none">
            {(() => {
              // Calculate all positions and sort by household position for better layout
              const countryData = countriesWithBothPrices.map((country) => {
                const chargingPos = ((country.priceEUR - paddedMin) / paddedRange) * 100;
                const householdPrice = householdPriceMap.get(country.country) || 0;
                const householdPos = ((householdPrice - paddedMinHousehold) / paddedRangeHousehold) * 100;
                return {
                  country: country.country,
                  chargingPos,
                  householdPos,
                  chargingPrice: country.priceEUR,
                  householdPrice,
                };
              }).sort((a, b) => a.householdPos - b.householdPos);

              // Assign label vertical positions with collision detection
              const labelSpacing = 22; // pixels between labels
              const labelStartY = 140; // start position for labels
              const labelPositions: number[] = [];

              countryData.forEach((_, index) => {
                labelPositions.push(labelStartY + index * labelSpacing);
              });

              return countryData.map((data, index) => {
                const labelY = labelPositions[index];
                const midX = (data.chargingPos + data.householdPos) / 2;

                return (
                  <g key={data.country}>
                    {/* Charging price dot */}
                    <circle
                      cx={`${data.chargingPos}%`}
                      cy="27"
                      r="6"
                      className="fill-orange-600 stroke-white stroke-2"
                      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                    />

                    {/* Household price dot */}
                    <circle
                      cx={`${data.householdPos}%`}
                      cy="106"
                      r="6"
                      className="fill-indigo-600 stroke-white stroke-2"
                      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                    />

                    {/* Main connector line */}
                    <line
                      x1={`${data.chargingPos}%`}
                      y1="27"
                      x2={`${data.householdPos}%`}
                      y2="106"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      opacity="0.5"
                    />

                    {/* Label connector line - from midpoint to label */}
                    <line
                      x1={`${midX}%`}
                      y1="66.5"
                      x2={`${midX}%`}
                      y2={labelY - 5}
                      stroke="#94a3b8"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.4"
                    />

                    {/* Label background and text */}
                    <foreignObject
                      x={`calc(${midX}% - 60px)`}
                      y={labelY - 3}
                      width="120"
                      height="60"
                    >
                      <div className="flex flex-col items-center">
                        <div className="bg-white border border-gray-300 rounded px-2 py-1 shadow-sm">
                          <div className="text-[11px] font-semibold text-gray-800 whitespace-nowrap">
                            {data.country}
                          </div>
                        </div>
                        <div className="text-[9px] text-orange-600 mt-1">
                          C: €{data.chargingPrice.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-indigo-600">
                          H: €{data.householdPrice.toFixed(2)}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              });
            })()}
          </svg>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          Showing {countriesWithBothPrices.length} countries with both charging and household electricity pricing data
        </p>
        <p className="text-xs text-gray-500 text-center mt-2">
          C = Charging price (IONITY Power 365) · H = Household electricity price · Lines show correlation between the two
        </p>
      </div>
    </div>
  );
};

export default PriceComparison;
