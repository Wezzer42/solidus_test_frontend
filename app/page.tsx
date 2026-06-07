"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther, isAddress, type Address } from "viem";
import { WalletBalances, ProtocolStats, StatusBanner } from "../components/market-ui";
import { SiteHeader } from "../components/site-header";
import { hasContracts } from "../lib/contracts";
import {
  fetchProtocolStats,
  formatProtocolAmount,
  type ProtocolStatsSnapshot,
} from "../lib/protocol-stats";
import {
  fetchWalletBalances,
  formatTokenAmount,
  type WalletBalanceSnapshot,
} from "../lib/wallet-balances";
import { WalletConnectButtons } from "../components/wallet-connect-buttons";
import { ensureBaseSepolia } from "../lib/ensure-base-sepolia";
import {
  bindWalletProvider,
  bootstrapWallet,
  connectInjectedWallet,
  connectWalletConnectWallet,
  disconnectActiveWallet,
  getWalletProvider,
  hasInjectedWallet,
  isWalletConnectConfigured,
  readWalletState,
  watchInjectedWallet,
} from "../lib/wallet";

export default function Home() {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [faucetHash, setFaucetHash] = useState<`0x${string}`>();
  const [targetAddress, setTargetAddress] = useState("");
  const [connectedAddress, setConnectedAddress] = useState<Address>();
  const [faucetRemaining, setFaucetRemaining] = useState<string>();
  const [walletBalances, setWalletBalances] = useState<WalletBalanceSnapshot>();
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [protocolStats, setProtocolStats] = useState<ProtocolStatsSnapshot>();
  const [loadingProtocolStats, setLoadingProtocolStats] = useState(false);
  const [hasInjected, setHasInjected] = useState(false);
  const walletConnectEnabled = isWalletConnectConfigured();
  const contractsReady = hasContracts();

  const watchedAddress = (() => {
    const typed = targetAddress.trim();
    if (isAddress(typed)) return typed as Address;
    return connectedAddress;
  })();

  const loadWalletBalances = useCallback(async (address: Address) => {
    if (!contractsReady) return;
    setLoadingBalances(true);
    try {
      const snapshot = await fetchWalletBalances(address);
      setWalletBalances(snapshot ?? undefined);
    } catch {
      setWalletBalances(undefined);
    } finally {
      setLoadingBalances(false);
    }
  }, [contractsReady]);

  const loadProtocolStats = useCallback(async () => {
    if (!contractsReady) return;
    setLoadingProtocolStats(true);
    try {
      const snapshot = await fetchProtocolStats();
      setProtocolStats(snapshot ?? undefined);
    } catch {
      setProtocolStats(undefined);
    } finally {
      setLoadingProtocolStats(false);
    }
  }, [contractsReady]);

  async function loadFaucetStatus() {
    try {
      const response = await fetch("/api/faucet");
      const body = (await response.json()) as { remaining?: string };
      if (!response.ok || !body.remaining) return;
      const formatted = Number(formatEther(BigInt(body.remaining))).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
      setFaucetRemaining(formatted);
    } catch {
      // keep UI silent if faucet status request fails
    }
  }

  useEffect(() => {
    void loadFaucetStatus();
    void loadProtocolStats();
  }, [loadProtocolStats]);

  useEffect(() => {
    if (!watchedAddress) {
      setWalletBalances(undefined);
      return;
    }

    const timer = setTimeout(() => {
      void loadWalletBalances(watchedAddress);
    }, 400);

    return () => clearTimeout(timer);
  }, [watchedAddress, loadWalletBalances]);

  useEffect(() => watchInjectedWallet(setHasInjected), []);

  useEffect(() => {
    let unbind: (() => void) | undefined;
    let disposed = false;

    async function bootstrap() {
      const result = await bootstrapWallet();
      if (disposed) return;

      setHasInjected(hasInjectedWallet());
      if (!result.session) return;

      unbind = bindWalletProvider(result.session.provider, {
        onAccountsChanged: (accounts) => {
          const next = accounts[0] as Address | undefined;
          setConnectedAddress(next);
          if (!next && !targetAddress.trim()) setWalletBalances(undefined);
        },
        onChainChanged: () => undefined,
      });

      const state = await readWalletState(result.session.provider);
      if (disposed || !state.account) return;
      setConnectedAddress(state.account);
    }

    void bootstrap();
    return () => {
      disposed = true;
      unbind?.();
    };
  }, []);

  async function connectInjected() {
    setPending(true);
    setStatus("");
    try {
      const provider = await connectInjectedWallet();
      await ensureBaseSepolia(provider);
      const state = await readWalletState(provider);
      setConnectedAddress(state.account);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connect failed.");
    } finally {
      setPending(false);
    }
  }

  async function connectWalletConnect() {
    setPending(true);
    setStatus("");
    try {
      const provider = await connectWalletConnectWallet();
      await ensureBaseSepolia(provider);
      const state = await readWalletState(provider);
      setConnectedAddress(state.account);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "WalletConnect failed.");
    } finally {
      setPending(false);
    }
  }

  async function disconnectWallet() {
    await disconnectActiveWallet();
    setConnectedAddress(undefined);
    if (!targetAddress.trim()) setWalletBalances(undefined);
  }

  async function getFlow() {
    if (!contractsReady) return setStatus("App is missing contract addresses.");

    setPending(true);
    setFaucetHash(undefined);
    setStatus("Getting test FLOW...");
    try {
      let account: Address;
      const typed = targetAddress.trim();
      if (typed) {
        if (!isAddress(typed)) throw new Error("Invalid wallet address.");
        account = typed;
      } else if (connectedAddress && getWalletProvider()) {
        const provider = getWalletProvider();
        if (!provider) throw new Error("Connect MetaMask or WalletConnect first, or paste your wallet address.");
        account = connectedAddress;
        await ensureBaseSepolia(provider);
      } else {
        throw new Error("Connect MetaMask or WalletConnect first, or paste your wallet address.");
      }

      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account }),
      });
      const body = (await response.json()) as { hash?: `0x${string}`; error?: string };
      if (!response.ok || !body.hash) throw new Error(body.error || "Faucet failed.");

      setFaucetHash(body.hash);
      setStatus("Test FLOW sent.");
      await loadFaucetStatus();
      await loadWalletBalances(account);
      await loadProtocolStats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not get FLOW.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7ff] text-[#0b1736]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
        <SiteHeader />

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 py-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0052ff]">Base Sepolia testnet</p>
            <h1 className="mt-4 font-display text-5xl font-black leading-[0.95] tracking-[-0.08em] sm:text-6xl">
              Mine the economy, not the hardware.
            </h1>
            <p className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#335aa8]">Use FLOW. Earn PRIME.</p>
          </div>

          <ProtocolStats
            activeFlow={protocolStats ? formatProtocolAmount(protocolStats.activeFlow, "FLOW") : undefined}
            reserveFlow={protocolStats ? formatProtocolAmount(protocolStats.reserveFlow, "FLOW") : undefined}
            primeSupply={protocolStats ? formatProtocolAmount(protocolStats.primeSupply, "PRIME") : undefined}
            primeCap={protocolStats ? formatProtocolAmount(protocolStats.primeCap, "PRIME", 0) : undefined}
            activeRatioBps={
              protocolStats
                ? `${(Number(protocolStats.activeRatioBps) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}% active FLOW`
                : undefined
            }
            loading={loadingProtocolStats}
            onRefresh={loadProtocolStats}
          />

          <section className="rounded-2xl bg-[#eaf0ff] p-5">
            <h2 className="font-display text-3xl font-black tracking-[-0.06em]">Get test FLOW</h2>
            <p className="mt-2 text-sm leading-6 text-[#3a589b]">
              Faucet is available once per 24 hours. Fee-free, no-PRIME distributions activate after the next protocol redeploy.
            </p>
            <p className="mt-1 text-sm font-semibold text-[#35549a]">
              Available to distribute: {faucetRemaining ? `${faucetRemaining} FLOW` : "Loading..."}
            </p>
            <label className="mt-4 block text-sm font-semibold text-[#35549a]">
              Address (0x...)
              <input
                className="mt-2 w-full rounded-xl border border-[#cddcff] bg-white px-4 py-3 text-[#0b1736] outline-none transition placeholder:text-[#84a0da] focus:border-[#0052ff]"
                placeholder="Leave empty to use connected wallet"
                value={targetAddress}
                onChange={(event) => setTargetAddress(event.target.value)}
              />
            </label>
            {!targetAddress.trim() && !connectedAddress ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <WalletConnectButtons
                  pending={pending}
                  hasInjectedWallet={hasInjected}
                  walletConnectEnabled={walletConnectEnabled}
                  onConnectInjected={connectInjected}
                  onConnectWalletConnect={connectWalletConnect}
                />
              </div>
            ) : null}
            <button className="btn-primary mt-4 w-full sm:w-auto" disabled={pending} onClick={getFlow}>
              Get FLOW
            </button>
          </section>

          {watchedAddress ? (
            <WalletBalances
              account={watchedAddress}
              flow={walletBalances ? formatTokenAmount(walletBalances.flow, "FLOW") : undefined}
              prime={walletBalances ? formatTokenAmount(walletBalances.prime, "PRIME") : undefined}
              eth={walletBalances ? formatTokenAmount(walletBalances.eth, "ETH", 5) : undefined}
              loading={loadingBalances}
              onRefresh={() => loadWalletBalances(watchedAddress)}
              onDisconnect={connectedAddress && watchedAddress === connectedAddress ? disconnectWallet : undefined}
            />
          ) : null}

          <section className="rounded-2xl border border-[#dce7ff] bg-white p-5">
            <p className="text-sm font-semibold text-[#35549a]">
              Full testing (wallet, transfers, PRIME market, test swaps) is available in{" "}
              <a className="text-[#0052ff] underline" href="/market">
                Market
              </a>
              .
            </p>
          </section>

        </div>
      </div>
      {status ? (
        <StatusBanner
          message={status}
          txHash={faucetHash}
          onClose={() => {
            setStatus("");
            setFaucetHash(undefined);
          }}
        />
      ) : null}
    </main>
  );
}
