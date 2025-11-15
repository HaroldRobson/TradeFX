import { useState, useMemo } from "react";
import useKrakenTicker from "../hooks/useKrakenTicker";

function TradingInterface({ pair = "USDC_EURC" }) {
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [collateral, setCollateral] = useState(0);
  const [borrowed, setBorrowed] = useState(0);

  const calculateCollateralAndBorrowed = () => {
    setCollateral(Number(amount) * (10 ** 6));
    setBorrowed(Number(amount) * (10 ** 6) * leverage);
  };

  const { data: ticker, status } = useKrakenTicker();

  const effectiveQuotes = useMemo(() => {
    if (!ticker) return null;

    if (pair === "USDC_EURC") {
      return {
        bid: ticker.bid,
        ask: ticker.ask,
      };
    } else {
      // EURC / USDC inverse
      return {
        bid: 1 / ticker.ask,
        ask: 1 / ticker.bid,
      };
    }
  }, [ticker, pair]);

  const handleTrade = (direction) => {
    calculateCollateralAndBorrowed();

    if (!effectiveQuotes) {
      console.warn("No live price yet, cannot price trade");
      return;
    }

    const price =
      direction === "BUY" ? effectiveQuotes.ask : effectiveQuotes.bid;

    const numericAmount = Number(amount) || 0;
    const numericLeverage = Number(leverage) || 1;
    const notional = numericAmount * price;
    const leveragedNotional = notional * numericLeverage;

    console.log(`${direction} trade:`, {
      pair,
      side: direction,
      amount: numericAmount,
      leverage: numericLeverage,
      price,
      notional,
      leveragedNotional,
      wsStatus: status,
      collateral,
      borrowed
    });
  };

  const priceDisplay =
    effectiveQuotes && ticker
      ? pair === "USDC_EURC"
        ? `${effectiveQuotes.bid.toFixed(4)} / ${effectiveQuotes.ask.toFixed(
          4
        )} USDC per EURC`
        : `${effectiveQuotes.bid.toFixed(4)} / ${effectiveQuotes.ask.toFixed(
          4
        )} EURC per USDC`
      : "Waiting for price…";

  const connectionLabel = (() => {
    if (status === "live" && ticker) return "Live via Kraken";
    if (status === "connected") return "Connected – waiting for first price…";
    if (status === "connecting" || status === "idle") return "Connecting…";
    if (status === "disconnected") return "Disconnected – reconnecting…";
    if (status === "error") return "Error connecting to Kraken";
    return status;
  })();

  const statusColor =
    status === "live"
      ? "#16a34a"
      : status === "connected"
        ? "#22c55e"
        : status === "connecting" || status === "idle"
          ? "#f97316"
          : status === "disconnected"
            ? "#eab308"
            : "#ef4444";

  return (
    <div className="trading-interface">
      <h2>Trade</h2>

      <div
        style={{
          fontSize: "0.85rem",
          marginBottom: "0.75rem",
          color: "#6b7280",
        }}
      >
        Live quotes ({pair === "USDC_EURC" ? "USDC / EURC" : "EURC / USDC"}):{" "}
        <strong>{priceDisplay}</strong>{" "}
        <span
          style={{
            marginLeft: 6,
            fontSize: "0.75rem",
            color: statusColor,
          }}
        >
          {connectionLabel}
        </span>
      </div>

      <div className="trading-form">
        <div className="form-group">
          <label>Amount (USD)</label>
          <input
            type="number"
            value={amount}
            min="0"
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>
        <div className="form-group">
          <label>Leverage: {leverage}</label>
          <input
            type="range"
            min="1"
            max="100"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
          />
        </div>
        <div className="trade-buttons">
          <button
            className="buy-button"
            onClick={() => handleTrade("BUY")}
            disabled={!effectiveQuotes}
          >
            Buy / Long
          </button>
          <button
            className="sell-button"
            onClick={() => handleTrade("SELL")}
            disabled={!effectiveQuotes}
          >
            Sell / Short
          </button>
        </div>
      </div>
    </div>
  );
}

export default TradingInterface;