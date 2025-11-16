import { useState } from "react";
import { useNavigate } from "react-router-dom";

function ExistingPositions({ positions }) {

  const navigate = useNavigate();

  return (
    <div
      className="positions-panel"
      style={{
        width: "100%",
        maxWidth: 720,
        background: "#0f172a",
        color: "#e5e7eb",
        borderRadius: "1rem",
        padding: "1rem 1.25rem",
        boxShadow: "0 18px 45px rgba(15,23,42,0.6)",
        margin: "0 auto",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.2rem", marginBottom: "0.75rem" }}>
        Open Positions
      </h2>

      {positions.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
          You have no open positions.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {positions.map((pos) => {
            const isLong = pos.side === "LONG";
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => navigate(`/positions/${pos.id}`)}
                style={{
                  textAlign: "left",
                  border: "1px solid rgba(148,163,184,0.4)",
                  borderRadius: "0.75rem",
                  padding: "0.6rem 0.7rem",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "999px",
                      background: isLong
                        ? "rgba(34,197,94,0.16)"
                        : "rgba(248,113,113,0.16)",
                      color: isLong ? "#4ade80" : "#fca5a5",
                      fontWeight: 600,
                    }}
                  >
                    {isLong ? "LONG" : "SHORT"}{" "}
                    {pos.pos_token || pos.start_token || "USDC"}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    {pos.pair === "USDC_EURC" ? "USDC / EURC" : "EURC / USDC"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "0.35rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <span>
                    Size:{" "}
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                      {pos.amount.toFixed(2)} {pos.pos_token || pos.start_token || "USDC"}
                    </strong>
                  </span>
                  <span>
                    Lev:{" "}
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                      {pos.leverage}x
                    </strong>
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "0.25rem",
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                  }}
                >
                  <span>
                    Entry:{" "}
                    <strong style={{ color: "#e5e7eb" }}>
                      {pos.entryPrice.toFixed(4)}
                    </strong>
                  </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "#64748b",
                    fontFamily: "monospace",
                  }}
                >
                  ID: {pos.id}
                </span>
                </div>
              {typeof pos.liquidation_barrier === "number" &&
                typeof pos.insolvency_barrier === "number" && (
                  <div
                    style={{
                      marginTop: "0.2rem",
                      fontSize: "0.75rem",
                      color: "#9ca3af",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Barriers:</span>
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Liq{" "}
                      <span style={{ color: "#f97316" }}>
                        {pos.liquidation_barrier.toFixed(2)}
                      </span>{" "}
                      / Insolv{" "}
                      <span style={{ color: "#ef4444" }}>
                        {pos.insolvency_barrier.toFixed(2)}
                      </span>{" "}
                      {pos.start_token || "USDC"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ExistingPositions;
