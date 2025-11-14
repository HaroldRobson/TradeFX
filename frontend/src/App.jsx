import { useState } from "react";
import "./App.css";
import TradingInterface from "./components/TradingInterface";
import WalletAuth from "./components/WalletAuth";
import OnrampPayment from "./components/OnrampPayment";
import { ConnectWallet } from "@thirdweb-dev/react";

function App() {
  const [activeTab, setActiveTab] = useState("trade");

  return (
    <div className="App">
      <header className="App-header">
        <h1>TradeFX</h1>
        <ConnectWallet />
      </header>
      <nav className="tabs">
        <button
          className={activeTab === "trade" ? "active" : ""}
          onClick={() => setActiveTab("trade")}
        >
          Trade
        </button>
        <button
          className={activeTab === "wallet" ? "active" : ""}
          onClick={() => setActiveTab("wallet")}
        >
          Wallet
        </button>
        <button
          className={activeTab === "onramp" ? "active" : ""}
          onClick={() => setActiveTab("onramp")}
        >
          Buy Crypto
        </button>
      </nav>
      <main className="content">
        {activeTab === "trade" && <TradingInterface />}
        {activeTab === "wallet" && <WalletAuth />}
        {activeTab === "onramp" && <OnrampPayment />}
      </main>
    </div>
  );
}

export default App;