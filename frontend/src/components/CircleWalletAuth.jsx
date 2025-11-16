import { useRef, useState } from "react";
// Circle SDK will be imported dynamically to avoid browser compatibility issues

const CircleWalletAuth = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [authMethod, setAuthMethod] = useState(null); // 'email', 'google', 'apple', 'pin'
  const sdkRef = useRef(null);

  // Get Circle API key from environment
  const getApiKey = () => {
    const apiKey = import.meta.env.VITE_CIRCLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Circle API key not configured. Please set VITE_CIRCLE_API_KEY environment variable."
      );
    }
    return apiKey;
  };

  // Get app ID from Circle API using API key
  const getAppId = async () => {
    const apiKey = getApiKey();
    try {
      const response = await fetch("https://api.circle.com/v1/w3s/config/entity", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to get app ID: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.appId;
    } catch (err) {
      console.error("Error fetching app ID:", err);
      throw new Error(`Failed to get app ID: ${err.message}`);
    }
  };

  // Create user using Circle API
  const createUser = async (userId) => {
    const apiKey = getApiKey();
    try {
      const response = await fetch("https://api.circle.com/v1/w3s/users", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // User might already exist, which is okay
        if (response.status !== 409) {
          throw new Error(errorData.message || `Failed to create user: ${response.status}`);
        }
      }

      return await response.json();
    } catch (err) {
      console.error("Error creating user:", err);
      throw err;
    }
  };

  // Request email token
  const requestEmailToken = async () => {
    const apiKey = getApiKey();

    const email = window.prompt("Enter your email:");
    if (!email) throw new Error("No email provided");

    const idempotencyKey = `${Date.now()}-${Math.random()}`;
    const deviceId = crypto.randomUUID();

    const resp = await fetch("http://127.0.0.1:8000/auth/email/token", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,          // REQUIRED
        idempotencyKey,
        deviceId
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || "Failed to request email token");
    }

    return {
      email,
      deviceId,
      ...(await resp.json()).data
    };
  };

  const verifyEmailOtp = async (otp, otpToken, deviceToken) => {
    const apiKey = getApiKey();

    const resp = await fetch("http://127.0.0.1:8000/auth/email/verify", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        otp,
        otpToken,
        deviceToken
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || "OTP verification failed");
    }

    return (await resp.json()).data;
    // RETURNS { userToken, encryptionKey }
  };

  // Initialize user account and create wallet using Circle API
  const initializeUser = async (userToken, blockchains = ["ETH"]) => {
    const apiKey = getApiKey();
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
      const response = await fetch("https://api.circle.com/v1/w3s/user/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-User-Token": userToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey,
          blockchains,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to initialize user: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.challengeId;
    } catch (err) {
      console.error("Error initializing user:", err);
      throw err;
    }
  };

  // Initialize Circle SDK with credentials
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
            apple: (() => {
              try {
                return import.meta.env.VITE_APPLE_FIREBASE_CONFIG
                  ? JSON.parse(import.meta.env.VITE_APPLE_FIREBASE_CONFIG)
                  : undefined;
              } catch (e) {
                console.warn("Invalid VITE_APPLE_FIREBASE_CONFIG. Apple login will not be available.", e);
                return undefined;
              }
            })(),
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
      // Create wallet using Circle API
      const challengeId = await initializeUser(userToken);
      if (challengeId) {
        await executeChallenge(challengeId, userToken, encryptionKey);
      } else {
        setError("Failed to get wallet creation challenge.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Wallet creation error:", err);
      setError(err.message || "An error occurred during wallet creation.");
      setLoading(false);
    }
  };

  // Main handler for wallet initialization
  const handleWalletInit = async (method = "pin") => {
    setAuthMethod(method);
    setError("");
    setStatus("");
    setLoading(true);

    try {
      // Step 1: Get app ID from Circle API
      setStatus("Getting app configuration...");
      const appId = await getAppId();
      if (!appId) {
        throw new Error("Failed to get app ID from Circle API.");
      }

      // Step 2: Create or get user
      setStatus("Creating user...");
      const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await createUser(userId);

      // Step 3: Create session to get userToken and encryptionKey
      setStatus("Creating session...");
      const { userToken, encryptionKey } = await createSession(userId);
      if (!userToken || !encryptionKey) {
        throw new Error("Failed to create session. Missing userToken or encryptionKey.");
      }

      // Step 4: Initialize SDK with credentials
      setStatus("Initializing SDK...");
      await initializeSDK(appId, userToken, encryptionKey);

      // Step 5: Initialize user account and create wallet
      setStatus("Creating wallet...");
      const challengeId = await initializeUser(userToken);

      // Step 6: Execute challenge (PIN setup, wallet creation, etc.)
      if (challengeId) {
        setStatus("Completing wallet setup...");
        await executeChallenge(challengeId, userToken, encryptionKey);
      } else {
        throw new Error("Failed to get challenge ID for wallet creation.");
      }
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
    setAuthMethod("email");
    setLoading(true);
    setError("");
    setStatus("Requesting email login...");

    try {
      // Step 1: request email login token
      const { deviceToken, deviceEncryptionKey, otpToken } = await requestEmailToken();

      // SIMPLE OTP PROMPT (replace with modal later)
      const otp = window.prompt("Enter the 6-digit code sent to your email:");
      if (!otp) throw new Error("OTP input cancelled");

      // Step 2: verify OTP → get userToken + encryptionKey
      setStatus("Verifying email code...");
      const { userToken, encryptionKey } = await verifyEmailOtp(
        otp,
        otpToken,
        deviceToken
      );

      // Step 3: SDK setup + wallet creation
      setStatus("Setting up wallet...");
      const appId = await getAppId();
      await initializeSDK(appId, userToken, encryptionKey);
      await handleWalletCreation(userToken, encryptionKey);

    } catch (err) {
      console.error("Email auth error:", err);
      setError(err.message || "Email authentication failed.");
    }

    setLoading(false);
  };

  // Handle social login
  const handleSocialLogin = async (provider) => {
    setAuthMethod(provider);
    setError("");
    setStatus("");
    setLoading(true);

    try {
      // For social login, we need to:
      // 1. Get appId from Circle API
      // 2. Initialize SDK with appId (without userToken/encryptionKey yet)
      // 3. Perform social login (which will return userToken/encryptionKey)
      // 4. Then initialize wallet

      setStatus("Getting app configuration...");
      const appId = await getAppId();
      if (!appId) {
        throw new Error("Failed to get app ID from Circle API.");
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
            apple: (() => {
              try {
                return import.meta.env.VITE_APPLE_FIREBASE_CONFIG
                  ? JSON.parse(import.meta.env.VITE_APPLE_FIREBASE_CONFIG)
                  : undefined;
              } catch (e) {
                console.warn("Invalid VITE_APPLE_FIREBASE_CONFIG. Apple login will not be available.", e);
                return undefined;
              }
            })(),
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
          {status || (authMethod === "email" && "Initializing email authentication...")}
          {!status && authMethod === "google" && "Redirecting to Google..."}
          {!status && authMethod === "apple" && "Redirecting to Apple..."}
          {!status && authMethod === "pin" && "Setting up PIN authentication..."}
          {!status && !authMethod && "Loading..."}
        </div>
      )}
    </div>
  );
};

export default CircleWalletAuth;
