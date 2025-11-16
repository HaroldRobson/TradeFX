import { ConnectWallet, useAddress } from "@thirdweb-dev/react";
import { useState, useEffect } from "react";
import "./App.css";
import ExchangeChart from "./components/ExchangeChart";
import OnrampPayment from "./components/OnrampPayment";
import OpenPosition from "./components/OpenPosition";
import WalletAuth from "./components/WalletAuth";
import CircleWalletAuth from "./components/CircleWalletAuth";
import EurcUsdcTicker from "./components/EurcUsdcTicker";
import BridgeInterface from "./components/BridgeInterface";
import logo from "./assets/logo.svg";

function App() {
  const [activeTab, setActiveTab] = useState("trade");
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
  // Show login screen if wallet is not connected
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

        {/* Main Content Section - ~55% height */}
        <div
          style={{
            display: "flex",
            height: "68vh",
            gap: "2rem",
            margin: "0 auto",
            width: "100%",
            maxWidth: "1400px",
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
            <ExchangeChart compact={false} />
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
                  Create a new user-controlled wallet with Circle or log in using your PIN
                </p>
                <CircleWalletAuth onSuccess={handleCircleWalletSuccess} />
              </div>
            </div>
          </div>
        </div>

        {/* Outer margins are handled by padding + maxWidth on main containers */}
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
      </nav>
      <main className="content">
        {activeTab === "trade" && (
          <div className="trade-layout">
            <ExchangeChart />
            <OpenPosition />
          </div>
        )}
        {activeTab === "wallet" && <WalletAuth />}
        {activeTab === "bridge" && <BridgeInterface />}
        {activeTab === "onramp" && <OnrampPayment />}
      </main>
    </div>
  );
}

export default App;
