import { ConnectWallet, useAddress } from "@thirdweb-dev/react";
import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import ExchangeChart from "./components/ExchangeChart";
import OnrampPayment from "./components/OnrampPayment";
import TradingInterface from "./components/TradingInterface";
import WalletAuth from "./components/WalletAuth";
import CircleWalletAuth from "./components/CircleWalletAuth";
import BridgeInterface from "./components/BridgeInterface";
import ExistingPositions from "./components/ExistingPositions";
import PositionDetail from "./components/PositionDetail";

// Shared demo positions – in a real app these would come from your backend / smart contract.
// Simple handcrafted set so the Positions tab looks fuller. IDs are UUID-style strings.
const initialPositions = [
  {
    id: "5d8f2c1e-9a3b-4f2d-b817-1c2a9ef0a101",
    pair: "USDC_EURC",
    side: "LONG",
    // Start in USDC, position is in EURC
    start_token: "USDC",
    pos_token: "EURC",
    amount: 1400,
    entryPrice: 1.0654,
    leverage: 5,
    // ~4 months ago
    openedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "a3c7e4b2-1f56-4d98-92ab-7e0c3b5d2202",
    pair: "USDC_EURC",
    side: "SHORT",
    // Start in USDC, position token is still EURC (short EURC)
    start_token: "USDC",
    pos_token: "EURC",
    amount: 900,
    entryPrice: 1.0721,
    leverage: 3,
    // ~5 months ago
    openedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "c91e0d44-7b2a-4e39-8f01-5a6d9c7b3303",
    pair: "USDC_EURC",
    side: "LONG",
    // Start in EURC, position token USDC
    start_token: "EURC",
    pos_token: "USDC",
    amount: 1000,
    entryPrice: 1.0105,
    leverage: 4,
    // ~6 months ago
    openedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "f0b2a8c9-3d1e-4f77-9c20-4e8a1b6f4404",
    pair: "USDC_EURC",
    side: "SHORT",
    start_token: "EURC",
    pos_token: "USDC",
    amount: 750,
    entryPrice: 1.025,
    leverage: 2,
    // ~7 months ago
    openedAt: new Date(Date.now() - 210 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "1a6d3c9e-2b4f-4a80-91de-7c5b2f8a5505",
    pair: "USDC_EURC",
    side: "LONG",
    start_token: "USDC",
    pos_token: "EURC",
    amount: 500,
    entryPrice: 1.035,
    leverage: 3,
    // ~8 months ago
    openedAt: new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "7e3b9d21-5f8a-4c0e-b2d1-9a4c7e6f6606",
    pair: "USDC_EURC",
    side: "SHORT",
    start_token: "USDC",
    pos_token: "EURC",
    amount: 2000,
    entryPrice: 1.0488,
    leverage: 6,
    // ~9 months ago
    openedAt: new Date(Date.now() - 270 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2f4a7b33-8c1d-4e6f-a9b2-3d5e7f9a7707",
    pair: "USDC_EURC",
    side: "LONG",
    start_token: "EURC",
    pos_token: "USDC",
    amount: 1250,
    entryPrice: 0.9987,
    leverage: 4,
    // ~10 months ago
    openedAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "9b6e3d12-4f8a-41c0-932d-8a1c5e4d8808",
    pair: "USDC_EURC",
    side: "SHORT",
    start_token: "EURC",
    pos_token: "USDC",
    amount: 300,
    entryPrice: 1.0123,
    leverage: 1,
    // ~12 months ago
    openedAt: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
import logo from "./assets/logo.svg";

function App() {
  const [activeTab, setActiveTab] = useState("trade");
  const [positions, setPositions] = useState(initialPositions);
  const address = useAddress();
  const [circleWalletConnected, setCircleWalletConnected] = useState(false);

  // Redirect to main.html when wallet is connected
  useEffect(() => {
    if (address || circleWalletConnected) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        //window.location.href = '/index.html';
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [address, circleWalletConnected]);

  const handleCircleWalletSuccess = (result) => {
    console.log("Circle wallet created successfully:", result);
    // Store Circle wallet info
    if (result.walletId) {
      localStorage.setItem("circleWalletId", result.walletId);
    }
    if (result.userToken) {
      localStorage.setItem("circleUserToken", result.userToken);
    }
    setCircleWalletConnected(true);
  };

  // Show login screen if wallet is not connected
  if (!address && !circleWalletConnected) {
    return (
      <div className="App">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "2rem",
          backgroundColor: "#f5f5f5",
          gap: "2rem",
        }}
      >
        {/* Logo and Title Section - ~20% height */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "20vh",
            gap: "1.5rem",
            margin: "0 auto",
            width: "100%",
            maxWidth: "1400px",
          }}
        >
          <img
            src={logo}
            alt="TradeFX Logo"
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
            }}
          />
          <h1
            style={{
              color: "#1a1a1a",
              fontSize: "4rem",
              margin: 0,
              fontWeight: "700",
            }}
          >
            TradeFX
          </h1>
        </div>

          {/* Main Content Section */}
        <div
          style={{
            display: "flex",
              // height: "60vh",           // ⬅ remove this line
            gap: "2rem",
            margin: "0 auto",
            width: "100%",
            maxWidth: "1400px",
              alignItems: "flex-start",    // ⬅ add this for top alignment
          }}
        >
          {/* Left Side - ExchangeChart (60% width) */}
          <div
            style={{
              flex: "0 0 60%",
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "2rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
              <ExchangeChart compact />
          </div>

          {/* Right Side - Sign In Options (30% width) */}
          <div
            style={{
              flex: "0 0 30%",
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "2rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              style={{
                marginBottom: "1.5rem",
                color: "#1a1a1a",
                fontSize: "1.7rem",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              Log in via:
            </h2>

            {/* Wallet Connection Options - stacked column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2rem",
                flex: 1,
              }}
            >
              {/* Thirdweb Connect Wallet Section */}
              <div>
                <h3
                  style={{
                    marginBottom: "0.2rem",
                    color: "#1a1a1a",
                    fontSize: "1.125rem",
                    fontWeight: "600",
                  }}
                >
                  Thirdweb
                </h3>
                <p
                  style={{
                    marginBottom: "1rem",
                    color: "#666",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                >
                  Connect using MetaMask, WalletConnect, or other Web3 wallets
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",  // center horizontally
                  }}
                >
                  <ConnectWallet
                    theme="light"
                    btnTitle="Connect Wallet"
                    modalTitle="Sign In to Trade FX"
                    modalSize="wide"
                    welcomeScreen={{
                      title: "Welcome to Trade FX",
                      subtitle: "Connect your wallet to get started",
                    }}
                    termsOfServiceUrl="https://tradefx.example.com/terms"
                    privacyPolicyUrl="https://tradefx.example.com/privacy"
                  />
                </div>
              </div>

              {/* Circle User-Controlled Wallet Section */}
              <div>
                <h3
                  style={{
                    marginBottom: "0.75rem",
                    color: "#1a1a1a",
                    fontSize: "1.125rem",
                    fontWeight: "600",
                  }}
                >
                  Circle Wallet
                </h3>
                <p
                  style={{
                    marginBottom: "1rem",
                    color: "#666",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                >
                    Create a new user-controlled wallet with Circle or log in
                    using your PIN
                </p>
                <CircleWalletAuth onSuccess={handleCircleWalletSuccess} />
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

  // Show main app when wallet is connected
  return (
    <div className="App">
      <header className="App-header">
        <h1>TradeFX</h1>
        <ConnectWallet
          modalTitle="Connect your wallet"
          modalTitleIconUrl="/"
          welcomeScreen={{
            title: "TradeFX",
            subtitle: "Securely connect your wallet",
            subtitle2: "",
          }}
          termsOfServiceUrl="https://tradefx.example.com/terms"
          privacyPolicyUrl="https://tradefx.example.com/privacy"
        />
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <>
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
                  className={activeTab === "bridge" ? "active" : ""}
                  onClick={() => setActiveTab("bridge")}
                >
                  Bridge to Arc
                </button>
                <button
                  className={activeTab === "onramp" ? "active" : ""}
                  onClick={() => setActiveTab("onramp")}
                >
                  Buy Crypto
                </button>
                <button
                  className={activeTab === "positions" ? "active" : ""}
                  onClick={() => setActiveTab("positions")}
                >
                  Positions
                </button>
              </nav>
              <main className="content">
                {activeTab === "trade" && (
                  <div className="trade-layout">
                    <ExchangeChart />
                    <TradingInterface />
                  </div>
                )}
                {activeTab === "wallet" && <WalletAuth />}
                {activeTab === "bridge" && <BridgeInterface />}
                {activeTab === "onramp" && <OnrampPayment />}
                {activeTab === "positions" && (
                  <ExistingPositions positions={positions} />
                )}
              </main>
            </>
          }
        />
        <Route
          path="/positions/:id"
          element={
            <PositionDetail
              positions={positions}
              onClose={(id) =>
                setPositions((prev) => prev.filter((p) => p.id === id ? false : p.id !== id))
              }
            />
          }
        />
      </Routes>
    </div>
  );
}

export default App;
