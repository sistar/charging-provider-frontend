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

const fetchPrices = async (): Promise<PriceEntry[]> => {
  const { data } = await axios.get("https://charging-provider-backend.onrender.com/api/prices");
  return data;
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
  const { data, error, isLoading } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
  });

  if (isLoading) return <p className="text-center">Loading prices...</p>;
  if (error) return <p className="text-center text-red-500">Error loading data</p>;

  const groupedData = groupByProvider(data || []);

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
                {models.map((model) => (
                  <td key={model._id} className="border p-2">
                    <strong>{model.pricing_model_name}</strong> <br />
                    {model.currency}{model.price_kWh.toFixed(2)} / kWh <br />
                    {model.subscription_price ? `${model.currency}${model.subscription_price.toFixed(2)}/month` : "N/A"}
                  </td>
                ))}
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