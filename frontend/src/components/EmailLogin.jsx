import { useEffect, useRef, useState } from "react";
// Circle SDK will be imported dynamically to avoid browser compatibility issues

const EmailLogin = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // 'email' or 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sdkRef = useRef(null);

  // SDK will be initialized lazily when user submits email form
  // This prevents SDK loading errors from breaking the app on initial load

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Initialize SDK if not already initialized
      if (!sdkRef.current) {
        const appId = import.meta.env.VITE_CIRCLE_APP_ID || "";
        const userToken = import.meta.env.VITE_CIRCLE_USER_TOKEN || "";
        const encryptionKey = import.meta.env.VITE_CIRCLE_ENCRYPTION_KEY || "";

        if (!appId || !userToken || !encryptionKey) {
          setError(
            "Circle SDK not configured. Please set up VITE_CIRCLE_APP_ID, VITE_CIRCLE_USER_TOKEN, and VITE_CIRCLE_ENCRYPTION_KEY environment variables."
          );
          setLoading(false);
          return;
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
          setError("Failed to initialize login system. Please try again later.");
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

