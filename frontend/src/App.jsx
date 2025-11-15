import { ConnectWallet, useAddress } from "@thirdweb-dev/react";
import { useState, useEffect } from "react";
import "./App.css";
import ExchangeChart from "./components/ExchangeChart";
import OnrampPayment from "./components/OnrampPayment";
import TradingInterface from "./components/TradingInterface";
import WalletAuth from "./components/WalletAuth";
import CircleWalletAuth from "./components/CircleWalletAuth";

function App() {
  const [activeTab, setActiveTab] = useState("trade");
  const address = useAddress();
  const [circleWalletConnected, setCircleWalletConnected] = useState(false);

  // Redirect to main.html when wallet is connected
  useEffect(() => {
    if (address || circleWalletConnected) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        window.location.href = '/main.html';
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
            maxWidth: '1200px',
            width: '100%'
          }}>
            <h1 style={{ 
              marginBottom: '1rem', 
              color: '#1a1a1a',
              fontSize: '2.5rem',
              textAlign: 'center'
            }}>
              TradeFX
            </h1>
            <p style={{ 
              marginBottom: '2rem', 
              color: '#666',
              fontSize: '1.1rem',
              textAlign: 'center'
            }}>
              Choose your preferred wallet connection method
            </p>
            
            {/* Wallet Connection Options - Side by Side */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
              alignItems: 'flex-start'
            }}>
              {/* Thirdweb Connect Wallet Section */}
              <div style={{
                flex: 1
              }}>
                <h2 style={{
                  marginBottom: '1rem',
                  color: '#1a1a1a',
                  fontSize: '1.125rem',
                  fontWeight: '600'
                }}>
                  Connect Existing Wallet
                </h2>
                <p style={{
                  marginBottom: '1rem',
                  color: '#666',
                  fontSize: '0.875rem'
                }}>
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
              <div style={{
                flex: 1
              }}>
                <h2 style={{
                  marginBottom: '1rem',
                  color: '#1a1a1a',
                  fontSize: '1.125rem',
                  fontWeight: '600'
                }}>
                  Create Circle Wallet
                </h2>
                <p style={{
                  marginBottom: '1rem',
                  color: '#666',
                  fontSize: '0.875rem'
                }}>
                  Create a new user-controlled wallet with Circle. You maintain full control of your keys.
                </p>
                <CircleWalletAuth onSuccess={handleCircleWalletSuccess} />
              </div>
            </div>
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