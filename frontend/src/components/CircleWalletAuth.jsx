import { useRef, useState } from "react";
// Circle SDK will be imported dynamically to avoid browser compatibility issues

const CircleWalletAuth = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState(null); // 'email', 'google', 'apple', 'pin'
  const sdkRef = useRef(null);

  // Initialize Circle SDK with credentials from backend
  const initializeSDK = async (appId, userToken, encryptionKey) => {
    if (sdkRef.current) {
      // Update authentication if SDK already exists
      sdkRef.current.setAppSettings({ appId });
      sdkRef.current.setAuthentication({ userToken, encryptionKey });
      return sdkRef.current;
    }

    try {
      const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

      sdkRef.current = new W3SSdk({
        configs: {
          appSettings: { appId },
          authentication: {
            userToken,
            encryptionKey,
          },
          socialLoginConfig: {
            google: {
              clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
              redirectUri: window.location.origin + "/callback",
              selectAccountPrompt: true,
            },
            apple: {
              // Apple config if needed
            },
            facebook: {
              appId: import.meta.env.VITE_FACEBOOK_APP_ID || "",
              redirectUri: window.location.origin + "/callback",
            },
          },
        },
        socialLoginCompleteCallback: (error, result) => {
          if (error) {
            setError(`Social Login Error: ${error.message ?? "Error!"}`);
            setLoading(false);
            return;
          }
          if (result?.userToken && result?.encryptionKey) {
            // Update SDK with new credentials from social login
            sdkRef.current.setAuthentication({
              userToken: result.userToken,
              encryptionKey: result.encryptionKey,
            });
            // Continue with wallet creation
            handleWalletCreation(result.userToken, result.encryptionKey);
          }
        },
      });

      sdkRef.current.setAppSettings({ appId });
      sdkRef.current.setAuthentication({ userToken, encryptionKey });

      return sdkRef.current;
    } catch (err) {
      console.error("Failed to initialize Circle SDK:", err);
      throw err;
    }
  };

  // Execute challenge to complete wallet setup
  const executeChallenge = async (challengeId, userToken, encryptionKey) => {
    try {
      if (!sdkRef.current) {
        throw new Error("SDK not initialized");
      }

      sdkRef.current.execute(challengeId, (error, result) => {
        if (error) {
          setError(`Challenge Error: ${error.message ?? "Error!"}`);
          setLoading(false);
          return;
        }

        // Success - wallet created/initialized
        if (onSuccess) {
          onSuccess({
            walletId: result?.walletId,
            userToken,
            encryptionKey,
            challengeId,
            ...result,
          });
        }
        setLoading(false);
      });
    } catch (err) {
      console.error("Challenge execution error:", err);
      setError("Failed to execute challenge. Please try again.");
      setLoading(false);
    }
  };

  // Handle wallet creation flow
  const handleWalletCreation = async (userToken, encryptionKey) => {
    try {
      // Get wallet creation challenge from backend
      const response = await fetch("/api/circle/create-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.challengeId) {
          await executeChallenge(data.challengeId, userToken, encryptionKey);
        } else {
          setError("Failed to get wallet creation challenge.");
          setLoading(false);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "Failed to create wallet. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Wallet creation error:", err);
      setError("An error occurred during wallet creation.");
      setLoading(false);
    }
  };

  // Main handler for wallet initialization
  const handleWalletInit = async (method = "pin") => {
    setAuthMethod(method);
    setError("");
    setLoading(true);

    try {
      // Step 1: Backend creates user, session, and initializes wallet
      // This endpoint should:
      // 1. Create a user (if needed)
      // 2. Create a session token (returns userToken, encryptionKey)
      // 3. Initialize user account and create wallet (returns appId, challengeId)
      let response;
      try {
        response = await fetch("/api/circle/initialize-wallet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method, // 'pin', 'email', etc.
          }),
        });
      } catch (fetchError) {
        throw new Error(
          "Unable to connect to backend server. Please ensure your backend API is running and implements the /api/circle/initialize-wallet endpoint."
        );
      }

      if (response.status === 404) {
        throw new Error(
          "Backend API endpoint not found. Please implement the /api/circle/initialize-wallet endpoint on your backend server. See the README for implementation details."
        );
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Server error: ${response.status} ${response.statusText}` };
        }
        throw new Error(errorData.message || "Failed to initialize wallet");
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Expected JSON but received something else.");
      }

      // Validate required fields
      if (!data.appId || !data.userToken || !data.encryptionKey || !data.challengeId) {
        throw new Error(
          "Invalid response from server. Missing required fields (appId, userToken, encryptionKey, or challengeId)."
        );
      }

      // Step 2: Initialize SDK with credentials
      await initializeSDK(data.appId, data.userToken, data.encryptionKey);

      // Step 3: Execute challenge (PIN setup, wallet creation, etc.)
      await executeChallenge(data.challengeId, data.userToken, data.encryptionKey);
    } catch (err) {
      console.error("Wallet initialization error:", err);
      setError(err.message || "Failed to initialize wallet. Please try again.");
      setLoading(false);
    }
  };

  // Handle PIN authentication
  const handlePinAuth = async () => {
    await handleWalletInit("pin");
  };

  // Handle Email authentication
  const handleEmailAuth = async () => {
    await handleWalletInit("email");
  };

  // Handle social login
  const handleSocialLogin = async (provider) => {
    setAuthMethod(provider);
    setError("");
    setLoading(true);

    try {
      // For social login, we need to:
      // 1. Get appId from backend
      // 2. Initialize SDK with appId (without userToken/encryptionKey yet)
      // 3. Perform social login (which will return userToken/encryptionKey)
      // 4. Then initialize wallet

      let response;
      try {
        response = await fetch("/api/circle/get-app-id", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (fetchError) {
        throw new Error(
          "Unable to connect to backend server. Please ensure your backend API is running and implements the /api/circle/get-app-id endpoint."
        );
      }

      if (response.status === 404) {
        throw new Error(
          "Backend API endpoint not found. Please implement the /api/circle/get-app-id endpoint on your backend server. See the README for implementation details."
        );
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Server error: ${response.status} ${response.statusText}` };
        }
        throw new Error(errorData.message || "Failed to get App ID");
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Expected JSON but received something else.");
      }

      const { appId } = data;

      if (!appId) {
        throw new Error("App ID not found in server response");
      }

      // Initialize SDK with just appId for social login
      const { W3SSdk, SocialLoginProvider } = await import("@circle-fin/w3s-pw-web-sdk");

      const providerMap = {
        google: SocialLoginProvider.GOOGLE,
        apple: SocialLoginProvider.APPLE,
        facebook: SocialLoginProvider.FACEBOOK,
      };

      sdkRef.current = new W3SSdk({
        configs: {
          appSettings: { appId },
          authentication: {
            userToken: "", // Will be set after social login
            encryptionKey: "", // Will be set after social login
          },
          socialLoginConfig: {
            google: {
              clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
              redirectUri: window.location.origin + "/callback",
              selectAccountPrompt: true,
            },
            facebook: {
              appId: import.meta.env.VITE_FACEBOOK_APP_ID || "",
              redirectUri: window.location.origin + "/callback",
            },
          },
        },
        socialLoginCompleteCallback: async (error, result) => {
          if (error) {
            setError(`Social Login Error: ${error.message ?? "Error!"}`);
            setLoading(false);
            return;
          }

          if (result?.userToken && result?.encryptionKey) {
            // Update SDK with social login credentials
            sdkRef.current.setAuthentication({
              userToken: result.userToken,
              encryptionKey: result.encryptionKey,
            });

            // Now initialize wallet
            await handleWalletCreation(result.userToken, result.encryptionKey);
          } else {
            setError("Social login completed but missing credentials.");
            setLoading(false);
          }
        },
      });

      sdkRef.current.setAppSettings({ appId });

      // Perform social login
      sdkRef.current.performLogin(providerMap[provider]);
    } catch (err) {
      console.error("Social login error:", err);
      setError(err.message || "Failed to initiate social login. Please check your backend configuration.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        padding: "1.5rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "12px",
        border: "1px solid #e9ecef",
      }}
    >
      <h3
        style={{
          marginBottom: "1rem",
          color: "#1a1a1a",
          fontSize: "1.25rem",
          fontWeight: "600",
        }}
      >
        Create Circle Wallet
      </h3>
      <p
        style={{
          marginBottom: "1.5rem",
          color: "#666",
          fontSize: "0.875rem",
        }}
      >
        Create a user-controlled wallet with Circle. Choose your preferred
        authentication method:
      </p>

      {error && (
        <div
          style={{
            padding: "0.75rem",
            marginBottom: "1rem",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            color: "#c33",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <button
          onClick={handlePinAuth}
          disabled={loading}
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: loading ? "#94a3b8" : "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          🔐 PIN
        </button>

        <button
          onClick={handleEmailAuth}
          disabled={loading}
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: loading ? "#94a3b8" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          📧 Email
        </button>

        <button
          onClick={() => handleSocialLogin("google")}
          disabled={loading}
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: loading ? "#94a3b8" : "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          🔵 Google
        </button>

        <button
          onClick={() => handleSocialLogin("apple")}
          disabled={loading}
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: loading ? "#94a3b8" : "#000",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          🍎 Apple
        </button>
      </div>

      {loading && (
        <div
          style={{
            marginTop: "1rem",
            textAlign: "center",
            color: "#666",
            fontSize: "0.875rem",
          }}
        >
          {authMethod === "email" && "Initializing email authentication..."}
          {authMethod === "google" && "Redirecting to Google..."}
          {authMethod === "apple" && "Redirecting to Apple..."}
          {authMethod === "pin" && "Setting up PIN authentication..."}
          {!authMethod && "Loading..."}
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          backgroundColor: "#fff3cd",
          borderRadius: "8px",
          fontSize: "0.75rem",
          color: "#856404",
          border: "1px solid #ffc107",
        }}
      >
        <strong>⚠️ Backend Required:</strong> This feature requires backend API endpoints that use your Circle API key.
        <br />
        <strong>Required endpoints:</strong>
        <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
          <li><code>GET /api/circle/get-app-id</code></li>
          <li><code>POST /api/circle/initialize-wallet</code></li>
          <li><code>POST /api/circle/create-wallet</code></li>
        </ul>
        See the README for implementation details.
      </div>
    </div>
  );
};

export default CircleWalletAuth;
