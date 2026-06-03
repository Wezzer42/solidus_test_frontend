import Link from "next/link";
import type { ReactNode } from "react";
import { formatEther } from "viem";
import { SolidusLogo } from "./solidus-logo";

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/";
const discordUrl = "https://discord.gg/x5mWWZH4";
const baseScan = "https://sepolia.basescan.org";

export function MarketHeader({
  account,
  pending,
  onConnect,
  onDisconnect,
}: {
  account?: string;
  pending: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d6e2ff] pb-4">
      <div>
        <SolidusLogo />
        <p className="mt-1 text-sm font-semibold text-[#496ab3]">Market · Base Sepolia</p>
      </div>
      <nav className="hidden items-center gap-5 text-sm font-medium text-[#3f5ea8] lg:flex">
        <Link href="/">Home</Link>
        <span className="font-bold text-[#0052ff]">Market</span>
        <Link href="/whitepaper">Whitepaper</Link>
        <a href={githubUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={discordUrl} target="_blank" rel="noreferrer">
          Discord
        </a>
        <a href={baseScan} target="_blank" rel="noreferrer">
          BaseScan
        </a>
      </nav>
      <div className="flex shrink-0 flex-wrap gap-2">
        {account ? (
          <>
            <span className="btn-secondary cursor-default px-4 py-3 font-mono text-sm">{account}</span>
            <button className="btn-secondary" type="button" disabled={pending} onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <button className="btn-primary" type="button" disabled={pending} onClick={onConnect}>
            Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}

export function MarketTabs({
  active,
  onChange,
}: {
  active: "transfer" | "prime" | "exchange";
  onChange: (tab: "transfer" | "prime" | "exchange") => void;
}) {
  const tabs = [
    { id: "transfer" as const, label: "Send FLOW" },
    { id: "prime" as const, label: "PRIME market" },
    { id: "exchange" as const, label: "FLOW exchange" },
  ];

  return (
    <div className="flex gap-1 rounded-full bg-[#eaf0ff] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-btn ${active === tab.id ? "tab-btn-active" : "tab-btn-idle"}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ProtocolStats({
  activeFlow,
  reserveFlow,
  primeSupply,
  primeCap,
  activeRatioBps,
  loading,
  onRefresh,
}: {
  activeFlow?: string;
  reserveFlow?: string;
  primeSupply?: string;
  primeCap?: string;
  activeRatioBps?: string;
  loading: boolean;
  onRefresh?: () => void;
}) {
  const items = [
    { label: "Active FLOW", value: activeFlow, accent: "text-[#0052ff]", hint: "In circulation" },
    { label: "Reserve FLOW", value: reserveFlow, accent: "text-[#335aa8]", hint: "Held by protocol" },
    { label: "PRIME supply", value: primeSupply, accent: "text-[#c46a00]", hint: primeCap ? `Cap ${primeCap}` : "Total minted" },
  ];

  return (
    <section className="rounded-2xl border border-[#dce7ff] bg-[#eaf0ff] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0052ff]">Protocol</p>
          <p className="mt-1 font-display text-lg font-black tracking-[-0.05em] text-[#0b1736]">
            On-chain supply
          </p>
          {activeRatioBps ? (
            <p className="mt-1 text-xs font-semibold text-[#496ab3]">
              Active ratio: {activeRatioBps}
            </p>
          ) : null}
        </div>
        {onRefresh ? (
          <button className="btn-secondary px-4 py-2 text-sm" type="button" disabled={loading} onClick={onRefresh}>
            {loading ? "Updating…" : "Refresh"}
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-[#dce7ff] bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6280c3]">{item.label}</p>
            <p className={`mt-1 font-display text-xl font-black tracking-[-0.04em] ${item.accent}`}>
              {loading ? "…" : item.value ?? "—"}
            </p>
            <p className="mt-1 text-xs text-[#84a0da]">{item.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WalletBalances({
  account,
  flow,
  prime,
  eth,
  loading,
  onRefresh,
  onDisconnect,
}: {
  account: string;
  flow?: string;
  prime?: string;
  eth?: string;
  loading: boolean;
  onRefresh?: () => void;
  onDisconnect?: () => void;
}) {
  const items = [
    { label: "FLOW", value: flow, accent: "text-[#0052ff]", hint: "Liquid settlement token" },
    { label: "PRIME", value: prime, accent: "text-[#c46a00]", hint: "Reserve-power token" },
    { label: "ETH", value: eth, accent: "text-[#335aa8]", hint: "Gas on Base Sepolia" },
  ];

  return (
    <section className="rounded-2xl border border-[#dce7ff] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6280c3]">Your wallet</p>
          <a
            className="mt-1 block font-mono text-sm font-semibold text-[#0052ff] hover:underline"
            href={`${baseScan}/address/${account}`}
            target="_blank"
            rel="noreferrer"
          >
            {account.slice(0, 6)}…{account.slice(-4)}
          </a>
          <p className="mt-1 text-xs font-semibold text-[#496ab3]">Base Sepolia · connected balances</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <button className="btn-secondary px-4 py-2 text-sm" type="button" disabled={loading} onClick={onRefresh}>
              {loading ? "Updating…" : "Refresh"}
            </button>
          ) : null}
          {onDisconnect ? (
            <button className="btn-secondary px-4 py-2 text-sm" type="button" onClick={onDisconnect}>
              Disconnect
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-[#eaf0ff] bg-[#f9fbff] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6280c3]">{item.label}</p>
            <p className={`mt-1 font-display text-xl font-black tracking-[-0.04em] ${item.accent}`}>
              {loading ? "…" : item.value ?? "—"}
            </p>
            <p className="mt-1 text-xs text-[#84a0da]">{item.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AvailableAmount({
  label,
  amount,
  onUseMax,
}: {
  label: string;
  amount?: bigint;
  onUseMax?: () => void;
}) {
  if (amount === undefined) return null;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6280c3]">
      <span>
        Available: {label}{" "}
        {Number(formatEther(amount)).toLocaleString("en-US", { maximumFractionDigits: 4 })}
      </span>
      {onUseMax ? (
        <button type="button" className="text-[#0052ff] underline" onClick={onUseMax}>
          Use max
        </button>
      ) : null}
    </p>
  );
}

export function TestExchangeWarning() {
  return (
    <p className="rounded-xl border border-[#ffd6a8] bg-[#fff4d8] px-4 py-3 text-sm font-semibold leading-6 text-[#805b00]">
      Use only test tokens. Unknown token behavior is not guaranteed.
    </p>
  );
}

export function TokenCheckCard({
  status,
  symbol,
  decimals,
  balance,
  detail,
  tone = "neutral",
}: {
  status: string;
  symbol?: string;
  decimals?: number;
  balance?: string;
  detail?: string;
  tone?: "neutral" | "ok" | "warn" | "error";
}) {
  const toneClass =
    tone === "ok"
      ? "border-[#b8efd8] bg-[#f4fffa]"
      : tone === "warn"
        ? "border-[#ffd6a8] bg-[#fff4d8]"
        : tone === "error"
          ? "border-[#ffc9c9] bg-[#fff5f5]"
          : "border-[#dce7ff] bg-[#f9fbff]";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6280c3]">Token check</p>
      <p className="mt-1 font-semibold text-[#0b1736]">{status}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Symbol</dt>
          <dd className="mt-0.5 font-semibold text-[#335aa8]">{symbol ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Decimals</dt>
          <dd className="mt-0.5 font-semibold text-[#335aa8]">{decimals !== undefined ? decimals : "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Your balance</dt>
          <dd className="mt-0.5 font-semibold text-[#335aa8]">
            {balance !== undefined ? `${balance}${symbol ? ` ${symbol}` : ""}` : accountBalancePlaceholder()}
          </dd>
        </div>
      </dl>
      {detail ? <p className="mt-3 text-xs leading-5 text-[#6280c3]">{detail}</p> : null}
    </div>
  );
}

function accountBalancePlaceholder() {
  return "Connect wallet to view balance";
}

export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-black tracking-[-0.06em]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-[#496ab3]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EmptyOrders({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#bcd0ff] bg-[#f9fbff] px-6 py-12 text-center">
      <p className="font-display text-lg font-black text-[#0b1736]">No open orders</p>
      <p className="mt-2 text-sm text-[#496ab3]">{message}</p>
    </div>
  );
}

export function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        ready ? "bg-[#e6fff4] text-[#0a7a4b]" : "bg-[#f0f0f0] text-[#666]"
      }`}
    >
      {ready ? "Ready" : "Stale"}
    </span>
  );
}

export function StatusBanner({
  message,
  txHash,
}: {
  message: string;
  txHash?: `0x${string}`;
}) {
  return (
    <section className="panel border-[#0052ff] bg-[#0052ff] text-white">
      <p className="text-sm font-semibold">{message}</p>
      {txHash ? (
        <a
          className="mt-2 block break-all text-sm text-[#dce7ff] underline"
          href={`${baseScan}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View on BaseScan →
        </a>
      ) : null}
    </section>
  );
}
