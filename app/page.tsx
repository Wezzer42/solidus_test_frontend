"use client";

import { useEffect, useState } from "react";
import { baseSepolia } from "viem/chains";
import { formatEther, isAddress, type Address } from "viem";
import { SolidusLogo } from "../components/solidus-logo";
import { hasContracts } from "../lib/contracts";

const baseScan = "https://sepolia.basescan.org";
const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function ethereum() {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
}

export default function Home() {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [faucetHash, setFaucetHash] = useState<`0x${string}`>();
  const [targetAddress, setTargetAddress] = useState("");
  const [faucetRemaining, setFaucetRemaining] = useState<string>();
  const contractsReady = hasContracts();

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
  }, []);

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
      let account = targetAddress.trim();
      if (account) {
        if (!isAddress(account)) throw new Error("Invalid wallet address.");
      } else {
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
        account = accounts[0];
        if (!account) throw new Error("Wallet address not found.");
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not get FLOW.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7ff] text-[#0b1736]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
        <header className="flex items-center justify-between border-b border-[#d6e2ff] pb-4">
          <SolidusLogo />
          <nav className="hidden items-center gap-5 text-sm font-medium text-[#3f5ea8] sm:flex">
            <a href="/market">Market</a>
            <a href="/whitepaper">Whitepaper</a>
            <a href={githubUrl} target="_blank">GitHub</a>
            <a href={baseScan} target="_blank">BaseScan</a>
          </nav>
        </header>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 py-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0052ff]">Base Sepolia testnet</p>
            <h1 className="mt-4 font-display text-5xl font-black leading-[0.95] tracking-[-0.08em] sm:text-6xl">
              Mine the economy, not the hardware.
            </h1>
            <p className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#335aa8]">Use FLOW. Earn PRIME.</p>
          </div>

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
