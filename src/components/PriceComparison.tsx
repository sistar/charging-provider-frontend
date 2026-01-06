import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

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

interface CountryData {
  country: string;
  chargingPrice: number;
  householdPrice: number;
  chargingPos: number;
  householdPos: number;
}

const PriceComparison: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

  // Filter for IONITY Power 365 and convert to EUR (memoized)
  const power365Prices = useMemo<CountryPrice[]>(() => {
    return (pricesData || [])
      .filter(p => p.pricing_model_name === "IONITY Power 365")
      .map(p => ({
        country: p.country,
        priceEUR: exchangeRates ? convertToEUR(p.price_kWh, p.currency, exchangeRates) : p.price_kWh,
        originalPrice: p.price_kWh,
        currency: p.currency
      }))
      .sort((a, b) => a.priceEUR - b.priceEUR);
  }, [pricesData, exchangeRates]);

  // Calculate price ranges (memoized)
  const priceRanges = useMemo(() => {
    if (power365Prices.length === 0) return null;
    const min = Math.min(...power365Prices.map(p => p.priceEUR));
    const max = Math.max(...power365Prices.map(p => p.priceEUR));
    const range = max - min;
    const padding = range * 0.08;
    return {
      minPrice: min,
      maxPrice: max,
      paddedMin: min - padding,
      paddedRange: (max + padding) - (min - padding)
    };
  }, [power365Prices]);

  // Create household price lookup (memoized)
  const householdPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    (householdData || []).forEach(h => {
      map.set(h.country, h.priceEUR);
    });
    return map;
  }, [householdData]);

  // Filter charging prices to only countries with household data (memoized)
  const countriesWithBothPrices = useMemo(() => {
    return power365Prices.filter(p => householdPriceMap.has(p.country));
  }, [power365Prices, householdPriceMap]);

  // Calculate household price range (memoized)
  const householdRanges = useMemo(() => {
    if (householdPriceMap.size === 0) return null;
    const householdPrices = Array.from(householdPriceMap.values());
    const min = Math.min(...householdPrices);
    const max = Math.max(...householdPrices);
    const range = max - min;
    const padding = range * 0.08;
    return {
      minHousehold: min,
      maxHousehold: max,
      paddedMinHousehold: min - padding,
      paddedRangeHousehold: (max + padding) - (min - padding)
    };
  }, [householdPriceMap]);

  // Prepare country data for D3 (memoized to prevent infinite re-renders)
  const countryData = useMemo(() => {
    if (!priceRanges || !householdRanges) return [];

    const { paddedMin, paddedRange } = priceRanges;
    const { paddedMinHousehold, paddedRangeHousehold } = householdRanges;

    return countriesWithBothPrices.map((country) => {
      const householdPrice = householdPriceMap.get(country.country) || 0;
      return {
        country: country.country,
        chargingPrice: country.priceEUR,
        householdPrice,
        chargingPos: ((country.priceEUR - paddedMin) / paddedRange) * 100,
        householdPos: ((householdPrice - paddedMinHousehold) / paddedRangeHousehold) * 100,
      };
    }).sort((a, b) => a.householdPos - b.householdPos);
  }, [countriesWithBothPrices, householdPriceMap, priceRanges, householdRanges]);

  // D3 visualization effect
  useEffect(() => {
    if (!svgRef.current || countryData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous content

    const width = svgRef.current.clientWidth;
    const labelSpacing = 22;
    const labelStartY = 140;

    // Create scales for positioning
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, width]);

    // Create groups for each country
    const countryGroups = svg
      .selectAll<SVGGElement, CountryData>(".country-group")
      .data(countryData)
      .join("g")
      .attr("class", "country-group")
      .attr("data-country", d => d.country)
      .style("cursor", "pointer");

    // Main connector lines
    countryGroups
      .append("line")
      .attr("class", "connector-line")
      .attr("x1", d => xScale(d.chargingPos))
      .attr("y1", 27)
      .attr("x2", d => xScale(d.householdPos))
      .attr("y2", 106)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.5);

    // Charging dots
    countryGroups
      .append("circle")
      .attr("class", "charging-dot")
      .attr("cx", d => xScale(d.chargingPos))
      .attr("cy", 27)
      .attr("r", 6)
      .attr("fill", "#ea580c")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.1))");

    // Household dots
    countryGroups
      .append("circle")
      .attr("class", "household-dot")
      .attr("cx", d => xScale(d.householdPos))
      .attr("cy", 106)
      .attr("r", 6)
      .attr("fill", "#4f46e5")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.1))");

    // Label connector lines
    countryGroups
      .append("line")
      .attr("class", "label-connector")
      .attr("x1", d => xScale((d.chargingPos + d.householdPos) / 2))
      .attr("y1", 66.5)
      .attr("x2", d => xScale((d.chargingPos + d.householdPos) / 2))
      .attr("y2", (_, i) => labelStartY + i * labelSpacing - 5)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.4);

    // Labels (using foreignObject)
    countryGroups
      .append("foreignObject")
      .attr("x", d => xScale((d.chargingPos + d.householdPos) / 2) - 60)
      .attr("y", (_, i) => labelStartY + i * labelSpacing - 3)
      .attr("width", 120)
      .attr("height", 60)
      .html(d => `
        <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: center;">
          <div style="background: white; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div style="font-size: 11px; font-weight: 600; color: #1f2937; white-space: nowrap;">${d.country}</div>
          </div>
          <div style="font-size: 9px; color: #ea580c; margin-top: 4px;">C: €${d.chargingPrice.toFixed(2)}</div>
          <div style="font-size: 9px; color: #4f46e5;">H: €${d.householdPrice.toFixed(2)}</div>
        </div>
      `);

    // Interactive hover effects
    countryGroups
      .on("mouseenter", function(event, d) {
        // Highlight current country
        d3.select(this)
          .select(".connector-line")
          .attr("stroke", "#2563eb")
          .attr("stroke-width", 3)
          .attr("opacity", 1);

        d3.select(this)
          .select(".charging-dot")
          .attr("r", 8)
          .attr("fill", "#dc2626");

        d3.select(this)
          .select(".household-dot")
          .attr("r", 8)
          .attr("fill", "#7c3aed");

        d3.select(this)
          .select(".label-connector")
          .attr("stroke", "#2563eb")
          .attr("stroke-width", 2)
          .attr("opacity", 0.8);

        // Fade other countries
        countryGroups
          .filter(country => country.country !== d.country)
          .style("opacity", 0.3);

        // Show tooltip
        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          tooltip
            .style("display", "block")
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 10}px`)
            .html(`
              <div style="font-weight: 600; margin-bottom: 8px; color: #1f2937;">${d.country}</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 12px; height: 12px; background: #ea580c; border-radius: 50%; border: 2px solid white;"></div>
                <span style="font-size: 12px;">Charging: €${d.chargingPrice.toFixed(3)}/kWh</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; background: #4f46e5; border-radius: 50%; border: 2px solid white;"></div>
                <span style="font-size: 12px;">Household: €${d.householdPrice.toFixed(3)}/kWh</span>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
                Difference: €${Math.abs(d.chargingPrice - d.householdPrice).toFixed(3)}/kWh
                (${d.chargingPrice > d.householdPrice ? '+' : ''}${((d.chargingPrice / d.householdPrice - 1) * 100).toFixed(1)}%)
              </div>
            `);
        }
      })
      .on("mouseleave", function() {
        // Reset all styling
        countryGroups.style("opacity", 1);

        d3.select(this)
          .select(".connector-line")
          .attr("stroke", "#94a3b8")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.5);

        d3.select(this)
          .select(".charging-dot")
          .attr("r", 6)
          .attr("fill", "#ea580c");

        d3.select(this)
          .select(".household-dot")
          .attr("r", 6)
          .attr("fill", "#4f46e5");

        d3.select(this)
          .select(".label-connector")
          .attr("stroke", "#94a3b8")
          .attr("stroke-width", 1)
          .attr("opacity", 0.4);

        // Hide tooltip
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style("display", "none");
        }
      });

  }, [countryData]);

  // Early return if no data
  if (!priceRanges || !householdRanges || countryData.length === 0) {
    return null;
  }

  const { minPrice, maxPrice } = priceRanges;
  const { minHousehold, maxHousehold } = householdRanges;

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

          {/* D3 SVG Container */}
          <svg
            ref={svgRef}
            className="absolute top-0 left-0 right-0 w-full"
            style={{ height: '600px' }}
          />
        </div>
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          display: 'none',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: '280px',
        }}
      />

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
