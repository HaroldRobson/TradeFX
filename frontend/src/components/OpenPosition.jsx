import { useState, useMemo } from "react";
import useKrakenTicker from "../hooks/useKrakenTicker";
import { useSDK, useAddress } from "@thirdweb-dev/react";
import { getContract } from "../utils/contractUtils";
import { ethers } from "ethers";

const InfoTooltip = ({ text }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        marginLeft: '0.5rem'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        i
      </div>
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '25px',
            right: '0',
            backgroundColor: '#1f2937',
            color: 'white',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};
const StartToken = {
  USDC: 0,
  EURC: 1
};

function OpenPosition({ pair = "USDC_EURC" }) {
   const sdk = useSDK(); // Get Thirdweb SDK
  const address = useAddress(); // Get connected wallet address const sdk = useSDK(); // Get Thirdweb SDK
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [collateral, setCollateral] = useState(0);
  const [borrowed, setBorrowed] = useState(0);
  const [startToken, setStartToken] = useState(StartToken.USDC);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

const handleOpenPosition = async () => {
console.log("Contract address:", import.meta.env.VITE_CONTRACT_ADDRESS);
console.log("USDC address:", import.meta.env.VITE_USDC_ADDRESS);
console.log("EURC address:", import.meta.env.VITE_EURC_ADDRESS);
  console.log("Button clicked!"); // ADD THIS
  console.log("Address:", address); // ADD THIS
  console.log("effectiveQuotes:", effectiveQuotes); // ADD THIS
  console.log("amount:", amount); // ADD THIS
  
  // Check if wallet is connected
  if (!address) {
    console.log("No address - wallet not connected"); // ADD THIS
    alert("Please connect your wallet first");
    return;
  }

  if (!effectiveQuotes) {
    console.log("No quotes yet"); // ADD THIS
    console.warn("No live price yet");
    return;
  }

  if (!amount || Number(amount) <= 0) {
    console.log("Invalid amount"); // ADD THIS
    alert("Please enter a valid amount");
    return;
  }

  console.log("Starting transaction..."); // ADD THIS
  setIsSubmitting(true);

  try {
    console.log("Getting signer..."); // ADD THIS
    const signer = await sdk.getSigner();
    console.log("Signer:", signer); // ADD THIS   
    const contract = getContract(signer);

    // Get token addresses from env
    const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
    const EURC_ADDRESS = import.meta.env.VITE_EURC_ADDRESS;

    // Determine start_token and pos_token based on selection
    const startTokenAddress = startToken === StartToken.USDC ? USDC_ADDRESS : EURC_ADDRESS;
    const posTokenAddress = startToken === StartToken.USDC ? EURC_ADDRESS : USDC_ADDRESS;

    // Calculate collateral and borrow (with 6 decimals)
    const collateral = ethers.utils.parseUnits(amount, 6);
    const borrow = collateral.mul(leverage);

    // Calculate FakeRate from Kraken ticker
    // ticker.ask is EURC/USDC (how many USDC per EURC)
    // FakeRate = how many DOLLARS (USDC) a million EUROS (EURC) could buy
    // So: FakeRate = ticker.ask * 1,000,000
    const fakeRate = Math.floor(ticker.ask * 1000000);

    console.log("Opening position with:", {
      startTokenAddress,
      collateral: collateral.toString(),
      borrow: borrow.toString(),
      posTokenAddress,
      fakeRate,
      ticker: ticker.ask
    });

    // Step 1: Approve the start_token
    const tokenContract = new ethers.Contract(
      startTokenAddress,
      ["function approve(address spender, uint256 amount) returns (bool)"],
      signer
    );

    console.log("Approving token spend...");
    const approveTx = await tokenContract.approve(
      import.meta.env.VITE_CONTRACT_ADDRESS,
      collateral
    );
    await approveTx.wait();
    console.log("Approval confirmed");

    // Step 2: Open position
    console.log("Opening position...");
    const tx = await contract.openPosition(
      startTokenAddress,
      collateral,
      borrow,
      posTokenAddress,
      fakeRate
    );

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    
    console.log("Position opened!", receipt);
    alert("Position opened successfully!");

    // Reset form
    setAmount("");
    setLeverage(1);

  } catch (error) {
    console.error("Error opening position:", error);
    alert("Failed to open position: " + (error.reason || error.message));
  } finally {
    setIsSubmitting(false);
  }
};

  const priceDisplay =
    effectiveQuotes && ticker
      ? pair === "USDC_EURC"
        ? `${effectiveQuotes.bid.toFixed(4)} / ${effectiveQuotes.ask.toFixed(4)} USDC per EURC`
        : `${effectiveQuotes.bid.toFixed(4)} / ${effectiveQuotes.ask.toFixed(4)} EURC per USDC`
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
      
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-1.9rem', right: '0.2rem', zIndex: 10 }}>
          <InfoTooltip text="Borrow funds in the same currency as your collateral, and bet against that currency through a leveraged trade!"  />
        </div>
 
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
            <label>Position Type:</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setStartToken(StartToken.USDC)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: startToken === StartToken.USDC ? '#3b82f6' : '#e5e7eb',
                  color: startToken === StartToken.USDC ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: startToken === StartToken.USDC ? '600' : '400',
                }}
              >
                Short USDC (Long EURC)
              </button>
              <button
                onClick={() => setStartToken(StartToken.EURC)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: startToken === StartToken.EURC ? '#3b82f6' : '#e5e7eb',
                  color: startToken === StartToken.EURC ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: startToken === StartToken.EURC ? '600' : '400',
                }}
              >
                Short EURC (Long USDC)
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label>Collateral ({startToken === StartToken.USDC ? "USDC" : "EURC"}):</label>
            <input
              type="number"
              value={amount}
              min="0"
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
              onChange={(e) => setLeverage(Number(e.target.value))}
            />
          </div>
          
          <button
            className="buy-button"
            onClick={handleOpenPosition}
            disabled={!effectiveQuotes}
            style={{ width: '100%' }}
          >
            Open Position
          </button>
        </div>
      </div>
    </div>
  );
}

export default OpenPosition;
