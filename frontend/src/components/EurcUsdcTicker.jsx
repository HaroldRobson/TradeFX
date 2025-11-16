import useKrakenTicker from "../hooks/useKrakenTicker";

export default function EurcUsdcTicker() {
  const { status, data } = useKrakenTicker();

  const dotColor =
    status === "live"
      ? "#22c55e"
      : status === "connecting"
      ? "#f97316"
      : "#ef4444";

  const fmt = (n) => Number(n).toFixed(4);

  return (
    <div
      style={{
        background: "#020617",
        borderRadius: "0.9rem",
        padding: "0.9rem 1.2rem",
        border: "1px solid #1e293b",
        minWidth: 220,
        color: "#e5e7eb",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: ".85rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.4rem",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 500 }}>USDC / EURC*</span>
        <span
          style={{
            fontSize: ".65rem",
            padding: "0.1rem .4rem",
            borderRadius: "999px",
            background: "#0f172a",
            border: "1px solid #1e293b",
            textTransform: "uppercase",
          }}
        >
          Kraken proxy
        </span>
      </div>

      {!data ? (
        <div style={{ color: "#9ca3af" }}>Connecting…</div>
      ) : (
        <>
          <Row label="Bid" value={fmt(data.bid)} />
          <Row label="Ask" value={fmt(data.ask)} />
          <Row label="Mid" value={fmt(data.mid)} />
          <Row label="Last" value={fmt(data.last)} />
        </>
      )}

      <div
        style={{
          marginTop: ".6rem",
          fontSize: ".75rem",
          color: "#6b7280",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "999px",
              marginRight: 4,
              background: dotColor,
              boxShadow: `0 0 8px ${dotColor}`,
            }}
          />
          {status === "live"
            ? "Live"
            : status === "connecting"
            ? "Connecting…"
            : "Disconnected"}
        </span>
        <span>{data ? new Date(data.ts).toLocaleTimeString() : "—"}</span>
      </div>
      <div
        style={{
          marginTop: ".35rem",
          fontSize: ".7rem",
          color: "#64748b",
          fontStyle: "italic",
        }}
      >
        * Using USDC/EUR as a live proxy
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        margin: ".15rem 0",
      }}
    >
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}