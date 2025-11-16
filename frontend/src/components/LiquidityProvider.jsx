import { useState, useEffect, useCallback } from "react";
import { useSDK, useAddress } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import { getContract } from "../utils/contractUtils"; // Assuming you have this util
import useKrakenTicker from "../hooks/useKrakenTicker"; // Hook for live price

// Token Addresses from your .env file
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
const EURC_ADDRESS = import.meta.env.VITE_EURC_ADDRESS;
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

const ProvideLiquidity = () => {
  const sdk = useSDK();
  const address = useAddress();
  const { data: ticker } = useKrakenTicker(); // Live EUR/USD price

  // State for user balances and inputs
  const [lptBalance, setLptBalance] = useState("0.0");
  const [buyUsdcAmount, setBuyUsdcAmount] = useState("");
  const [buyEurcAmount, setBuyEurcAmount] = useState("");
  const [sellLptForUsdcAmount, setSellLptForUsdcAmount] = useState("");
  const [sellLptForEurcAmount, setSellLptForEurcAmount] = useState("");

  // State for contract data
  const [usdcPricePerLpt, setUsdcPricePerLpt] = useState("0.0");
  const [eurcPricePerLpt, setEurcPricePerLpt] = useState("0.0");

  // State for UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Memoize FakeRate calculation
  const fakeRate = useCallback(() => {
    if (!ticker || !ticker.ask) return 0;
    // FakeRate is how many USDC 1 million EURC can buy.
    // ticker.ask = how many USDC 1 EURC can buy.
    return Math.floor(1_000_000 / ticker.ask);
  }, [ticker]);

  // Fetch all read-only data from the contract
  const fetchData = useCallback(async () => {
    if (!address || !sdk || !ticker) return;

    try {
      const contract = getContract(sdk.getSigner());
      const currentFakeRate = fakeRate();
      if (currentFakeRate === 0) return;

      // Fetch LPT balance
      const balance = await contract.balanceOf(address);
      setLptBalance(ethers.utils.formatEther(balance)); // LPT has 18 decimals

      // Fetch LPT prices
      const usdcPrice = await contract.getUSDCPricePerLPT(currentFakeRate);
      const eurcPrice = await contract.getEURCPricePerLPT(currentFakeRate);
      setUsdcPricePerLpt(ethers.utils.formatUnits(usdcPrice, 6)); // USDC has 6 decimals
      setEurcPricePerLpt(ethers.utils.formatUnits(eurcPrice, 6)); // EURC has 6 decimals

    } catch (err) {
      console.error("Error fetching LP data:", err);
      setError("Failed to fetch pool data. Please refresh.");
    }
  }, [address, sdk, ticker, fakeRate]);

  // Poll for data every 15 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- BUY LPT FUNCTIONS ---
  const handleBuyWithUsdc = async () => {
    if (!address || !sdk || !buyUsdcAmount || parseFloat(buyUsdcAmount) <= 0) {
      setError("Please enter a valid amount to buy.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const signer = await sdk.getSigner();
      const contract = getContract(signer);
      const currentFakeRate = fakeRate();

      // Amount of LPT to buy (has 18 decimals)
      const lptAmount = ethers.utils.parseEther(buyUsdcAmount);

      // Get the required USDC price for this amount
      const usdcPrice = await contract.getUSDCPrice(lptAmount, currentFakeRate);

      // Approve USDC spend
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ["function approve(address spender, uint256 amount) returns (bool)"], signer);
      const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, usdcPrice);
      await approveTx.wait();

      // Execute buy
      const tx = await contract.buyLPTWithUSDC(lptAmount, address, currentFakeRate);
      await tx.wait();

      alert("Successfully purchased LPT with USDC!");
      setBuyUsdcAmount("");
      fetchData(); // Refresh data immediately
    } catch (err) {
      console.error("Error buying with USDC:", err);
      setError(err.reason || err.message || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyWithEurc = async () => {
    if (!address || !sdk || !buyEurcAmount || parseFloat(buyEurcAmount) <= 0) {
      setError("Please enter a valid amount to buy.");
      return;
    }
    setLoading(true);
    setError("");

    try {
        const signer = await sdk.getSigner();
        const contract = getContract(signer);
        const currentFakeRate = fakeRate();
        const lptAmount = ethers.utils.parseEther(buyEurcAmount);
        const eurcPrice = await contract.getEURCPrice(lptAmount, currentFakeRate);

        const eurcContract = new ethers.Contract(EURC_ADDRESS, ["function approve(address spender, uint256 amount) returns (bool)"], signer);
        const approveTx = await eurcContract.approve(CONTRACT_ADDRESS, eurcPrice);
        await approveTx.wait();

        const tx = await contract.buyLPTWithEURC(lptAmount, address, currentFakeRate);
        await tx.wait();

        alert("Successfully purchased LPT with EURC!");
        setBuyEurcAmount("");
        fetchData();
    } catch (err) {
        console.error("Error buying with EURC:", err);
        setError(err.reason || err.message || "Transaction failed.");
    } finally {
        setLoading(false);
    }
  };

  // --- SELL LPT FUNCTIONS ---
  const handleSellForUsdc = async () => {
    if (!address || !sdk || !sellLptForUsdcAmount || parseFloat(sellLptForUsdcAmount) <= 0) {
      setError("Please enter a valid amount to sell.");
      return;
    }
    setLoading(true);
    setError("");

    try {
        const signer = await sdk.getSigner();
        const contract = getContract(signer);
        const currentFakeRate = fakeRate();
        const lptAmount = ethers.utils.parseEther(sellLptForUsdcAmount);

        // NOTE: The TradeFX contract itself needs to be approved to burn LPTs.
        // This is an ERC20 standard. For simplicity, we assume this is handled
        // or we can add an `approve` call on the TradeFX contract itself.
        // For now, let's proceed assuming the user has approved.

        const tx = await contract.sellLPTForUSDC(lptAmount, address, currentFakeRate);
        await tx.wait();

        alert("Successfully sold LPT for USDC!");
        setSellLptForUsdcAmount("");
        fetchData();
    } catch (err) {
        console.error("Error selling for USDC:", err);
        setError(err.reason || err.message || "Transaction failed.");
    } finally {
        setLoading(false);
    }
  };

  const handleSellForEurc = async () => {
     if (!address || !sdk || !sellLptForEurcAmount || parseFloat(sellLptForEurcAmount) <= 0) {
      setError("Please enter a valid amount to sell.");
      return;
    }
    setLoading(true);
    setError("");

     try {
        const signer = await sdk.getSigner();
        const contract = getContract(signer);
        const currentFakeRate = fakeRate();
        const lptAmount = ethers.utils.parseEther(sellLptForEurcAmount);
        
        const tx = await contract.sellLPTForEURC(lptAmount, address, currentFakeRate);
        await tx.wait();

        alert("Successfully sold LPT for EURC!");
        setSellLptForEurcAmount("");
        fetchData();
    } catch (err) {
        console.error("Error selling for EURC:", err);
        setError(err.reason || err.message || "Transaction failed.");
    } finally {
        setLoading(false);
    }
  };


  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", color: "#1a1a1a" }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Become a Liquidity Provider</h2>
      
      {!address ? (
        <div style={{ padding: "1.5rem", backgroundColor: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107", color: "#856404" }}>
          <strong>Wallet Not Connected:</strong> Please connect your wallet to provide liquidity.
        </div>
      ) : (
        <>
          {/* Top Section: Balances and Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Your LPT Balance</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '600' }}>{parseFloat(lptBalance).toFixed(4)} TFXL</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', borderLeft: '1px solid #ddd', paddingLeft: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>USDC Price / LPT</p>
                <p style={{ fontSize: '1.25rem', fontWeight: '500' }}>${parseFloat(usdcPricePerLpt).toFixed(4)}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>EURC Price / LPT</p>
                <p style={{ fontSize: '1.25rem', fontWeight: '500' }}>€{parseFloat(eurcPricePerLpt).toFixed(4)}</p>
              </div>
            </div>
          </div>

          {error && <div style={{ padding: "1rem", marginBottom: "1.5rem", backgroundColor: "#f8d7da", borderRadius: "8px", border: "1px solid #f5c6cb", color: "#721c24" }}>{error}</div>}

          {/* Buy & Sell Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* BUY SECTION */}
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>Buy LPT</h3>
              
              {/* Buy with USDC */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount of LPT to Buy (with USDC)</label>
                <input type="number" value={buyUsdcAmount} onChange={(e) => setBuyUsdcAmount(e.target.value)} placeholder="0.0" disabled={loading} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}/>
                <button onClick={handleBuyWithUsdc} disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', backgroundColor: loading ? '#94a3b8' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  {loading ? 'Processing...' : 'Buy with USDC'}
                </button>
              </div>

              {/* Buy with EURC */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount of LPT to Buy (with EURC)</label>
                <input type="number" value={buyEurcAmount} onChange={(e) => setBuyEurcAmount(e.target.value)} placeholder="0.0" disabled={loading} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}/>
                <button onClick={handleBuyWithEurc} disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', backgroundColor: loading ? '#94a3b8' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  {loading ? 'Processing...' : 'Buy with EURC'}
                </button>
              </div>
            </div>

            {/* SELL SECTION */}
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>Sell LPT</h3>
              
              {/* Sell for USDC */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount of LPT to Sell (for USDC)</label>
                <input type="number" value={sellLptForUsdcAmount} onChange={(e) => setSellLptForUsdcAmount(e.target.value)} placeholder="0.0" disabled={loading} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}/>
                <button onClick={handleSellForUsdc} disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', backgroundColor: loading ? '#94a3b8' : '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  {loading ? 'Processing...' : 'Sell for USDC'}
                </button>
              </div>

              {/* Sell for EURC */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount of LPT to Sell (for EURC)</label>
                <input type="number" value={sellLptForEurcAmount} onChange={(e) => setSellLptForEurcAmount(e.target.value)} placeholder="0.0" disabled={loading} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}/>
                <button onClick={handleSellForEurc} disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', backgroundColor: loading ? '#94a3b8' : '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  {loading ? 'Processing...' : 'Sell for EURC'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProvideLiquidity;
