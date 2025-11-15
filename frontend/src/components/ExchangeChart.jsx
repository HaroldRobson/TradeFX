import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode, AreaSeries, CandlestickSeries } from "lightweight-charts";

// time window in seconds
const TIMEFRAMES = {
  "1H": 3600,
  "1D": 86400,
  "1W": 7 * 86400,
  "1M": 30 * 86400,
  "6M": 180 * 86400,
  "1Y": 365 * 86400,
  ALL: null,
};

// Currency pair options
const CURRENCY_PAIRS = [
  { value: "USDC_EURC", label: "USDC / EURC" },
  { value: "EURC_USDC", label: "EURC / USDC" },
];

// Chart type options
const CHART_TYPES = [
  { value: "line", label: "Line" },
  { value: "candles", label: "Candlesticks" },
];

// Timeframe options (ordered)
const TIMEFRAME_OPTIONS = ["1H", "1D", "1W", "1M", "6M", "1Y", "ALL"];

const MAX_POINTS = 800;

const fetchKrakenOHLC = async (timeframe = "1M") => {
  // USDC/EUR market on Kraken, used as a proxy for USDC/EURC
  // For longer timeframes, use daily data (1440 minutes) instead of hourly (60 minutes)
  // For shorter timeframes, use hourly data for better granularity
  let interval = 60; // 1 hour
  let since = null;
  
  if (timeframe === "1H") {
    interval = 1; // 1 minute for 1 hour view (60 candlesticks)
    // For 1 hour, get data from 2 hours ago to ensure we have enough
    const twoHoursAgo = Math.floor(Date.now() / 1000) - (2 * 3600);
    since = twoHoursAgo;
  } else if (timeframe === "6M" || timeframe === "1Y" || timeframe === "ALL") {
    interval = 1440; // 1 day for longer timeframes
    // Calculate timestamp for 2 years ago to get enough data
    const twoYearsAgo = Math.floor(Date.now() / 1000) - (2 * 365 * 86400);
    since = twoYearsAgo;
  } else if (timeframe === "1W") {
    // For 1 week, get data from 2 weeks ago to ensure we have enough
    const twoWeeksAgo = Math.floor(Date.now() / 1000) - (14 * 86400);
    since = twoWeeksAgo;
  } else if (timeframe === "1D") {
    // For 1 day, get data from 3 days ago
    const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 86400);
    since = threeDaysAgo;
  } else {
    // For 1M, get data from 2 months ago
    const twoMonthsAgo = Math.floor(Date.now() / 1000) - (60 * 86400);
    since = twoMonthsAgo;
  }

  let url = `https://api.kraken.com/0/public/OHLC?pair=USDCEUR&interval=${interval}`;
  if (since) {
    url += `&since=${since}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.error && payload.error.length) {
    throw new Error(payload.error.join(", "));
  }
  return (payload.result && payload.result.USDCEUR) || [];
};

const buildHistoryData = (rows, pair) => {
  const line = [];
  const candles = [];

  for (const row of rows) {
    const [time, open, high, low, close] = row;
    const t = Number(time);
    const o = Number(open);
    const h = Number(high);
    const l = Number(low);
    const c = Number(close);
    if (![o, h, l, c].every((v) => Number.isFinite(v) && v > 0)) continue;

    // Kraken gives USDC/EUR; treat that as approx USDC/EURC
    let lineVal;
    let co, ch, cl, cc;

    if (pair === "USDC_EURC") {
      // keep orientation as-is
      lineVal = c;
      co = o;
      ch = h;
      cl = l;
      cc = c;
    } else {
      // EURC / USDC → invert
      lineVal = 1 / c;
      co = 1 / o;
      ch = 1 / l; // invert: high/low swap
      cl = 1 / h;
      cc = 1 / c;
    }

    line.push({ time: t, value: lineVal });
    candles.push({
      time: t,
      open: co,
      high: ch,
      low: cl,
      close: cc,
    });
  }

  return { line, candles };
};

const ExchangeChart = ({ compact = false }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const [chartType, setChartType] = useState("candles");
  const [pair, setPair] = useState("USDC_EURC");
  const [timeframe, setTimeframe] = useState("1M");

  const [history, setHistory] = useState({ line: [], candles: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [livePrice, setLivePrice] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");

  // ----- HISTORY LOAD (Kraken OHLC) -----
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchKrakenOHLC(timeframe);
        if (!active) return;
        const built = buildHistoryData(rows, pair);
        setHistory(built);

        const latest =
          built.line.length > 0
            ? built.line[built.line.length - 1].value
            : null;
        if (latest != null) {
          setLivePrice(latest);
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || "Unable to fetch rates");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    // Refresh data every 1 minute for all timeframes
    const refreshInterval = 60_000; // 1 minute
    const id = setInterval(load, refreshInterval);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pair, timeframe]);

  // ----- FILTER BY TIMEFRAME -----
  const filteredData = useMemo(() => {
    const seconds = TIMEFRAMES[timeframe];
    if (!seconds) return history;

    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - seconds;

    return {
      line: history.line.filter((p) => p.time >= cutoff),
      candles: history.candles.filter((c) => c.time >= cutoff),
    };
  }, [history, timeframe]);

  const latestValue = useMemo(() => {
    const series =
      chartType === "line" ? filteredData.line : filteredData.candles;
    if (!series.length) return null;
    return chartType === "line"
      ? series[series.length - 1].value
      : series[series.length - 1].close;
  }, [chartType, filteredData]);

  // ----- CHART SETUP -----
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    let resizeObserver = null;
    let chart = null;

    const initializeChart = () => {
      if (!containerRef.current || chartRef.current) return;

      const container = containerRef.current;
      
      // Ensure container has dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        // Wait for next frame to ensure container is sized
        requestAnimationFrame(initializeChart);
        return;
      }

      try {
        if (typeof createChart !== "function") {
          console.error("createChart is not available");
          return;
        }

        chart = createChart(container, {
          layout: {
            textColor: "#111827",
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
            background: { type: "solid", color: "rgba(255,255,255,0)" },
            attributionLogo: false,
          },
          crosshair: {
            mode: CrosshairMode.Normal,
          },
          grid: {
            horzLines: { color: "rgba(148, 163, 184, 0.35)" },
            vertLines: { color: "rgba(148, 163, 184, 0.25)" },
          },
          width: container.clientWidth || 800,
          height: compact ? 260 : 360,
          rightPriceScale: {
            borderVisible: false,
          },
          timeScale: {
            borderVisible: false,
          },
        });

        // Verify chart was created
        if (!chart) {
          console.error("createChart returned null/undefined");
          return;
        }

        // Store chart reference immediately
        chartRef.current = chart;

        // Set up resize observer
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (chartRef.current) {
              chartRef.current.applyOptions({ width: entry.contentRect.width });
            }
          }
        });
        resizeObserver.observe(container);
      } catch (error) {
        console.error("Error creating chart:", error);
        if (chart) {
          try {
            chart.remove();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        chartRef.current = null;
      }
    };

    initializeChart();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [compact]);

  // ----- UPDATE SERIES WHEN DATA / TYPE / TF CHANGES -----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const seriesData =
      chartType === "line" ? filteredData.line : filteredData.candles;
    if (!seriesData.length) return;

    // Remove existing series if any
    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch (e) {
        // Ignore errors when removing series
      }
      seriesRef.current = null;
    }

    try {
      let series;
      if (chartType === "line") {
        // Use the new v5 API: addSeries(SeriesType, options)
        series = chart.addSeries(AreaSeries, {
          topColor: "rgba(37,99,235, 0.35)",
          bottomColor: "rgba(37,99,235, 0.04)",
          lineColor: "#2563eb",
          lineWidth: 2,
        });
      } else {
        // Use the new v5 API: addSeries(SeriesType, options)
        series = chart.addSeries(CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderDownColor: "#ef4444",
          borderUpColor: "#10b981",
          wickDownColor: "#ef4444",
          wickUpColor: "#10b981",
        });
      }
      
      if (series) {
        series.setData(seriesData);
        seriesRef.current = series;
        chart.timeScale().fitContent();
      }
    } catch (error) {
      console.error("Error adding series to chart:", error);
    }
  }, [chartType, filteredData]);

  // ----- LIVE TICKS VIA KRAKEN WS (USDC/EUR proxy) -----
  useEffect(() => {
    const KRAKEN_URL = "wss://ws.kraken.com";
    let ws = null;
    let reconnectTimer = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      
      setWsStatus("connecting");
      
      try {
        ws = new WebSocket(KRAKEN_URL);

        ws.onopen = () => {
          if (!isMounted || !ws) return;
          setWsStatus("live");
          ws.send(
            JSON.stringify({
              event: "subscribe",
              pair: ["USDC/EUR"],
              subscription: { name: "ticker" },
            })
          );
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          
          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }

          if (!Array.isArray(msg)) {
            // subscriptionStatus etc
            return;
          }

          const [, payload, pairLabel] = msg;
          if (pairLabel !== "USDC/EUR") return;

          const last = parseFloat(payload.c[0]); // last traded price USDC/EUR
          if (!isFinite(last) || last <= 0) return;

          // map to current orientation
          const value = pair === "USDC_EURC" ? last : 1 / last;
          setLivePrice(value);

          // also push into history so chart moves
          setHistory((prev) => {
            const nowSec = Math.floor(Date.now() / 1000);
            const line = [...prev.line];
            const candles = [...prev.candles];

            // line
            line.push({ time: nowSec, value });
            if (line.length > MAX_POINTS) line.shift();

            // candles (1-min buckets)
            let lastCandle = candles[candles.length - 1];
            if (lastCandle && Math.abs(nowSec - lastCandle.time) < 60) {
              lastCandle = {
                ...lastCandle,
                high: Math.max(lastCandle.high, value),
                low: Math.min(lastCandle.low, value),
                close: value,
              };
              candles[candles.length - 1] = lastCandle;
            } else {
              candles.push({
                time: nowSec,
                open: value,
                high: value,
                low: value,
                close: value,
              });
              if (candles.length > MAX_POINTS) candles.shift();
            }

            return { line, candles };
          });
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsStatus("disconnected");
          if (isMounted) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = (error) => {
          if (!isMounted) return;
          console.warn("WebSocket error:", error);
          setWsStatus("disconnected");
          // Don't try to close here, let onclose handle it
        };
      } catch (error) {
        console.error("Error creating WebSocket:", error);
        if (isMounted) {
          setWsStatus("disconnected");
          reconnectTimer = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          // Remove event handlers first to prevent warnings
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;
          ws.onopen = null;
          
          // Only close if the connection is open
          // If it's still connecting, the browser will handle the cleanup
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          // For CONNECTING state, we just remove handlers and let it fail naturally
        } catch (error) {
          // Silently ignore cleanup errors - these are expected during unmount
        }
        ws = null;
      }
    };
  }, [pair]);

  const formatPairLabel =
    pair === "USDC_EURC" ? "USDC / EURC" : "EURC / USDC";

  const displayPrice =
    livePrice != null
      ? livePrice
      : latestValue != null
      ? latestValue
      : null;

  const wsDotColor =
    wsStatus === "live"
      ? "#22c55e"
      : wsStatus === "connecting"
      ? "#f97316"
      : "#ef4444";

  return (
    <div className={`exchange-chart ${compact ? "compact" : ""}`}>
      <div className="chart-header">
        <div>
          <p className="chart-label">Exchange Rate</p>
          <h3 className="chart-title">{formatPairLabel}</h3>
          {displayPrice && (
            <p className="chart-price">
              {displayPrice.toFixed(4)}{" "}
              <span
                style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.75rem",
                  color: "#6b7280",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "999px",
                    marginRight: 4,
                    background: wsDotColor,
                    boxShadow: `0 0 8px ${wsDotColor}`,
                  }}
                />
                {wsStatus === "live"
                  ? "Live via Kraken (USDC/EUR proxy)"
                  : wsStatus === "connecting"
                  ? "Connecting…"
                  : "Reconnecting…"}
              </span>
            </p>
          )}
        </div>
        <div className="chart-controls">
          {/* Pair toggle */}
          <div className="control-group">
            {CURRENCY_PAIRS.map((pairOption) => (
              <button
                key={pairOption.value}
                className={pair === pairOption.value ? "active" : ""}
                onClick={() => setPair(pairOption.value)}
              >
                {pairOption.label}
              </button>
            ))}
          </div>

          {/* Timeframe buttons */}
          <div className="control-group">
            {TIMEFRAME_OPTIONS.map((tf) => (
              <button
                key={tf}
                className={timeframe === tf ? "active" : ""}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart type */}
          <div className="control-group">
            {CHART_TYPES.map((typeOption) => (
              <button
                key={typeOption.value}
                className={chartType === typeOption.value ? "active" : ""}
                onClick={() => setChartType(typeOption.value)}
              >
                {typeOption.label}
              </button>
            ))}
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