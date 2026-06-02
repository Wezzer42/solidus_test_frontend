"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  isAddress,
  parseEther,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { addresses, flowAbi, hasContracts, marketAbi, reserveAbi } from "../../lib/contracts";

type MarketOrderRow = {
  id: bigint;
  seller: Address;
  primeAmount: bigint;
  flowPrice: bigint;
  floorFlow: bigint;
  executable: boolean;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const baseScan = "https://sepolia.basescan.org";

function ethereum() {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
}

function publicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC),
  });
}

function walletClient(account: Address) {
  const provider = ethereum();
  if (!provider) throw new Error("Wallet not found.");
  return createWalletClient({ account, chain: baseSepolia, transport: custom(provider) });
}

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmt(value: bigint, digits = 4) {
  return Number(formatEther(value)).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default function MarketPage() {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [orders, setOrders] = useState<MarketOrderRow[]>([]);
  const [recipient, setRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState("1000");
  const [primeAmount, setPrimeAmount] = useState("100");
  const [flowPrice, setFlowPrice] = useState("400");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}`>();

  const wrongNetwork = Boolean(account && chainId !== baseSepolia.id);
  const contractsReady = hasContracts();

  const loadOrders = useCallback(async () => {
    if (!contractsReady) return;

    const client = publicClient();
    const nextId = await client.readContract({
      address: addresses.market,
      abi: marketAbi,
      functionName: "nextOrderId",
    });
    const from = nextId > 50n ? nextId - 50n : 1n;
    const ids = Array.from({ length: Number(nextId - from) }, (_, index) => from + BigInt(index));
    const loaded = await Promise.all(
      ids.map(async (id) => {
        const [seller, primeAmount, flowPrice, active] = await client.readContract({
          address: addresses.market,
          abi: marketAbi,
          functionName: "orders",
          args: [id],
        });
        if (!active || primeAmount === 0n || flowPrice === 0n) return undefined;
        const floorFlow = await client.readContract({
          address: addresses.reserve,
          abi: reserveAbi,
          functionName: "quoteRedeemFloor",
          args: [primeAmount],
        });
        return {
          id,
          seller,
          primeAmount,
          flowPrice,
          floorFlow,
          executable: flowPrice >= floorFlow,
        };
      }),
    );
    setOrders(loaded.filter((order): order is MarketOrderRow => Boolean(order)).reverse());
  }, [contractsReady]);

  useEffect(() => {
    loadOrders().catch((e) => setStatus(e instanceof Error ? e.message : "Load failed."));
  }, [loadOrders]);

  async function connect() {
    const provider = ethereum();
    if (!provider) return setStatus("Install MetaMask.");
    setPending(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      const hexChain = (await provider.request({ method: "eth_chainId" })) as string;
      setAccount(accounts[0]);
      setChainId(Number(hexChain));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Connect failed.");
    } finally {
      setPending(false);
    }
  }

  async function switchNetwork() {
    const provider = ethereum();
    if (!provider) return;
    const chainIdHex = `0x${baseSepolia.id.toString(16)}`;
    const rpc = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC?.trim() || "https://sepolia.base.org";
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: baseSepolia.name,
            nativeCurrency: baseSepolia.nativeCurrency,
            rpcUrls: [rpc],
            blockExplorerUrls: [baseSepolia.blockExplorers?.default.url],
          },
        ],
      });
    }
    setChainId(baseSepolia.id);
  }

  async function sendFlow() {
    if (!account) return setStatus("Connect wallet.");
    if (!isAddress(recipient)) return setStatus("Enter valid recipient address.");
    if (!contractsReady) return setStatus("Contracts not configured.");

    setPending(true);
    try {
      const client = publicClient();
      const amount = parseEther(transferAmount || "0");
      const flowBalance = await client.readContract({
        address: addresses.flow,
        abi: flowAbi,
        functionName: "balanceOf",
        args: [account],
      });
      if (flowBalance < amount) {
        setStatus(
          `Insufficient FLOW balance. Need ${fmt(amount)} FLOW, available ${fmt(flowBalance)} FLOW.`,
        );
        return;
      }

      const [ethBalance, gasPrice, gasEstimate] = await Promise.all([
        client.getBalance({ address: account }),
        client.getGasPrice(),
        client.estimateContractGas({
          account,
          address: addresses.flow,
          abi: flowAbi,
          functionName: "transfer",
          args: [recipient as Address, amount],
        }),
      ]);
      const gasCost = gasPrice * gasEstimate;
      if (ethBalance < gasCost) {
        setStatus(
          `Insufficient ETH for network fee. Need about ${fmt(gasCost, 6)} ETH, available ${fmt(ethBalance, 6)} ETH.`,
        );
        return;
      }

      const hash = await walletClient(account).writeContract({
        address: addresses.flow,
        abi: flowAbi,
        functionName: "transfer",
        args: [recipient as Address, amount],
      });
      setTxHash(hash);
      setStatus("FLOW transferred.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setPending(false);
    }
  }

  async function listOrder() {
    if (!account) return setStatus("Connect wallet.");
    if (!contractsReady) return setStatus("Contracts not configured.");
    setPending(true);
    try {
      const amount = parseEther(primeAmount || "0");
      const price = parseEther(flowPrice || "0");
      const floor = await publicClient().readContract({
        address: addresses.reserve,
        abi: reserveAbi,
        functionName: "quoteRedeemFloor",
        args: [amount],
      });
      if (price < floor) {
        setStatus(`Price below floor (${formatEther(floor)} FLOW).`);
        return;
      }

      const hash = await walletClient(account).writeContract({
        address: addresses.market,
        abi: marketAbi,
        functionName: "placePrimeSellOrder",
        args: [amount, price],
      });
      setTxHash(hash);
      await loadOrders();
      setStatus("PRIME listed on-chain.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "List failed.");
    } finally {
      setPending(false);
    }
  }

  async function cancelMyOrder() {
    if (!account) return setStatus("Connect wallet.");
    setPending(true);
    try {
      const hash = await walletClient(account).writeContract({
        address: addresses.market,
        abi: marketAbi,
        functionName: "cancelPrimeSellOrder",
      });
      setTxHash(hash);
      await loadOrders();
      setStatus("Order cancelled.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Cancel failed.");
    } finally {
      setPending(false);
    }
  }

  async function buyOrder(row: MarketOrderRow) {
    if (!account) return setStatus("Connect wallet.");
    if (!row.executable) return setStatus("Order below floor — stale.");
    setPending(true);
    try {
      const allowance = await publicClient().readContract({
        address: addresses.flow,
        abi: flowAbi,
        functionName: "allowance",
        args: [account, addresses.market],
      });
      const client = walletClient(account);
      if (allowance < row.flowPrice) {
        const approveHash = await client.writeContract({
          address: addresses.flow,
          abi: flowAbi,
          functionName: "approve",
          args: [addresses.market, row.flowPrice],
        });
        setTxHash(approveHash);
        setStatus("Approve FLOW, then Buy again.");
        return;
      }
      const hash = await client.writeContract({
        address: addresses.market,
        abi: marketAbi,
        functionName: "buyPrimeFromUser",
        args: [row.seller],
      });
      setTxHash(hash);
      await loadOrders();
      setStatus("Bought PRIME.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Buy failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7ff] text-[#0b1736]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6e2ff] pb-4">
          <div>
            <Link href="/" className="font-display text-xl font-black tracking-[-0.06em]">
              Solidus
            </Link>
            <p className="text-sm text-[#496ab3]">Orders ready to fill</p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="btn-secondary">
              Home
            </Link>
            <button className="btn-primary" type="button" disabled={pending} onClick={connect}>
              {account ? short(account) : "Connect"}
            </button>
          </div>
        </header>

        {wrongNetwork && (
          <p className="mt-4 rounded-xl bg-[#eaf0ff] p-3 text-sm font-semibold text-[#315094]">
            Wrong network.{" "}
            <button type="button" className="underline" onClick={switchNetwork}>
              Switch to Base Sepolia
            </button>
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-[#d6e2ff] bg-white p-5">
          <h2 className="font-display text-2xl font-black">Send FLOW</h2>
          <p className="mt-1 text-sm text-[#496ab3]">Direct transfer between wallets.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-bold">Recipient</span>
              <input
                className="mt-1 w-full rounded-xl border border-[#cddcff] bg-[#f9fbff] px-3 py-2"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold">Amount FLOW</span>
              <input
                className="mt-1 w-full rounded-xl border border-[#cddcff] bg-[#f9fbff] px-3 py-2"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </label>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#6280c3]">
            Sender pays network fee separately in ETH. Recipient receives full FLOW amount.
          </p>
          <div className="mt-4">
            <button className="btn-primary" type="button" disabled={!account || wrongNetwork || pending} onClick={sendFlow}>
              Send FLOW
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#d6e2ff] bg-white p-5">
          <h2 className="font-display text-2xl font-black">FLOW / PRIME exchange</h2>
          <p className="mt-1 text-sm text-[#496ab3]">
            Sell PRIME for FLOW. To buy PRIME with FLOW, take an open PRIME order below. Or{" "}
            <Link href="/" className="font-bold text-[#0052ff] underline">
              send FLOW directly
            </Link>
            .
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-bold">PRIME</span>
              <input
                className="mt-1 w-full rounded-xl border border-[#cddcff] bg-[#f9fbff] px-3 py-2"
                value={primeAmount}
                onChange={(e) => setPrimeAmount(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold">FLOW price</span>
              <input
                className="mt-1 w-full rounded-xl border border-[#cddcff] bg-[#f9fbff] px-3 py-2"
                value={flowPrice}
                onChange={(e) => setFlowPrice(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" type="button" disabled={!account || wrongNetwork || pending} onClick={listOrder}>
              Sell PRIME
            </button>
            <button className="btn-secondary" type="button" disabled={!account || wrongNetwork || pending} onClick={cancelMyOrder}>
              Cancel mine
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl font-black">Buy PRIME</h2>
            <button className="btn-secondary" type="button" disabled={pending} onClick={() => loadOrders()}>
              Refresh
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#bcd0ff] bg-white p-8 text-center text-[#496ab3]">
              No orders yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#d6e2ff] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-[#f3f7ff] text-xs uppercase text-[#6280c3]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">PRIME</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Floor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => (
                    <tr key={row.id.toString()} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{row.id.toString()}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {short(row.seller)}
                      </td>
                      <td className="px-4 py-3">{fmt(row.primeAmount)}</td>
                      <td className="px-4 py-3">{fmt(row.flowPrice)}</td>
                      <td className="px-4 py-3">{fmt(row.floorFlow)}</td>
                      <td className="px-4 py-3">{row.executable ? "Ready" : "Stale"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="btn-primary text-xs"
                          type="button"
                          disabled={!account || wrongNetwork || pending || !row.executable}
                          onClick={() => buyOrder(row)}
                        >
                          Buy with FLOW
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {status ? (
          <p className="mt-4 rounded-xl bg-[#0052ff] p-4 text-sm text-white">
            {status}
            {txHash ? (
              <a className="mt-2 block break-all text-[#dce7ff] underline" href={`${baseScan}/tx/${txHash}`} target="_blank" rel="noreferrer">
                {txHash}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </main>
  );
}
