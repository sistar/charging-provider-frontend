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

  // Parse CSV (skip header row)
  const lines = data.split('\n').slice(1);
  const prices: HouseholdPrice[] = [];

  // Country name mapping from CSV to our charging data
  const countryMap: { [key: string]: string } = {
    'Czechia': 'Czech Republic',
    'North Macedonia': 'Macedonia'
  };

  for (const line of lines) {
    if (!line.trim()) continue;

    const columns = line.split(',');
    if (columns.length < 11) continue;

    let country = columns[8].trim();
    const priceStr = columns[10].trim();

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
        <div className="relative" style={{ minHeight: '350px' }}>
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

          {/* Country connectors */}
          <div className="absolute top-0 left-0 right-0" style={{ height: '180px' }}>
            {countriesWithBothPrices.map((country) => {
              const chargingPos = ((country.priceEUR - paddedMin) / paddedRange) * 100;
              const householdPrice = householdPriceMap.get(country.country) || 0;
              const householdPos = ((householdPrice - paddedMinHousehold) / paddedRangeHousehold) * 100;

              return (
                <div key={country.country}>
                  {/* Charging price dot */}
                  <div
                    className="absolute w-3 h-3 bg-orange-600 rounded-full border-2 border-white shadow-sm"
                    style={{
                      left: `${chargingPos}%`,
                      top: '27px',
                      transform: 'translateX(-50%)',
                      zIndex: 20
                    }}
                  ></div>

                  {/* Household price dot */}
                  <div
                    className="absolute w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-sm"
                    style={{
                      left: `${householdPos}%`,
                      top: '106px',
                      transform: 'translateX(-50%)',
                      zIndex: 20
                    }}
                  ></div>

                  {/* Connector line */}
                  <svg
                    className="absolute pointer-events-none"
                    style={{
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '180px',
                      zIndex: 10
                    }}
                  >
                    <line
                      x1={`${chargingPos}%`}
                      y1="27"
                      x2={`${householdPos}%`}
                      y2="106"
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      opacity="0.4"
                    />
                  </svg>

                  {/* Country label */}
                  <div
                    className="absolute whitespace-nowrap text-center"
                    style={{
                      left: `${(chargingPos + householdPos) / 2}%`,
                      top: '140px',
                      transform: 'translateX(-50%)',
                      width: '100px'
                    }}
                  >
                    <div className="text-[10px] font-semibold text-gray-700">{country.country}</div>
                    <div className="text-[9px] text-orange-600">C: €{country.priceEUR.toFixed(2)}</div>
                    <div className="text-[9px] text-indigo-600">H: €{householdPrice.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
          </div>
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
