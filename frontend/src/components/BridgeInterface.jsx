import { useState, useEffect } from "react";
import { useAddress, useWallet } from "@thirdweb-dev/react";
import { BridgeKit, Blockchain } from "@circle-fin/bridge-kit";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

// Supported chains for bridging to Arc
// Using Blockchain enum values from Circle's Bridge Kit
// Note: Since Arc Testnet is the destination, we only show testnet source chains
const SUPPORTED_CHAINS = [
  { name: "Ethereum Sepolia (Testnet)", value: Blockchain.Ethereum_Sepolia, chainId: 11155111, isTestnet: true },
  { name: "Base Sepolia (Testnet)", value: Blockchain.Base_Sepolia, chainId: 84532, isTestnet: true },
  { name: "Arbitrum Sepolia (Testnet)", value: Blockchain.Arbitrum_Sepolia, chainId: 421614, isTestnet: true },
  { name: "Optimism Sepolia (Testnet)", value: Blockchain.Optimism_Sepolia, chainId: 11155420, isTestnet: true },
  { name: "Polygon Amoy (Testnet)", value: Blockchain.Polygon_Amoy_Testnet, chainId: 80002, isTestnet: true },
  { name: "Avalanche Fuji (Testnet)", value: Blockchain.Avalanche_Fuji, chainId: 43113, isTestnet: true },
];

const TOKENS = [
  { name: "USDC", value: "USDC", symbol: "USDC" },
  { name: "EURC", value: "EURC", symbol: "EURC" },
];

const BridgeInterface = () => {
  const address = useAddress();
  const wallet = useWallet();
  const [sourceChain, setSourceChain] = useState(Blockchain.Ethereum_Sepolia);
  const [token, setToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [bridgeResult, setBridgeResult] = useState(null);
  const [circleWalletAddress, setCircleWalletAddress] = useState(null);

  // Check for Circle wallet address from localStorage
  useEffect(() => {
    const circleWalletId = localStorage.getItem("circleWalletId");
    if (circleWalletId && !address) {
      // For Circle wallets, we'd need to fetch the address from the API
      // This is a placeholder - you'd need to implement API call to get wallet address
      setCircleWalletAddress("Circle Wallet Connected");
    }
  }, [address]);

  // Get the current wallet address (either Thirdweb or Circle)
  const getWalletAddress = () => {
    return address || circleWalletAddress;
  };

  // Create wallet adapter for Bridge Kit
  const createWalletAdapter = async () => {
    if (!wallet && !window.ethereum) {
      throw new Error("No wallet connected. Please connect your wallet first.");
    }

    // Use window.ethereum if available (MetaMask, etc.)
    // For Thirdweb wallets, try to get the provider from the wallet
    let ethereumProvider = window.ethereum;
    
    if (wallet) {
      // Try to get provider from Thirdweb wallet
      try {
        const signer = await wallet.getSigner();
        if (signer?.provider) {
          // Thirdweb wallets may expose provider differently
          ethereumProvider = signer.provider.provider || signer.provider;
        }
      } catch (err) {
        console.warn("Could not get provider from Thirdweb wallet, using window.ethereum:", err);
      }
    }

    if (!ethereumProvider) {
      throw new Error("No Ethereum provider found. Please install MetaMask or connect a wallet.");
    }

    // Create Bridge Kit adapter from EIP1193 provider
    const adapter = await createAdapterFromProvider({
      provider: ethereumProvider,
      capabilities: {
        addressContext: "user-controlled", // User controls their own wallet
      },
    });

    return adapter;
  };

  const handleBridge = async () => {
    setError("");
    setStatus("");
    setBridgeResult(null);

    if (!getWalletAddress()) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setLoading(true);
    setStatus("Initializing bridge...");

    try {
      // Create wallet adapter
      setStatus("Connecting to wallet...");
      const adapter = await createWalletAdapter();

      // Initialize Bridge Kit
      setStatus("Initializing Bridge Kit...");
      const kit = new BridgeKit();
      
      // Verify supported chains (optional - for debugging)
      // const supportedChains = kit.getSupportedChains();
      // console.log("Supported chains:", supportedChains);

      // Configure bridge transfer
      const sourceChainName = SUPPORTED_CHAINS.find(c => c.value === sourceChain)?.name || sourceChain;
      setStatus(`Bridging ${amount} ${token} from ${sourceChainName} to Arc Testnet...`);
      
      const bridgeConfig = {
        from: {
          adapter,
          chain: sourceChain,
        },
        to: {
          adapter,
          chain: Blockchain.Arc_Testnet, // Note: Arc mainnet may not be available yet, using testnet
        },
        amount: amount,
        config: {
          transferSpeed: "FAST", // Use Fast Transfer for better UX
        },
      };

      // For EURC, we might need to specify the token
      // Note: Bridge Kit primarily supports USDC via CCTP
      // EURC support may vary - check Circle documentation
      if (token === "EURC") {
        // EURC bridging might require different configuration
        // This is a placeholder - adjust based on actual Bridge Kit API
        console.warn("EURC bridging may have limited support. Please verify with Circle documentation.");
      }

      // Execute bridge
      const result = await kit.bridge(bridgeConfig);

      setBridgeResult(result);
      setStatus("Bridge completed successfully!");
      
      // Show transaction details
      if (result.steps && result.steps.length > 0) {
        const lastStep = result.steps[result.steps.length - 1];
        if (lastStep.explorerUrl) {
          setStatus(`Bridge completed! View on explorer: ${lastStep.explorerUrl}`);
        }
      }
    } catch (err) {
      console.error("Bridge error:", err);
      setError(
        err.message || "Failed to bridge tokens. Please check your wallet connection and try again."
      );
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const walletAddress = getWalletAddress();

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "800px",
        margin: "0 auto",
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ marginBottom: "1.5rem", color: "#1a1a1a" }}>
        Bridge to Arc Network
      </h2>
      <p
        style={{
          marginBottom: "2rem",
          color: "#666",
          fontSize: "0.875rem",
        }}
      >
        Transfer USDC or EURC from supported testnet networks to your wallet on Arc
        Testnet using Circle's CCTP protocol.
        <br />
        <strong>Note:</strong> Currently bridging to Arc Testnet. Both source and destination must be testnet networks. Arc mainnet support will be available when Circle adds it.
      </p>

      {!walletAddress ? (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#fff3cd",
            borderRadius: "8px",
            border: "1px solid #ffc107",
            color: "#856404",
          }}
        >
          <strong>⚠️ Wallet Not Connected:</strong> Please connect your wallet
          first to use the bridge.
        </div>
      ) : (
        <>
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#d4edda",
              borderRadius: "8px",
              marginBottom: "1.5rem",
              border: "1px solid #c3e6cb",
            }}
          >
            <p
              style={{
                fontSize: "0.875rem",
                color: "#155724",
                marginBottom: "0.5rem",
              }}
            >
              <strong>Connected Wallet:</strong>
            </p>
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.875rem",
                color: "#155724",
                wordBreak: "break-all",
              }}
            >
              {walletAddress}
            </p>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#1a1a1a",
                fontWeight: "500",
              }}
            >
              Source Chain
            </label>
            <select
              value={sourceChain}
              onChange={(e) => setSourceChain(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "1rem",
                backgroundColor: loading ? "#f5f5f5" : "white",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.value} value={chain.value}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#1a1a1a",
                fontWeight: "500",
              }}
            >
              Token
            </label>
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "1rem",
                backgroundColor: loading ? "#f5f5f5" : "white",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {TOKENS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.name}
                </option>
              ))}
            </select>
            {token === "EURC" && (
              <p
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.75rem",
                  color: "#856404",
                }}
              >
                ⚠️ EURC support may vary. Please verify with Circle
                documentation.
              </p>
            )}
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#1a1a1a",
                fontWeight: "500",
              }}
            >
              Amount ({token})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              disabled={loading}
              min="0"
              step="0.01"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "1rem",
                backgroundColor: loading ? "#f5f5f5" : "white",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "1.5rem",
                backgroundColor: "#fee",
                borderRadius: "8px",
                border: "1px solid #fcc",
                color: "#c33",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          {status && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "1.5rem",
                backgroundColor: "#d1ecf1",
                borderRadius: "8px",
                border: "1px solid #bee5eb",
                color: "#0c5460",
                fontSize: "0.875rem",
              }}
            >
              {status}
            </div>
          )}

          {bridgeResult && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "1.5rem",
                backgroundColor: "#d4edda",
                borderRadius: "8px",
                border: "1px solid #c3e6cb",
              }}
            >
              <h3
                style={{
                  marginBottom: "0.5rem",
                  color: "#155724",
                  fontSize: "1rem",
                }}
              >
                Bridge Transaction Details
              </h3>
              {bridgeResult.steps?.map((step, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#155724",
                  }}
                >
                  <strong>Step {index + 1}:</strong> {step.type || "Transaction"}
                  {step.explorerUrl && (
                    <a
                      href={step.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginLeft: "0.5rem",
                        color: "#155724",
                        textDecoration: "underline",
                      }}
                    >
                      View on Explorer
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleBridge}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor:
                loading || !amount || parseFloat(amount) <= 0
                  ? "#94a3b8"
                  : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              cursor:
                loading || !amount || parseFloat(amount) <= 0
                  ? "not-allowed"
                  : "pointer",
              transition: "background-color 0.2s ease",
            }}
          >
            {loading ? "Bridging..." : `Bridge ${token} to Arc`}
          </button>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              fontSize: "0.75rem",
              color: "#666",
            }}
          >
            <strong>ℹ️ Note:</strong> Bridge transfers use Circle's CCTP
            protocol. Fast transfers typically complete in under 30 seconds.
            Standard transfers may take 15-19 minutes depending on the source
            chain finality.
          </div>
        </>
      )}
    </div>
  );
};

export default BridgeInterface;

