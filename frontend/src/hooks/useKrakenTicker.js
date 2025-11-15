import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to Kraken ticker for a given pair.
 * For now we use USDC/EUR as a liquid proxy and derive both directions.
 */
export default function useKrakenTicker() {
  const [status, setStatus] = useState("connecting");
  const [data, setData] = useState(null); // { bid, ask, mid, last, ts }
  const wsRef = useRef(null);

  useEffect(() => {
    const KRAKEN_URL = "wss://ws.kraken.com";
    let reconnectTimer;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(KRAKEN_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("live");
        ws.send(
          JSON.stringify({
            event: "subscribe",
            pair: ["USDC/EUR"], // liquid proxy
            subscription: { name: "ticker" },
          })
        );
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (!Array.isArray(msg)) {
          // subscription status etc
          return;
        }

        const [, payload, pair] = msg;
        if (pair !== "USDC/EUR") return;

        const bid = parseFloat(payload.b[0]);
        const ask = parseFloat(payload.a[0]);
        const last = parseFloat(payload.c[0]);
        if (!isFinite(bid) || !isFinite(ask) || !isFinite(last)) return;

        const mid = (bid + ask) / 2;

        setData({
          bid,
          ask,
          last,
          mid,
          ts: Date.now(),
        });
      };

      ws.onclose = () => {
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setStatus("disconnected");
        try {
          ws.close();
        } catch {}
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, []);

  return { status, data };
}