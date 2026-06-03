"use client";

import { useCallback, useEffect, useState } from "react";
import { baseSepolia } from "viem/chains";
import { formatEther, isAddress, type Address } from "viem";
import { WalletBalances, ProtocolStats } from "../components/market-ui";
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
import { ethereum, revokeWalletAccess } from "../lib/wallet";

const baseScan = "https://sepolia.basescan.org";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

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

  useEffect(() => {
    const provider = ethereum();
    if (!provider) return;

    const onAccountsChanged = (accounts: unknown) => {
      const next = (accounts as Address[])[0];
      setConnectedAddress(next);
      if (!next && !targetAddress.trim()) setWalletBalances(undefined);
    };

    provider.request({ method: "eth_accounts" }).then((accounts) => {
      const next = (accounts as Address[])[0];
      if (next) setConnectedAddress(next);
    });

    const eth = provider as EthereumProvider;
    eth.on?.("accountsChanged", onAccountsChanged);
    return () => eth.removeListener?.("accountsChanged", onAccountsChanged);
  }, [targetAddress]);

  function disconnectWallet() {
    const provider = ethereum();
    if (provider) void revokeWalletAccess(provider);
    setConnectedAddress(undefined);
    if (!targetAddress.trim()) setWalletBalances(undefined);
  }

  async function ensureBaseSepolia(provider: EthereumProvider) {
    const chainIdHex = `0x${baseSepolia.id.toString(16)}`;
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC?.trim() || "https://sepolia.base.org";
    const currentChain = (await provider.request({ method: "eth_chainId" })) as string;
    if (Number(currentChain) === baseSepolia.id) return;

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: baseSepolia.name,
            nativeCurrency: baseSepolia.nativeCurrency,
            rpcUrls: [rpcUrl],
            blockExplorerUrls: [baseSepolia.blockExplorers?.default.url],
          },
        ],
      });
    }
  }

  async function getFlow() {
    if (!contractsReady) return setStatus("App is missing contract addresses.");
    const provider = ethereum();
    if (!provider) return setStatus("Install MetaMask or another browser wallet.");

    setPending(true);
    setFaucetHash(undefined);
    setStatus("Getting test FLOW...");
    try {
      let account: Address;
      const typed = targetAddress.trim();
      if (typed) {
        if (!isAddress(typed)) throw new Error("Invalid wallet address.");
        account = typed;
      } else {
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
        account = accounts[0];
        if (!account) throw new Error("Wallet address not found.");
        setConnectedAddress(account);
      }
      await ensureBaseSepolia(provider);

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
              Faucet is available once per 24 hours for each wallet.
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

          {(status || faucetHash) && (
            <section className="rounded-2xl border border-[#dce7ff] bg-white p-4 text-sm font-semibold text-[#35549a]">
              <p>{status}</p>
              {faucetHash && (
                <a className="mt-2 block break-all text-sm font-semibold text-[#0052ff]" href={`${baseScan}/tx/${faucetHash}`} target="_blank">
                  {faucetHash}
                </a>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
