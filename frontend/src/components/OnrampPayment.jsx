import { useState } from "react"
import { useAddress } from "@thirdweb-dev/react"

const OnrampPayment = () => {
  const address = useAddress()
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleBuyUSDT = async () => {
    if (!address) {
      alert("Please connect your wallet first")
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount")
      return
    }

    setIsLoading(true)

    try {
      const arcUrl = `https://buy.arc.market/?` + new URLSearchParams({
        apiKey: import.meta.env.VITE_ARC_API_KEY || 'demo',
        targetChainId: '1',
        targetAsset: 'USDT',
        sourceAmount: amount,
        sourceCurrency: 'EUR',
        walletAddress: address,
      }).toString()

      window.open(arcUrl, '_blank', 'width=500,height=700')
    } catch (error) {
      console.error("Error opening Arc onramp:", error)
      alert("Failed to open payment gateway")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#1a1a1a' }}>Buy USDT with EUR</h2>

      {!address ? (
        <div style={{
          padding: '2rem',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffc107',
          textAlign: 'center'
        }}>
          <p style={{ color: '#856404', margin: 0 }}>
            ⚠️ Please connect your wallet first to buy USDT
          </p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#1a1a1a'
            }}>
              Amount (EUR)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount in EUR"
              min="0"
              step="0.01"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                boxSizing: 'border-box',
                transition: 'border-color 0.3s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <button
            onClick={handleBuyUSDT}
            disabled={isLoading || !amount}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isLoading || !amount ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: isLoading || !amount ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              transition: 'background-color 0.3s ease'
            }}
            onMouseOver={(e) => {
              if (!isLoading && amount) e.target.style.backgroundColor = '#5568d3'
            }}
            onMouseOut={(e) => {
              if (!isLoading && amount) e.target.style.backgroundColor = '#667eea'
            }}
          >
            {isLoading ? 'Opening Payment Gateway...' : 'Buy USDT'}
          </button>

          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <p style={{
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#1a1a1a'
            }}>
              Payment Details
            </p>
            <div style={{
              display: 'grid',
              gap: '0.75rem',
              fontSize: '0.875rem',
              color: '#666'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>From:</span>
                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>EUR</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>To:</span>
                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>USDT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Network:</span>
                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>Ethereum</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Wallet:</span>
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#1a1a1a'
                }}>
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OnrampPayment
