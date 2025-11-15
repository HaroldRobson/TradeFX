import { useState } from "react";

function TradingInterface() {
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [collateral, setCollateral] = useState(0);
  const [borrowed, setBorrowed] = useState(0);

  const calculateCollateralAndBorrowed = () => {
    setCollateral(Number(amount) * (10**6));
    setBorrowed(Number(amount) * (10**6) * leverage);
  };
  const handleTrade = (direction) => {
    calculateCollateralAndBorrowed();
    console.log(`${direction} trade:`, { amount, leverage, collateral, borrowed });
  };

  return (
    <div className="trading-interface">
      <h2>Trade</h2>
      <div className="trading-form">
        <div className="form-group">
          <label>Amount (USD)</label>
          <input
            type="number"
            value={amount}
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
