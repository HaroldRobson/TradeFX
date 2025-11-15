//import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { useEffect, useRef, useState } from "react";


const EmailLogin = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // 'email' or 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sdkRef = useRef(null);

  // SDK will be initialized lazily when user submits email form
  // This prevents SDK loading errors from breaking the app on initial load

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

  // Create session using Circle API
  const createSession = async (userId) => {
    const apiKey = getApiKey();
    try {
      const response = await fetch("https://api.circle.com/v1/w3s/user/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      return {
        userToken: data.data?.userToken,
        encryptionKey: data.data?.encryptionKey,
      };
    } catch (err) {
      console.error("Error creating session:", err);
      throw err;
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Initialize SDK if not already initialized
      if (!sdkRef.current) {
        try {
          // Get app ID, user token, and encryption key using API key
          const appId = await getAppId();
          if (!appId) {
            throw new Error("Failed to get app ID from Circle API.");
          }

          // Create user and session
          const userId = `user-${email}-${Date.now()}`;
          await createUser(userId);
          const { userToken, encryptionKey } = await createSession(userId);

          if (!userToken || !encryptionKey) {
            throw new Error("Failed to create session. Missing userToken or encryptionKey.");
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
              socialLoginConfig: {},
            },
            socialLoginCompleteCallback: (error, result) => {
              if (error) {
                setError(`Login Error: ${error.message ?? "Error!"}`);
                setLoading(false);
                return;
              }
              if (result?.userToken) {
                localStorage.setItem("circleUserToken", result.userToken);
                if (onSuccess) {
                  onSuccess(result);
                }
              }
            },
          });
            sdkRef.current.setAppSettings({ appId });
            sdkRef.current.setAuthentication({ userToken, encryptionKey });
          } catch (sdkError) {
            console.error("Failed to load Circle SDK:", sdkError);
            setError(sdkError.message || "Failed to initialize login system. Please try again later.");
            setLoading(false);
            return;
          }
        } catch (initError) {
          console.error("Failed to initialize Circle credentials:", initError);
          setError(initError.message || "Failed to initialize login system. Please try again later.");
          setLoading(false);
          return;
        }
      }

      // For email login, you typically need to:
      // 1. Send OTP to email via your backend
      // 2. Then verify OTP with Circle SDK
      
      // This is a placeholder - you'll need to implement the backend API call
      // to send OTP to the email address
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.otpToken) {
          // Store OTP token for verification
          localStorage.setItem("otpToken", data.otpToken);
          setStep("otp");
        } else {
          setError("Failed to send OTP. Please try again.");
        }
      } else if (response.status === 404) {
        setError(
          "Backend API not found. Please implement /api/send-otp endpoint. See Circle SDK documentation for details."
        );
      } else {
        setError("Failed to send OTP. Please check your email and try again.");
      }
    } catch (err) {
      console.error("Email login error:", err);
      if (err.message.includes("Failed to fetch")) {
        setError(
          "Unable to connect to backend. Please ensure your backend API is running and implements the /api/send-otp endpoint."
        );
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const otpToken = localStorage.getItem("otpToken");
      
      if (!sdkRef.current || !otpToken) {
        setError("Session expired. Please start over.");
        setStep("email");
        return;
      }

      // Verify OTP using Circle SDK
      // Note: The actual implementation depends on your backend setup
      // You may need to call verifyOtp method or execute a challenge
      
      // Placeholder for OTP verification
      // In a real implementation, you would:
      // 1. Verify OTP with your backend
      // 2. Get userToken and encryptionKey from backend
      // 3. Update SDK authentication
      // 4. Execute wallet creation challenge if needed

      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp, otpToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.userToken && data.encryptionKey) {
          // Update SDK with new credentials
          sdkRef.current.setAuthentication({
            userToken: data.userToken,
            encryptionKey: data.encryptionKey,
          });

          // If there's a challenge ID for wallet creation, execute it
          if (data.challengeId) {
            sdkRef.current.execute(data.challengeId, (error, result) => {
              if (error) {
                setError(`Error: ${error.message ?? "Error!"}`);
                setLoading(false);
                return;
              }
              // Success - wallet created/authenticated
              if (onSuccess) {
                onSuccess(result);
              }
            });
          } else {
            // No challenge needed, login successful
            if (onSuccess) {
              onSuccess({ userToken: data.userToken });
            }
          }
        } else {
          setError("Invalid OTP. Please try again.");
        }
      } else if (response.status === 404) {
        setError(
          "Backend API not found. Please implement /api/verify-otp endpoint. See Circle SDK documentation for details."
        );
      } else {
        setError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={handleEmailSubmit} style={{ width: "100%" }}>
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #ddd",
              fontSize: "1rem",
              marginBottom: "0.5rem",
            }}
          />
        </div>
        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: loading ? "#94a3b8" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease",
          }}
        >
          {loading ? "Sending..." : "Continue with Email"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleOtpSubmit} style={{ width: "100%" }}>
      <div style={{ marginBottom: "1rem" }}>
        <p style={{ marginBottom: "0.5rem", color: "#666", fontSize: "0.875rem" }}>
          Enter the verification code sent to {email}
        </p>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Enter 6-digit code"
          required
          maxLength={6}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            fontSize: "1rem",
            marginBottom: "0.5rem",
            textAlign: "center",
            letterSpacing: "0.5rem",
          }}
        />
      </div>
      {error && (
        <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setOtp("");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "0.75rem",
            backgroundColor: "transparent",
            color: "#2563eb",
            border: "1px solid #2563eb",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          style={{
            flex: 1,
            padding: "0.75rem",
            backgroundColor: loading || otp.length !== 6 ? "#94a3b8" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: "600",
            cursor: loading || otp.length !== 6 ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease",
          }}
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </form>
  );
};

export default EmailLogin;

