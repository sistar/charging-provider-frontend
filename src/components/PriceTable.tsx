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

const PriceTable: React.FC = () => {
  const { data, error, isLoading } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
  });

  if (isLoading) return <p className="text-center">Loading prices...</p>;
  if (error) return <p className="text-center text-red-500">Error loading data</p>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4 text-center">Charging Prices</h2>
      <div className="overflow-x-auto">
        <table className="table-auto w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Country</th>
              <th className="border p-2">Provider</th>
              <th className="border p-2">Pricing Model</th>
              <th className="border p-2">Price per kWh</th>
              <th className="border p-2">Subscription Price</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((entry) => (
              <tr key={entry._id} className="border">
                <td className="border p-2">{entry.country}</td>
                <td className="border p-2">{entry.provider}</td>
                <td className="border p-2">{entry.pricing_model_name}</td>
                <td className="border p-2">
                  {entry.currency}
                  {entry.price_kWh.toFixed(2)}
                </td>
                <td className="border p-2">
                  {entry.subscription_price
                    ? `${entry.currency}${entry.subscription_price.toFixed(2)}`
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PriceTable;
