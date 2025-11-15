import { ConnectWallet, useAddress } from "@thirdweb-dev/react";
import { useState, useEffect } from "react";
import "./App.css";
import ExchangeChart from "./components/ExchangeChart";
import OnrampPayment from "./components/OnrampPayment";
import TradingInterface from "./components/TradingInterface";
import WalletAuth from "./components/WalletAuth";

function App() {
  const [activeTab, setActiveTab] = useState("trade");
  const address = useAddress();

  // Redirect to main.html when wallet is connected
  useEffect(() => {
    if (address) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        window.location.href = '/main.html';
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [address]);

  // Show login screen if wallet is not connected
  if (!address) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#f5f5f5',
          gap: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '3rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              marginBottom: '1rem', 
              color: '#1a1a1a',
              fontSize: '2.5rem'
            }}>
              TradeFX
            </h1>
            <p style={{ 
              marginBottom: '2rem', 
              color: '#666',
              fontSize: '1.1rem'
            }}>
              Connect your wallet to start trading
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
          <div style={{
            maxWidth: '1200px',
            width: '100%'
          }}>
            <ExchangeChart compact={false} />
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
        {activeTab === "trade" && (
          <div className="trade-layout">
            <ExchangeChart />
            <TradingInterface />
          </div>
        )}
        {activeTab === "wallet" && <WalletAuth />}
        {activeTab === "onramp" && <OnrampPayment />}
      </main>
    </div>
  );
}

export default App;