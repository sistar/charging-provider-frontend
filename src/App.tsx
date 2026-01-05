import './App.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PriceTable from "./components/PriceTable";
import PriceComparison from "./components/PriceComparison";

const queryClient = new QueryClient();

function App() {

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Charging Prices
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Compare electric vehicle charging prices across Europe. All non-EUR prices include EUR conversion for easy comparison.
              </p>
            </div>

            {/* Price Comparison Chart */}
            <PriceComparison />

            {/* Detailed Price Table */}
            <PriceTable />
          </div>
        </div>
      </QueryClientProvider>
    </>
  )
}

export default App
