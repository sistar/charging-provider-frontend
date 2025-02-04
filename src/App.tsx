import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PriceTable from "./components/PriceTable";

const queryClient = new QueryClient();


function App() {
  const [count, setCount] = useState(0)

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
