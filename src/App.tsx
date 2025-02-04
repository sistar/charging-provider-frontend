import './App.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PriceTable from "./components/PriceTable";

const queryClient = new QueryClient();

function App() {

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <PriceTable />
        </div>
      </QueryClientProvider>
    </>
  )
}

export default App
