import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ExchangeChart from "./ExchangeChart";
import useKrakenTicker from "../hooks/useKrakenTicker";

// Placeholder for on-chain closePosition(position_id, FakeRate).
// Later you can replace the body with an actual contract call.
async function closePosition(positionId, fakeRate) {
  console.log("closePosition called (stub):", {
    positionId,
    fakeRate,
  });
}

function PositionDetail({ positions, onClose }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: ticker, status } = useKrakenTicker();
  const [startPositionValue, setStartPositionValue] = useState(null);

  const position = positions.find((p) => p.id === id) || null;

  const markPrice = useMemo(() => {
    if (!ticker || !position) return null;
    if (position.pair === "USDC_EURC") {
      return ticker.mid;
    }
    return 1 / ticker.mid;
  }, [ticker, position]);

  // Treat position.amount as pos_token_amount.
  // Position value in start_token = pos_token_amount * live exchange rate.
  const positionValue = useMemo(() => {
    if (!position || !markPrice) return null;
    return position.amount * markPrice;
  }, [position, markPrice]);

  const statusLabel = (() => {
    if (status === "live") return "Live via Kraken";
    if (status === "connecting" || status === "idle") return "Connecting…";
    if (status === "disconnected") return "Reconnecting…";
    if (status === "error") return "Error connecting to Kraken";
    return status;
  })();

  const handleClosePosition = async () => {
    if (!position || !ticker) return;

    // On-chain FakeRate is expressed in USDC units with 6 decimals,
    // and always represents "how many USDC per 1 EURC", independent of position side.
    const rawRate = ticker.mid; // USDC / EUR (≈ USDC / EURC)
    const fakeRate = Math.floor(rawRate * 1_000_000); // scale to 6 decimals

    await closePosition(position.id, fakeRate);

    console.log("Closing position from detail page:", {
      ...position,
      closePrice: markPrice,
      fakeRate,
      wsStatus: status,
    });

    if (onClose) {
      onClose(position.id);
    }
    // Go back to the positions list.
    navigate("/");
  };

  if (!position) {
    return (
      <div
        style={{
          padding: "2rem",
          color: "#e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h2>Position not found</h2>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: "999px",
            border: "none",
            background: "#4b5563",
            color: "#f9fafb",
            cursor: "pointer",
          }}
        >
          Back to Positions
        </button>
      </div>
    );
  }

  const isLong = position.side === "LONG";

  return (
    <div
      className="position-detail"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              marginBottom: "0.5rem",
              padding: "0.3rem 0.9rem",
              borderRadius: "999px",
              border: "none",
              background: "#4b5563",
              color: "#f9fafb",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            ← Back to positions
          </button>
          <h2 style={{ margin: 0, color: "#0f172a" }}>
            {isLong ? "Long" : "Short"} {position.amount}{" "}
            {position.pos_token || position.start_token || "USDC"} on{" "}
            {position.pair === "USDC_EURC" ? "USDC / EURC" : "EURC / USDC"}
          </h2>
          <p style={{ margin: "0.25rem 0", color: "#0f172a", fontSize: "0.85rem" }}>
            Opened at {new Date(position.openedAt).toLocaleString()}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#0f172a",
              marginBottom: "0.25rem",
            }}
          >
            Position ID
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              color: "#0f172a",
              fontFamily: "monospace",
            }}
          >
            {position.id}
          </div>
          <div
            style={{
              marginTop: "0.25rem",
              fontSize: "0.75rem",
              color: "#0f172a",
            }}
          >
            Start token: {position.start_token || "USDC"}
          </div>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.75rem",
              color: "#0f172a",
            }}
          >
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Live position value using Kraken websocket price */}
      <div
        style={{
          marginTop: "0.5rem",
          padding: "1rem 1.25rem",
          borderRadius: "0.75rem",
          background: "#0f172a",
          color: "#e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              marginBottom: "0.25rem",
            }}
          >
            Position value
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {positionValue != null ? positionValue.toFixed(2) : "--"}{" "}
            {position.start_token || "USDC"}
          </div>
          <div
            style={{
              marginTop: "0.35rem",
              fontSize: "0.75rem",
              color: "#9ca3af",
            }}
          >
            Uses live exchange rate from Kraken WebSocket.
          </div>
          <div
            style={{
              marginTop: "0.25rem",
              fontSize: "0.75rem",
              color: "#9ca3af",
            }}
          >
            Start value:{" "}
            <span style={{ color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>
              {startPositionValue != null ? startPositionValue.toFixed(2) : "--"}{" "}
              {position.start_token || "USDC"}
            </span>
          </div>
        </div>
      </div>

      {/* Full live chart, but showing position value over time */}
      <div style={{ marginTop: "1rem" }}>
        <ExchangeChart
          compact={false}
          mode="position"
          positionAmount={position.amount}
          positionLabel="Position value"
          startTimestamp={Math.floor(new Date(position.openedAt).getTime() / 1000)}
          onInitialValue={setStartPositionValue}
        />
      </div>

      {/* Close button pinned toward bottom */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "1rem",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={handleClosePosition}
          style={{
            padding: "0.75rem 1.6rem",
            borderRadius: "999px",
            border: "none",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            background: "#ef4444",
            color: "#fff",
            boxShadow: "0 15px 35px rgba(239,68,68,0.35)",
          }}
        >
          Close Position
        </button>
      </div>
    </div>
  );
}

export default PositionDetail;


