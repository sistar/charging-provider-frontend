import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface PriceEntry {
  _id: string;
  country: string;
  currency: string;
  provider: string;
  pricing_model_name: string;
  price_kWh: number;
  subscription_price?: number;
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
  if (currency === "EUR") return price;
  const rate = rates[currency];
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
    <div className="container mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4 text-center">Charging Prices</h2>
      <div className="overflow-x-auto">
        <table className="table-auto w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Country</th>
              <th className="border p-2">Provider</th>
              <th className="border p-2" colSpan={4}>Pricing Models</th>
            </tr>
          </thead>
          <tbody>
            {groupedData.map(({ country, provider, models }) => (
              <tr key={`${country}-${provider}`} className="border">
                <td className="border p-2">{country}</td>
                <td className="border p-2">{provider}</td>
                {models.map((model) => {
                  const priceInEUR = exchangeRates ? convertToEUR(model.price_kWh, model.currency, exchangeRates).toFixed(2) : null;
                  const subscriptionInEUR = model.subscription_price && exchangeRates 
                    ? convertToEUR(model.subscription_price, model.currency, exchangeRates).toFixed(2) 
                    : null;
                  
                  return (
                    <td key={model._id} className="border p-2">
                      <strong>{model.pricing_model_name}</strong> <br />
                      <div className="text-sm">
                        {model.currency}{model.price_kWh.toFixed(2)} / kWh
                        {model.currency !== "EUR" && priceInEUR && (
                          <span className="text-gray-600 block">
                            (€{priceInEUR} / kWh)
                          </span>
                        )}
                      </div>
                      <div className="text-sm mt-1">
                        {model.subscription_price ? (
                          <>
                            {model.currency}{model.subscription_price.toFixed(2)}/month
                            {model.currency !== "EUR" && subscriptionInEUR && (
                              <span className="text-gray-600 block">
                                (€{subscriptionInEUR}/month)
                              </span>
                            )}
                          </>
                        ) : "N/A"}
                      </div>
                    </td>
                  );
                })}
                {/* Fill empty cells if less than 4 models */}
                {Array.from({ length: 4 - models.length }).map((_, index) => (
                  <td key={`empty-${index}`} className="border p-2 text-gray-400">N/A</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PriceTable;