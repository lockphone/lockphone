"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio, RefreshCw, Trophy } from "lucide-react";
import { Avatar } from "./avatar";
import { demoSnapshot } from "@/lib/demo-data";
import type { PublicLeader, PublicSnapshot } from "@/lib/types";

type Copy = {
  sales: string;
  estimated: string;
  sold: string;
  updated: string;
  ranking: string;
  live: string;
  stale: string;
  empty: string;
};

function elapsed(leader: PublicLeader, now: number) {
  if (!leader.activeStartedAt) return leader.creditedSeconds;
  const active = Math.max(0, Math.min(86_400, (now - Date.parse(leader.activeStartedAt)) / 1000));
  return leader.creditedSeconds + Math.floor(active);
}

function duration(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function websocketURL(apiURL: string) {
  const url = new URL("/v1/live", apiURL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function LiveDashboard({ copy }: { copy: Copy }) {
  const [snapshot, setSnapshot] = useState<PublicSnapshot>(demoSnapshot);
  const [now, setNow] = useState(() => Date.parse(demoSnapshot.asOf));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const apiURL = process.env.NEXT_PUBLIC_API_URL;
    if (!apiURL) return () => window.clearInterval(timer);

    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempt = 0;

    const connect = async () => {
      try {
        const response = await fetch(`${apiURL}/v1/public/snapshot`, { cache: "no-store" });
        if (response.ok) setSnapshot(await response.json());
      } catch {
        // Keep the last good snapshot while the real-time connection recovers.
      }
      if (stopped) return;
      socket = new WebSocket(websocketURL(apiURL));
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type: string; data?: PublicSnapshot };
          if (message.type === "snapshot" && message.data) setSnapshot(message.data);
        } catch {
          // Ignore malformed frames; the next full snapshot repairs state.
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) {
          retry = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempt++));
        }
      };
      socket.onerror = () => socket?.close();
    };

    void connect();
    return () => {
      stopped = true;
      socket?.close();
      if (retry) clearTimeout(retry);
      window.clearInterval(timer);
    };
  }, []);

  const leaders = useMemo(
    () => [...snapshot.leaderboard].sort((a, b) => elapsed(b, now) - elapsed(a, now)),
    [snapshot, now],
  );
  const formatter = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
  const updated = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.asOf));

  return (
    <section className="live-grid" id="live" aria-label={copy.ranking}>
      <article className="sales-panel panel">
        <div className="panel-eyebrow"><Radio size={15} /> {copy.sales}</div>
        <div className="sales-number">{formatter.format(snapshot.sales.grossCnyEstimate)}</div>
        <div className="sales-meta">
          <span>{copy.estimated}</span>
          <span>{snapshot.sales.paidUnits.toLocaleString()} {copy.sold}</span>
        </div>
        <div className="update-line"><RefreshCw size={13} /> {copy.updated} {updated}</div>
        <div className="pulse-orbit" aria-hidden="true"><i /><i /><i /></div>
      </article>

      <article className="ranking-panel panel">
        <header className="ranking-header">
          <div>
            <div className="panel-eyebrow"><Trophy size={15} /> {copy.ranking}</div>
            <p>{leaders.length ? `${leaders.length} focus records` : copy.empty}</p>
          </div>
          <span className={`connection ${connected ? "online" : ""}`}>
            <i /> {connected ? copy.live : copy.stale}
          </span>
        </header>
        <ol className="leader-list">
          {leaders.map((leader, index) => (
            <li key={leader.userId} className={index < 3 ? `leader top-${index + 1}` : "leader"}>
              <span className="rank">{String(index + 1).padStart(2, "0")}</span>
              <Avatar id={leader.avatarId} label={leader.nickname} />
              <span className="identity">
                <strong>{leader.nickname}</strong>
                <small>{leader.maskedEmail}</small>
              </span>
              <span className="time">{duration(elapsed(leader, now))}</span>
              {leader.activeStartedAt && <span className="active-dot" title={copy.live} />}
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}
