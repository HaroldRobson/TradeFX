import { ConnectWallet, useAddress, useDisconnect } from "@thirdweb-dev/react"

const WalletAuth = () => {
  const address = useAddress()
  const disconnect = useDisconnect()

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#1a1a1a' }}>Wallet Management</h2>
      {!address ? (
        <div>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Connect your wallet using one of the following methods:
          </p>
          <ul style={{
            textAlign: 'left',
            marginBottom: '2rem',
            paddingLeft: '1.5rem',
            color: '#666'
          }}>
            <li>📧 Email Authentication</li>
            <li>🔐 Passkey (Passwordless)</li>
            <li>🍎 Apple Sign In</li>
            <li>🔵 Google Sign In</li>
          </ul>
          <ConnectWallet
            theme="light"
            btnTitle="Connect Wallet"
            modalTitle="Sign In to Trade FX"
            modalSize="wide"
            welcomeScreen={{
              title: "Welcome to Trade FX",
              subtitle: "Connect your wallet to get started",
            }}
          />
        </div>
      ) : (
        <div>
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: '#666',
              marginBottom: '0.5rem'
            }}>
              Connected Address
            </p>
            <p style={{
              fontFamily: 'monospace',
              fontSize: '1rem',
              color: '#1a1a1a',
              wordBreak: 'break-all'
            }}>
              {address}
            </p>
          </div>
          <button
            onClick={disconnect}
            style={{
              padding: '12px 24px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'background-color 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  )
}

export default WalletAuth
