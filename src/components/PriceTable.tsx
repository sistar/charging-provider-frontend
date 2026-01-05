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

const fetchPrices = async (): Promise<PriceEntry[]> => {
  const { data } = await axios.get("https://charging-provider-backend.onrender.com/api/prices");
  return data;
};

const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const { data } = await axios.get("https://api.exchangerate-api.com/v4/latest/EUR");
  return data.rates;
};

// Convert price to EUR if not already in EUR
const convertToEUR = (price: number, currency: string, rates: ExchangeRates): number => {
  const cleanCurrency = currency.trim();
  if (cleanCurrency === "€" || cleanCurrency.toUpperCase() === "EUR") return price;
  
  // Map currency symbols to codes for exchange rate lookup
  const currencyMap: { [key: string]: string } = {
    "£": "GBP",
    "$": "USD",
    "€": "EUR"
  };
  
  const currencyCode = currencyMap[cleanCurrency] || cleanCurrency.toUpperCase();
  const rate = rates[currencyCode];
  if (!rate) return price; // Fallback if rate not available
  return price / rate;
};

// Group prices by country & provider
const groupByProvider = (prices: PriceEntry[]) => {
  const grouped: Record<string, { country: string; provider: string; models: PriceEntry[] }> = {};

  prices.forEach((entry) => {
    const key = `${entry.country}-${entry.provider}`;
    if (!grouped[key]) {
      grouped[key] = { country: entry.country, provider: entry.provider, models: [] };
    }
    if (grouped[key].models.length < 4) {
      // Limit to 4 models per row
      grouped[key].models.push(entry);
    }
  });

  return Object.values(grouped);
};

const PriceTable: React.FC = () => {
  const { data: pricesData, error: pricesError, isLoading: pricesLoading } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
  });

  const { data: exchangeRates, error: ratesError, isLoading: ratesLoading } = useQuery({
    queryKey: ["exchangeRates"],
    queryFn: fetchExchangeRates,
  });

  if (pricesLoading || ratesLoading) return <p className="text-center">Loading prices...</p>;
  if (pricesError || ratesError) return <p className="text-center text-red-500">Error loading data</p>;

  const groupedData = groupByProvider(pricesData || []);

  return (
    <>
      {/* Cards Grid */}
      <div className="grid gap-8 md:gap-12">
          {groupedData.map(({ country, provider, models }) => (
            <div key={`${country}-${provider}`} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{provider}</h2>
                    <p className="text-blue-100 text-lg">{country}</p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm">
                      {models.length} pricing model{models.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing Models */}
              <div className="p-8">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {models.map((model) => {
                    const isEUR = model.currency.trim() === "€" || model.currency.trim().toUpperCase() === "EUR";
                    const priceInEUR = !isEUR && exchangeRates ? convertToEUR(model.price_kWh, model.currency, exchangeRates).toFixed(2) : null;
                    const monthlyInEUR = !isEUR && model.monthly_subscription_price && exchangeRates
                      ? convertToEUR(model.monthly_subscription_price, model.currency, exchangeRates).toFixed(2)
                      : null;
                    const yearlyInEUR = !isEUR && model.yearly_subscription_price && exchangeRates
                      ? convertToEUR(model.yearly_subscription_price, model.currency, exchangeRates).toFixed(2)
                      : null;

                    const hasSubscription = model.monthly_subscription_price || model.yearly_subscription_price;

                    return (
                      <div key={model._id} className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200">
                        <h3 className="font-bold text-lg text-gray-900 mb-4 min-h-[2.5rem] flex items-center">
                          {model.pricing_model_name}
                        </h3>

                        {/* Per kWh Price */}
                        <div className="mb-4">
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            {model.currency}{model.price_kWh.toFixed(2)}
                            <span className="text-sm font-normal text-gray-600 ml-1">/ kWh</span>
                          </div>
                          {!isEUR && priceInEUR && (
                            <div className="text-lg text-blue-600 font-semibold">
                              €{priceInEUR} / kWh
                            </div>
                          )}
                        </div>

                        {/* Subscription Prices */}
                        <div className="pt-4 border-t border-gray-200 space-y-3">
                          {hasSubscription ? (
                            <>
                              {model.monthly_subscription_price && (
                                <div>
                                  <div className="text-sm text-gray-600 mb-1">Monthly subscription</div>
                                  <div className="text-lg font-semibold text-gray-900">
                                    {model.currency}{model.monthly_subscription_price.toFixed(2)}
                                    <span className="text-sm font-normal text-gray-600">/month</span>
                                  </div>
                                  {!isEUR && monthlyInEUR && (
                                    <div className="text-blue-600 font-medium">
                                      €{monthlyInEUR}/month
                                    </div>
                                  )}
                                </div>
                              )}
                              {model.yearly_subscription_price && (
                                <div>
                                  <div className="text-sm text-gray-600 mb-1">Yearly subscription</div>
                                  <div className="text-lg font-semibold text-gray-900">
                                    {model.currency}{model.yearly_subscription_price.toFixed(2)}
                                    <span className="text-sm font-normal text-gray-600">/year</span>
                                  </div>
                                  {!isEUR && yearlyInEUR && (
                                    <div className="text-blue-600 font-medium">
                                      €{yearlyInEUR}/year
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div>
                              <div className="text-sm text-gray-600 mb-1">Subscription</div>
                              <div className="text-gray-500 italic">Free - No subscription required</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Fill empty slots for visual consistency */}
                  {Array.from({ length: 4 - models.length }).map((_, index) => (
                    <div key={`empty-${index}`} className="bg-gray-50/50 rounded-xl p-6 border border-dashed border-gray-300 flex items-center justify-center min-h-[200px]">
                      <span className="text-gray-400 text-sm">No additional plans</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-12 pt-8 border-t border-gray-200">
        <p className="text-gray-600">
          Prices are updated in real-time. Currency conversions are approximate and for comparison purposes only.
        </p>
      </div>
    </>
  );
};

export default PriceTable;