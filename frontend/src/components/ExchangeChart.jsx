import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

const fetchMarketData = async () => {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/coins/tether/market_chart?vs_currency=eur&days=3&interval=hourly"
  );
  if (!response.ok) {
    throw new Error("Failed to load market data");
  }
  const data = await response.json();
  return data.prices || [];
};

const buildLineData = (prices, invert) =>
  prices.map(([timestamp, value]) => ({
    time: Math.floor(timestamp / 1000),
    value: invert ? 1 / value : value,
  }));

const buildCandleData = (prices, invert) => {
  const chunk = 4;
  const candles = [];

  for (let i = 0; i < prices.length; i += chunk) {
    const segment = prices.slice(i, i + chunk);
    if (!segment.length) continue;
    const transformed = segment.map(([timestamp, value]) => ({
      time: Math.floor(timestamp / 1000),
      price: invert ? 1 / value : value,
    }));
    const open = transformed[0].price;
    const close = transformed[transformed.length - 1].price;
    const high = Math.max(...transformed.map((p) => p.price));
    const low = Math.min(...transformed.map((p) => p.price));

    candles.push({
      time: transformed[0].time,
      open,
      high,
      low,
      close,
    });
  }

  return candles;
};

const useChartData = (pair) => {
  const [data, setData] = useState({ line: [], candles: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const prices = await fetchMarketData();
        const invert = pair === "EURC_USDT";
        if (!active) return;
        setData({
          line: buildLineData(prices, invert),
          candles: buildCandleData(prices, invert),
        });
      } catch (err) {
        if (!active) return;
        setError(err.message || "Unable to fetch rates");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pair]);

  return { data, loading, error };
};

const ExchangeChart = ({ compact = false }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [chartType, setChartType] = useState("line");
  const [pair, setPair] = useState("USDT_EURC");
  const { data, loading, error } = useChartData(pair);

  const latestValue = useMemo(() => {
    const series = chartType === "line" ? data.line : data.candles;
    if (!series.length) return null;
    return chartType === "line" ? series[series.length - 1].value : series[series.length - 1].close;
  }, [chartType, data]);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    chartRef.current = createChart(containerRef.current, {
      layout: {
        textColor: "#111827",
        fontSize: 12,
        fontFamily: "Inter, sans-serif",
        background: { type: "solid", color: "rgba(255,255,255,0)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      grid: {
        horzLines: { color: "rgba(17, 24, 39, 0.08)" },
        vertLines: { color: "rgba(17, 24, 39, 0.08)" },
      },
      width: containerRef.current.clientWidth,
      height: compact ? 260 : 360,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartRef.current?.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    if (!chartRef.current || !data.line.length) return;

    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (chartType === "line") {
      seriesRef.current = chartRef.current.addAreaSeries({
        topColor: "rgba(59,130,246, 0.4)",
        bottomColor: "rgba(59,130,246, 0.05)",
        lineColor: "#3b82f6",
        lineWidth: 2,
      });
      seriesRef.current.setData(data.line);
    } else {
      seriesRef.current = chartRef.current.addCandlestickSeries({
        upColor: "#10b981",
        downColor: "#ef4444",
        borderDownColor: "#ef4444",
        borderUpColor: "#10b981",
        wickDownColor: "#ef4444",
        wickUpColor: "#10b981",
      });
      seriesRef.current.setData(data.candles);
    }

    chartRef.current.timeScale().fitContent();
  }, [chartType, data]);

  const formatPairLabel = pair === "USDT_EURC" ? "USDT → EURC" : "EURC → USDT";

  return (
    <div className={`exchange-chart ${compact ? "compact" : ""}`}>
      <div className="chart-header">
        <div>
          <p className="chart-label">Exchange Rate</p>
          <h3 className="chart-title">{formatPairLabel}</h3>
          {latestValue && <p className="chart-price">{latestValue.toFixed(4)}</p>}
        </div>
        <div className="chart-controls">
          <div className="control-group">
            <button
              className={pair === "USDT_EURC" ? "active" : ""}
              onClick={() => setPair("USDT_EURC")}
            >
              USDT / EURC
            </button>
            <button
              className={pair === "EURC_USDT" ? "active" : ""}
              onClick={() => setPair("EURC_USDT")}
            >
              EURC / USDT
            </button>
          </div>
          <div className="control-group">
            <button
              className={chartType === "line" ? "active" : ""}
              onClick={() => setChartType("line")}
            >
              Line
            </button>
            <button
              className={chartType === "candles" ? "active" : ""}
              onClick={() => setChartType("candles")}
            >
              Candles
            </button>
          </div>
        </div>
      </div>

      <div className="chart-body">
        {loading && <p className="chart-status">Loading chart…</p>}
        {error && <p className="chart-status error">{error}</p>}
        <div className="chart-container" ref={containerRef} />
      </div>
    </div>
  );
};

export default ExchangeChart;
