// src/hooks/useKrakenTicker.js
import { useEffect, useRef, useState } from "react";

/**
 * Kraken WS v1 ticker for USDC/EUR (used as proxy for USDC/EURC).
 * Status:
 * - "idle"
 * - "connecting"
 * - "connected"  (socket open, waiting for first price)
 * - "live"       (we have received at least one ticker)
 * - "disconnected"
 * - "error"
 */
export default function useKrakenTicker() {
    const [status, setStatus] = useState("idle");
    const [data, setData] = useState(null); // { bid, ask, last, mid, ts }
    const wsRef = useRef(null);
    const reconnectRef = useRef(null);
    const hasDataRef = useRef(false);

    useEffect(() => {
        const KRAKEN_URL = "wss://ws.kraken.com";

        const connect = () => {
            // avoid reconnect storm
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

            setStatus((prev) =>
                prev === "live" || prev === "connected" ? prev : "connecting"
            );
            hasDataRef.current = false;

            const ws = new WebSocket(KRAKEN_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("[Kraken] WS open");
                setStatus("connected"); // not "live" yet
                ws.send(
                    JSON.stringify({
                        event: "subscribe",
                        pair: ["USDC/EUR"], // wsname = USDC/EUR for USDCEUR market
                        subscription: { name: "ticker" },
                    })
                );
            };

            ws.onmessage = (event) => {
                let msg;
                try {
                    msg = JSON.parse(event.data);
                } catch (e) {
                    console.warn("[Kraken] JSON parse error", e);
                    return;
                }

                // Non-array: subscriptionStatus / heartbeat / errors
                if (!Array.isArray(msg)) {
                    if (msg.event === "subscriptionStatus") {
                        console.log("[Kraken] subscriptionStatus", msg);
                        if (msg.status === "error") {
                            console.error("[Kraken] subscription error:", msg.errorMessage);
                            setStatus("error");
                        }
                    } else if (msg.event === "heartbeat") {
                        // ok, ignore
                    } else if (msg.error) {
                        console.error("[Kraken] error message:", msg);
                        setStatus("error");
                    }
                    return;
                }

                // Array message: could be ticker or other channel.
                // Format: [channelId, payload, pairLabel]
                const [channelId, payload, pairLabel] = msg;

                // Defensive: only treat as ticker if it looks like ticker data
                const hasTickerShape =
                    payload &&
                    payload.c &&
                    Array.isArray(payload.c) &&
                    payload.c.length > 0 &&
                    payload.b &&
                    Array.isArray(payload.b) &&
                    payload.b.length > 0 &&
                    payload.a &&
                    Array.isArray(payload.a) &&
                    payload.a.length > 0;

                if (!hasTickerShape) {
                    // You can uncomment this to debug other array messages:
                    // console.log("[Kraken] non-ticker array msg", msg);
                    return;
                }

                // We subscribed to a single pair, so don't over-filter on pairLabel.
                // Just log it once so we can see what Kraken calls it.
                console.log("[Kraken] ticker msg for", pairLabel || "(no pairLabel)", {
                    channelId,
                    payload,
                });

                const bid = parseFloat(payload.b[0]);
                const ask = parseFloat(payload.a[0]);
                const last = parseFloat(payload.c[0]);
                if (!isFinite(bid) || !isFinite(ask) || !isFinite(last)) return;

                const mid = (bid + ask) / 2;

                hasDataRef.current = true;
                setStatus("live");
                setData({
                    bid,
                    ask,
                    last,
                    mid,
                    ts: Date.now(),
                });
            };

            ws.onerror = (err) => {
                console.error("[Kraken] WS error", err);
                setStatus("error");
                try {
                    ws.close();
                } catch (e) {
                    console.warn("[Kraken] error closing on error", e);
                }
            };

            ws.onclose = (event) => {
                console.warn(
                    "[Kraken] WS closed",
                    event.code,
                    event.reason || "(no reason)"
                );
                if (hasDataRef.current) {
                    setStatus("disconnected");
                } else {
                    setStatus("error");
                }

                reconnectRef.current = setTimeout(() => {
                    console.log("[Kraken] reconnecting…");
                    connect();
                }, 3000);
            };
        };

        connect();

        return () => {
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch (e) {
                    console.warn("[Kraken] error closing on unmount", e);
                }
            }
        };
    }, []);

    return { status, data };
}