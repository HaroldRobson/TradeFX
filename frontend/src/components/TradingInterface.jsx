import { useState } from "react";

function TradingInterface() {
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);

  const handleTrade = (direction) => {
    console.log(`${direction} trade:`, { amount, leverage });
  };

  return (
    <div className="trading-interface">
      <h2>Trade</h2>
      <div className="trading-form">
        <div className="form-group">
          <label>Amount (USDC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>
        <div className="form-group">
          <label>Leverage: {leverage}x</label>
          <input
            type="range"
            min="1"
            max="100"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
          />
        </div>
        <div className="trade-buttons">
          <button className="buy-button" onClick={() => handleTrade("BUY")}>
            Buy / Long
          </button>
          <button className="sell-button" onClick={() => handleTrade("SELL")}>
            Sell / Short
          </button>
        </div>
      </div>
    </div>
  );
}

export default TradingInterface;
