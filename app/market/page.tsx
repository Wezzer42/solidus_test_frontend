"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  AvailableAmount,
  EmptyOrders,
  MarketHeader,
  MarketTabs,
  Panel,
  ProtocolStats,
  StatusBadge,
  StatusBanner,
  TestExchangeWarning,
  TokenCheckCard,
  WalletBalances,
} from "../../components/market-ui";
import {
  addresses,
  erc20Abi,
  flowAbi,
  hasContracts,
  hasTestExchange,
  marketAbi,
  reserveAbi,
  testExchangeAbi,
} from "../../lib/contracts";
import {
  fetchWalletBalances,
  formatInputAmount,
  formatTokenAmount,
  type WalletBalanceSnapshot,
} from "../../lib/wallet-balances";
import {
  fetchProtocolStats,
  formatProtocolAmount,
  type ProtocolStatsSnapshot,
} from "../../lib/protocol-stats";
import { checkPaymentToken, isBlockedPaymentToken, type TokenCheckResult } from "../../lib/token-check";
import { ensureBaseSepolia } from "../../lib/ensure-base-sepolia";
import {
  bindWalletProvider,
  connectInjectedWallet,
  connectWalletConnectWallet,
  disconnectActiveWallet,
  getWalletProvider,
  isWalletConnectConfigured,
  probeInjectedWallet,
  readWalletState,
  restoreWalletSession,
  shortAddress,
} from "../../lib/wallet";

type MarketOrderRow = {
  id: bigint;
  seller: Address;
  primeAmount: bigint;
  flowPrice: bigint;
  floorFlow: bigint;
  executable: boolean;
};

type FlowOrderRow = {
  id: bigint;
  seller: Address;
  paymentToken: Address;
  flowAmount: bigint;
  paymentAmount: bigint;
  paymentSymbol: string;
  paymentDecimals: number;
  tokenReadable: boolean;
};

const nativeToken = "0x0000000000000000000000000000000000000000" as Address;

function publicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC),
  });
}

function walletClient(account: Address) {
  const provider = getWalletProvider();
  if (!provider) throw new Error("Wallet not connected.");
  return createWalletClient({ account, chain: baseSepolia, transport: custom(provider) });
}

function short(addr: string) {
  return shortAddress(addr);
}

function fmt(value: bigint, digits = 4) {
  return Number(formatEther(value)).toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatPayment(row: FlowOrderRow) {
  return `${Number(formatUnits(row.paymentAmount, row.paymentDecimals)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  })} ${row.paymentSymbol}`;
}

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<"transfer" | "prime" | "exchange">("prime");
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [orders, setOrders] = useState<MarketOrderRow[]>([]);
  const [flowOrders, setFlowOrders] = useState<FlowOrderRow[]>([]);
  const [balances, setBalances] = useState<WalletBalanceSnapshot>();
  const [protocolStats, setProtocolStats] = useState<ProtocolStatsSnapshot>();
  const [loadingProtocolStats, setLoadingProtocolStats] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingFlowOrders, setLoadingFlowOrders] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState("1000");
  const [primeAmount, setPrimeAmount] = useState("100");
  const [redeemPrimeAmount, setRedeemPrimeAmount] = useState("100");
  const [redeemQuote, setRedeemQuote] = useState<bigint>();
  const [redeemFloor, setRedeemFloor] = useState<bigint>();
  const [reserveBalance, setReserveBalance] = useState<bigint>();
  const [activeRatioBps, setActiveRatioBps] = useState<bigint>();
  const [loadingRedeemQuote, setLoadingRedeemQuote] = useState(false);
  const [flowPrice, setFlowPrice] = useState("400");
  const [flowSellAmount, setFlowSellAmount] = useState("1000");
  const [paymentAmount, setPaymentAmount] = useState("0.001");
  const [paymentToken, setPaymentToken] = useState("");
  const [tokenCheck, setTokenCheck] = useState<TokenCheckResult>();
  const [checkingToken, setCheckingToken] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [hasInjected, setHasInjected] = useState(false);
  const walletConnectEnabled = isWalletConnectConfigured();

  const wrongNetwork = Boolean(account && chainId !== baseSepolia.id);
  const contractsReady = hasContracts();
  const exchangeReady = hasTestExchange();

  const loadProtocolStats = useCallback(async () => {
    if (!contractsReady) return;
    setLoadingProtocolStats(true);
    try {
      const snapshot = await fetchProtocolStats();
      setProtocolStats(snapshot ?? undefined);
    } finally {
      setLoadingProtocolStats(false);
    }
  }, [contractsReady]);

  const loadOrders = useCallback(async () => {
    if (!contractsReady) return;

    setLoadingOrders(true);
    try {
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
    } finally {
      setLoadingOrders(false);
    }
  }, [contractsReady]);

  const loadFlowOrders = useCallback(async () => {
    if (!exchangeReady) return;

    setLoadingFlowOrders(true);
    try {
      const client = publicClient();
      const nextId = await client.readContract({
        address: addresses.testExchange,
        abi: testExchangeAbi,
        functionName: "nextOrderId",
      });
      const from = nextId > 50n ? nextId - 50n : 1n;
      const ids = Array.from({ length: Number(nextId - from) }, (_, index) => from + BigInt(index));
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const [seller, paymentToken, flowAmount, paymentAmount, active] = await client.readContract({
            address: addresses.testExchange,
            abi: testExchangeAbi,
            functionName: "orders",
            args: [id],
          });
          if (!active || flowAmount === 0n || paymentAmount === 0n) return undefined;

          if (paymentToken.toLowerCase() === nativeToken) {
            return {
              id,
              seller,
              paymentToken,
              flowAmount,
              paymentAmount,
              paymentSymbol: "ETH",
              paymentDecimals: 18,
              tokenReadable: true,
            };
          }

          try {
            const [symbol, decimals] = await Promise.all([
              client.readContract({ address: paymentToken, abi: erc20Abi, functionName: "symbol" }),
              client.readContract({ address: paymentToken, abi: erc20Abi, functionName: "decimals" }),
            ]);
            return {
              id,
              seller,
              paymentToken,
              flowAmount,
              paymentAmount,
              paymentSymbol: String(symbol),
              paymentDecimals: Number(decimals),
              tokenReadable: true,
            };
          } catch {
            return {
              id,
              seller,
              paymentToken,
              flowAmount,
              paymentAmount,
              paymentSymbol: "Unknown ERC-20",
              paymentDecimals: 18,
              tokenReadable: false,
            };
          }
        }),
      );
      setFlowOrders(loaded.filter((order): order is FlowOrderRow => Boolean(order)).reverse());
    } finally {
      setLoadingFlowOrders(false);
    }
  }, [exchangeReady]);

  const loadRedeemQuote = useCallback(async () => {
    if (!contractsReady) return;

    let amount = 0n;
    try {
      amount = parseEther(redeemPrimeAmount || "0");
    } catch {
      setRedeemQuote(undefined);
      setRedeemFloor(undefined);
      return;
    }

    if (amount === 0n) {
      setRedeemQuote(undefined);
      setRedeemFloor(undefined);
      return;
    }

    setLoadingRedeemQuote(true);
    try {
      const client = publicClient();
      const [quote, floor, reserve, activeRatio] = await Promise.all([
        client.readContract({
          address: addresses.reserve,
          abi: reserveAbi,
          functionName: "quoteRedeem",
          args: [amount],
        }),
        client.readContract({
          address: addresses.reserve,
          abi: reserveAbi,
          functionName: "quoteRedeemFloor",
          args: [amount],
        }),
        client.readContract({
          address: addresses.reserve,
          abi: reserveAbi,
          functionName: "reserveBalance",
        }),
        client.readContract({
          address: addresses.reserve,
          abi: reserveAbi,
          functionName: "activeRatioBps",
        }),
      ]);
      setRedeemQuote(quote);
      setRedeemFloor(floor);
      setReserveBalance(reserve);
      setActiveRatioBps(activeRatio);
    } finally {
      setLoadingRedeemQuote(false);
    }
  }, [contractsReady, redeemPrimeAmount]);

  const loadBalances = useCallback(async () => {
    if (!account || !contractsReady || wrongNetwork) {
      setBalances(undefined);
      return;
    }

    setLoadingBalances(true);
    try {
      const snapshot = await fetchWalletBalances(account);
      setBalances(snapshot ?? undefined);
    } finally {
      setLoadingBalances(false);
    }
  }, [account, contractsReady, wrongNetwork]);

  useEffect(() => {
    loadOrders().catch((e) => setStatus(e instanceof Error ? e.message : "Load failed."));
  }, [loadOrders]);

  useEffect(() => {
    loadProtocolStats().catch(() => undefined);
  }, [loadProtocolStats]);

  useEffect(() => {
    loadFlowOrders().catch((e) => setStatus(e instanceof Error ? e.message : "Load FLOW orders failed."));
  }, [loadFlowOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRedeemQuote().catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadRedeemQuote]);

  useEffect(() => {
    loadBalances().catch(() => undefined);
  }, [loadBalances]);

  useEffect(() => {
    void probeInjectedWallet().then(setHasInjected);
  }, []);

  useEffect(() => {
    let unbind: (() => void) | undefined;
    let disposed = false;

    async function bootstrap() {
      const session = await restoreWalletSession();
      if (disposed || !session) return;

      unbind = bindWalletProvider(session.provider, {
        onAccountsChanged: (accounts) => {
          const next = accounts[0] as Address | undefined;
          setAccount(next);
          if (!next) {
            setBalances(undefined);
            setChainId(undefined);
            setTokenCheck(undefined);
          }
        },
        onChainChanged: (chainId) => setChainId(chainId),
      });

      const state = await readWalletState(session.provider);
      if (disposed) return;
      setAccount(state.account);
      setChainId(state.chainId);
    }

    void bootstrap();
    return () => {
      disposed = true;
      unbind?.();
    };
  }, []);

  async function syncWalletState(provider: NonNullable<ReturnType<typeof getWalletProvider>>) {
    await ensureBaseSepolia(provider);
    const state = await readWalletState(provider);
    setAccount(state.account);
    setChainId(state.chainId);
    setStatus("");
  }

  async function connectInjected() {
    setPending(true);
    try {
      const provider = await connectInjectedWallet();
      await syncWalletState(provider);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connect failed.");
    } finally {
      setPending(false);
    }
  }

  async function connectWalletConnect() {
    setPending(true);
    try {
      const provider = await connectWalletConnectWallet();
      await syncWalletState(provider);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "WalletConnect failed.");
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    await disconnectActiveWallet();
    setAccount(undefined);
    setChainId(undefined);
    setBalances(undefined);
    setTokenCheck(undefined);
    setStatus("");
  }

  async function switchNetwork() {
    const provider = getWalletProvider();
    if (!provider) return;
    setPending(true);
    try {
      await ensureBaseSepolia(provider);
      const state = await readWalletState(provider);
      setAccount(state.account);
      setChainId(state.chainId);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Network switch failed.");
    } finally {
      setPending(false);
    }
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
      await loadBalances();
      await loadProtocolStats();
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
      await loadBalances();
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
    if (row.seller.toLowerCase() === account.toLowerCase()) {
      return setStatus("You cannot buy your own PRIME order.");
    }
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
      await loadBalances();
      setStatus("Bought PRIME.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Buy failed.");
    } finally {
      setPending(false);
    }
  }

  async function listFlowOrder() {
    if (!account) return setStatus("Connect wallet.");
    if (!exchangeReady) return setStatus("Test exchange not configured.");

    const token = paymentToken.trim() ? paymentToken.trim() : nativeToken;
    if (!isAddress(token) && paymentToken.trim()) {
      return setStatus("Payment token must be an address or empty for Base Sepolia ETH.");
    }
    if (isBlockedPaymentToken(paymentToken)) {
      return setStatus("FLOW and PRIME cannot be used as payment tokens on the test exchange.");
    }
    if (paymentToken.trim()) {
      if (!tokenCheck || tokenCheck.kind !== "erc20") {
        return setStatus("Check token first. Only detected ERC-20 test tokens can be listed.");
      }
      if (tokenCheck.detail && tokenCheck.status !== "Token found") {
        return setStatus("Token check failed. Use another test token.");
      }
    }

    setPending(true);
    try {
      const flowAmount = parseEther(flowSellAmount || "0");
      const payDecimals = paymentToken.trim() && tokenCheck?.kind === "erc20" ? tokenCheck.decimals ?? 18 : 18;
      const payAmount = parseUnits(paymentAmount || "0", payDecimals);
      const client = publicClient();
      const allowance = await client.readContract({
        address: addresses.flow,
        abi: flowAbi,
        functionName: "allowance",
        args: [account, addresses.testExchange],
      });
      const wallet = walletClient(account);
      if (allowance < flowAmount) {
        const approveHash = await wallet.writeContract({
          address: addresses.flow,
          abi: flowAbi,
          functionName: "approve",
          args: [addresses.testExchange, flowAmount],
        });
        setTxHash(approveHash);
        setStatus("Approve FLOW, then list again.");
        return;
      }

      const hash = await wallet.writeContract({
        address: addresses.testExchange,
        abi: testExchangeAbi,
        functionName: "placeFlowSellOrder",
        args: [token as Address, flowAmount, payAmount],
      });
      setTxHash(hash);
      await loadFlowOrders();
      setStatus("FLOW order listed.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "FLOW listing failed.");
    } finally {
      setPending(false);
    }
  }

  async function cancelFlowOrder(orderId: bigint) {
    if (!account) return setStatus("Connect wallet.");
    setPending(true);
    try {
      const hash = await walletClient(account).writeContract({
        address: addresses.testExchange,
        abi: testExchangeAbi,
        functionName: "cancelFlowSellOrder",
        args: [orderId],
      });
      setTxHash(hash);
      await loadFlowOrders();
      setStatus("FLOW order cancelled.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Cancel FLOW order failed.");
    } finally {
      setPending(false);
    }
  }

  async function fillFlowOrder(row: FlowOrderRow) {
    if (!account) return setStatus("Connect wallet.");
    setPending(true);
    try {
      const wallet = walletClient(account);
      if (row.paymentToken.toLowerCase() !== nativeToken) {
        const allowance = await publicClient().readContract({
          address: row.paymentToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, addresses.testExchange],
        });
        if (allowance < row.paymentAmount) {
          const approveHash = await wallet.writeContract({
            address: row.paymentToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [addresses.testExchange, row.paymentAmount],
          });
          setTxHash(approveHash);
          setStatus("Approve payment token, then buy FLOW again.");
          return;
        }
      }

      const hash = await wallet.writeContract({
        address: addresses.testExchange,
        abi: testExchangeAbi,
        functionName: "fillFlowSellOrder",
        args: [row.id],
        value: row.paymentToken.toLowerCase() === nativeToken ? row.paymentAmount : 0n,
      });
      setTxHash(hash);
      await loadFlowOrders();
      await loadBalances();
      setStatus("Bought FLOW.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Buy FLOW failed.");
    } finally {
      setPending(false);
    }
  }

  async function redeemPrime() {
    if (!account) return setStatus("Connect wallet.");
    if (!contractsReady) return setStatus("Contracts not configured.");

    setPending(true);
    try {
      const amount = parseEther(redeemPrimeAmount || "0");
      if (amount === 0n) return setStatus("Enter PRIME amount.");
      if (balances && balances.prime < amount) {
        setStatus(`Insufficient PRIME. Need ${fmt(amount)} PRIME, available ${fmt(balances.prime)} PRIME.`);
        return;
      }

      const quote = await publicClient().readContract({
        address: addresses.reserve,
        abi: reserveAbi,
        functionName: "quoteRedeem",
        args: [amount],
      });
      if (quote === 0n) {
        setStatus("Redemption unavailable right now. Block budget may be exhausted or reserve signal is zero.");
        return;
      }

      const hash = await walletClient(account).writeContract({
        address: addresses.market,
        abi: marketAbi,
        functionName: "redeemPrime",
        args: [amount, quote],
      });
      setTxHash(hash);
      await loadBalances();
      await loadProtocolStats();
      await loadRedeemQuote();
      setStatus(`Redeemed PRIME for about ${fmt(quote)} FLOW.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Redeem failed.");
    } finally {
      setPending(false);
    }
  }

  async function runTokenCheck() {
    setCheckingToken(true);
    try {
      const result = await checkPaymentToken(paymentToken, account);
      setTokenCheck(result);
    } catch (e) {
      setTokenCheck({
        kind: "not-erc20",
        status: "Not ERC-20",
        detail: e instanceof Error ? e.message : "Token check failed.",
      });
    } finally {
      setCheckingToken(false);
    }
  }

  function tokenCheckTone(result: TokenCheckResult): "neutral" | "ok" | "warn" | "error" {
    if (result.kind === "erc20" || result.kind === "native") return "ok";
    if (result.kind === "blocked") return "warn";
    if (result.kind === "not-erc20" || result.kind === "invalid") return "error";
    return "neutral";
  }

  const walletDisabled = !account || wrongNetwork || pending;
  const myPrimeOrders = orders.filter(
    (row) => account && row.seller.toLowerCase() === account.toLowerCase(),
  );

  return (
    <main className="min-h-screen bg-[#f3f7ff] text-[#0b1736]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <MarketHeader
          account={account ? short(account) : undefined}
          pending={pending}
          hasInjectedWallet={hasInjected}
          walletConnectEnabled={walletConnectEnabled}
          onConnectInjected={connectInjected}
          onConnectWalletConnect={connectWalletConnect}
          onDisconnect={disconnect}
        />

        {wrongNetwork ? (
          <div className="mt-4 rounded-2xl border border-[#ffd6a8] bg-[#fff4d8] px-4 py-3 text-sm font-semibold text-[#805b00]">
            Wrong network.{" "}
            <button type="button" className="underline" onClick={switchNetwork}>
              Switch to Base Sepolia
            </button>
          </div>
        ) : null}

        <div className="mt-6">
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
        </div>

        {account && !wrongNetwork ? (
          <div className="mt-6">
            <WalletBalances
              account={account}
              flow={balances ? formatTokenAmount(balances.flow, "FLOW") : undefined}
              prime={balances ? formatTokenAmount(balances.prime, "PRIME") : undefined}
              eth={balances ? formatTokenAmount(balances.eth, "ETH", 5) : undefined}
              loading={loadingBalances}
              onRefresh={loadBalances}
              onDisconnect={disconnect}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[#bcd0ff] bg-white px-5 py-4 text-sm text-[#496ab3]">
            Connect wallet on Base Sepolia to send FLOW, trade PRIME, and view balances.
          </div>
        )}

        <div className="mt-6">
          <MarketTabs active={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === "transfer" ? (
          <div className="mt-6 max-w-2xl">
            <Panel
              title="Send FLOW"
              description="Direct wallet-to-wallet transfer. Network fee is paid separately in ETH."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#35549a] sm:col-span-2">
                  Recipient address
                  <input
                    className="input-field font-mono text-sm"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                  />
                </label>
                <label className="block text-sm font-semibold text-[#35549a]">
                  Amount
                  <input
                    className="input-field"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="1000"
                  />
                  <AvailableAmount
                    label="FLOW"
                    amount={balances?.flow}
                    onUseMax={() => balances && setTransferAmount(formatInputAmount(balances.flow))}
                  />
                </label>
              </div>
              <button className="btn-primary mt-5" type="button" disabled={walletDisabled} onClick={sendFlow}>
                Send FLOW
              </button>
            </Panel>
          </div>
        ) : null}

        {activeTab === "prime" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-6">
              <Panel
                title="Sell PRIME"
                description="List PRIME for FLOW. Price must be at or above the reserve floor. You cannot buy your own order."
              >
                {myPrimeOrders.length > 0 ? (
                  <p className="mb-4 rounded-xl border border-[#dce7ff] bg-[#f9fbff] px-4 py-3 text-sm text-[#496ab3]">
                    You have an active sell order for {fmt(myPrimeOrders[0].primeAmount)} PRIME at{" "}
                    {fmt(myPrimeOrders[0].flowPrice)} FLOW. Cancel it here before relisting.
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#35549a]">
                    PRIME amount
                    <input
                      className="input-field"
                      value={primeAmount}
                      onChange={(e) => setPrimeAmount(e.target.value)}
                    />
                    <AvailableAmount
                      label="PRIME"
                      amount={balances?.prime}
                      onUseMax={() => balances && setPrimeAmount(formatInputAmount(balances.prime))}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#35549a]">
                    FLOW price
                    <input
                      className="input-field"
                      value={flowPrice}
                      onChange={(e) => setFlowPrice(e.target.value)}
                    />
                    <AvailableAmount label="FLOW" amount={balances?.flow} />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-primary" type="button" disabled={walletDisabled} onClick={listOrder}>
                    List order
                  </button>
                  <button className="btn-secondary" type="button" disabled={walletDisabled} onClick={cancelMyOrder}>
                    Cancel my order
                  </button>
                </div>
              </Panel>

              <Panel
                title="Redeem PRIME"
                description="Burn PRIME to release FLOW from the Reserve. Payout depends on reserve signals and per-block budget."
              >
                <label className="block text-sm font-semibold text-[#35549a]">
                  PRIME to redeem
                  <input
                    className="input-field"
                    value={redeemPrimeAmount}
                    onChange={(e) => setRedeemPrimeAmount(e.target.value)}
                  />
                  <AvailableAmount
                    label="PRIME"
                    amount={balances?.prime}
                    onUseMax={() => balances && setRedeemPrimeAmount(formatInputAmount(balances.prime))}
                  />
                </label>

                <div className="mt-4 rounded-xl border border-[#dce7ff] bg-[#f9fbff] p-4 text-sm">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Expected FLOW</dt>
                      <dd className="mt-1 font-display text-lg font-black text-[#0052ff]">
                        {loadingRedeemQuote ? "…" : redeemQuote !== undefined ? `${fmt(redeemQuote)} FLOW` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Redemption floor</dt>
                      <dd className="mt-1 font-semibold text-[#335aa8]">
                        {loadingRedeemQuote ? "…" : redeemFloor !== undefined ? `${fmt(redeemFloor)} FLOW` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Reserve balance</dt>
                      <dd className="mt-1 font-semibold text-[#335aa8]">
                        {reserveBalance !== undefined ? `${fmt(reserveBalance)} FLOW` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-[#6280c3]">Active FLOW ratio</dt>
                      <dd className="mt-1 font-semibold text-[#335aa8]">
                        {activeRatioBps !== undefined
                          ? `${(Number(activeRatioBps) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-[#6280c3]">
                    Actual payout is capped by the current block release budget. If expected FLOW is 0, wait for the next block or try a smaller amount.
                  </p>
                </div>

                <button
                  className="btn-primary mt-5 w-full sm:w-auto"
                  type="button"
                  disabled={walletDisabled || !redeemQuote || redeemQuote === 0n}
                  onClick={redeemPrime}
                >
                  Redeem PRIME
                </button>
              </Panel>
            </div>

            <Panel
              title="Buy PRIME"
              description="Open sell orders on-chain. Your own listings are marked — you cannot buy PRIME from yourself."
              action={
                <button className="btn-secondary text-sm" type="button" disabled={pending} onClick={() => loadOrders()}>
                  {loadingOrders ? "Refreshing…" : "Refresh"}
                </button>
              }
            >
              {loadingOrders && orders.length === 0 ? (
                <p className="text-sm text-[#496ab3]">Loading orders…</p>
              ) : orders.length === 0 ? (
                <EmptyOrders message="No PRIME sell orders on-chain yet. Be the first to list." />
              ) : (
                <div className="space-y-3">
                  {orders.map((row) => {
                    const isMine = account?.toLowerCase() === row.seller.toLowerCase();
                    return (
                      <article
                        key={row.id.toString()}
                        className={`rounded-xl border p-4 ${
                          isMine ? "border-[#9cb8ff] bg-[#eaf0ff]" : "border-[#dce7ff] bg-[#f9fbff]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6280c3]">
                              Order #{row.id.toString()}
                            </p>
                            <p className="mt-1 font-display text-lg font-black tracking-[-0.04em]">
                              {fmt(row.primeAmount)} PRIME
                            </p>
                            <p className="mt-1 text-sm text-[#496ab3]">
                              for <span className="font-bold text-[#0052ff]">{fmt(row.flowPrice)} FLOW</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {isMine ? (
                              <span className="rounded-full bg-[#0052ff] px-2.5 py-1 text-xs font-bold text-white">
                                Your order
                              </span>
                            ) : null}
                            <StatusBadge ready={row.executable} />
                          </div>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#496ab3] sm:grid-cols-3">
                          <div>
                            <dt className="font-bold uppercase tracking-wide">Seller</dt>
                            <dd className="mt-0.5 font-mono">{short(row.seller)}</dd>
                          </div>
                          <div>
                            <dt className="font-bold uppercase tracking-wide">Floor</dt>
                            <dd className="mt-0.5">{fmt(row.floorFlow)} FLOW</dd>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <dt className="font-bold uppercase tracking-wide">Rate</dt>
                            <dd className="mt-0.5">
                              {(Number(formatEther(row.flowPrice)) / Number(formatEther(row.primeAmount))).toFixed(2)} FLOW/PRIME
                            </dd>
                          </div>
                        </dl>
                        {isMine ? (
                          <p className="mt-3 text-xs font-semibold text-[#496ab3]">
                            You cannot buy your own PRIME. Cancel here or from Sell PRIME.
                          </p>
                        ) : null}
                        <button
                          className={`mt-4 w-full sm:w-auto ${isMine ? "btn-secondary" : "btn-primary"}`}
                          type="button"
                          disabled={walletDisabled || (!isMine && !row.executable)}
                          onClick={() => (isMine ? cancelMyOrder() : buyOrder(row))}
                        >
                          {isMine ? "Cancel your order" : "Buy with FLOW"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        ) : null}

        {activeTab === "exchange" ? (
          <div className="mt-6 space-y-4">
            <TestExchangeWarning />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Panel
              title="Sell FLOW"
              description="Test exchange for Base Sepolia ETH or arbitrary ERC-20 tokens. FLOW and PRIME are blocked as payment tokens."
            >
              {!exchangeReady ? (
                <p className="rounded-xl bg-[#fff4d8] p-3 text-sm font-semibold text-[#805b00]">
                  Test exchange address is not configured in environment.
                </p>
              ) : null}
              <div className="mt-4 grid gap-4">
                <label className="block text-sm font-semibold text-[#35549a]">
                  FLOW to sell
                  <input
                    className="input-field"
                    value={flowSellAmount}
                    onChange={(e) => setFlowSellAmount(e.target.value)}
                  />
                  <AvailableAmount
                    label="FLOW"
                    amount={balances?.flow}
                    onUseMax={() => balances && setFlowSellAmount(formatInputAmount(balances.flow))}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#35549a]">
                    Payment amount
                    <input
                      className="input-field"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#35549a]">
                    Payment token
                    <input
                      className="input-field font-mono text-sm"
                      value={paymentToken}
                      onChange={(e) => {
                        setPaymentToken(e.target.value);
                        setTokenCheck(undefined);
                      }}
                      placeholder="empty = ETH"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={checkingToken}
                  onClick={runTokenCheck}
                >
                  {checkingToken ? "Checking…" : "Check token"}
                </button>
              </div>

              {tokenCheck ? (
                <div className="mt-4">
                  <TokenCheckCard
                    status={tokenCheck.status}
                    symbol={tokenCheck.symbol}
                    decimals={tokenCheck.decimals}
                    balance={tokenCheck.balance}
                    detail={tokenCheck.detail}
                    tone={tokenCheckTone(tokenCheck)}
                  />
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={walletDisabled || !exchangeReady}
                  onClick={listFlowOrder}
                >
                  List FLOW order
                </button>
              </div>
            </Panel>

            <Panel
              title="Buy FLOW"
              description="Fill an open FLOW sell order with ETH or an approved ERC-20. Check unknown tokens before paying."
              action={
                <button
                  className="btn-secondary text-sm"
                  type="button"
                  disabled={pending || !exchangeReady}
                  onClick={() => loadFlowOrders()}
                >
                  {loadingFlowOrders ? "Refreshing…" : "Refresh"}
                </button>
              }
            >
              {!exchangeReady ? (
                <EmptyOrders message="Configure NEXT_PUBLIC_TEST_EXCHANGE_ADDRESS to enable the test exchange." />
              ) : loadingFlowOrders && flowOrders.length === 0 ? (
                <p className="text-sm text-[#496ab3]">Loading orders…</p>
              ) : flowOrders.length === 0 ? (
                <EmptyOrders message="No FLOW sell orders yet." />
              ) : (
                <div className="space-y-3">
                  {flowOrders.map((row) => {
                    const isMine = account?.toLowerCase() === row.seller.toLowerCase();
                    return (
                      <article
                        key={row.id.toString()}
                        className="rounded-xl border border-[#dce7ff] bg-[#f9fbff] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6280c3]">
                              Order #{row.id.toString()}
                            </p>
                            <p className="mt-1 font-display text-lg font-black tracking-[-0.04em]">
                              {fmt(row.flowAmount)} FLOW
                            </p>
                            <p className="mt-1 text-sm text-[#496ab3]">
                              for{" "}
                              <span className="font-bold text-[#0052ff]">
                                {formatPayment(row)}
                              </span>
                            </p>
                          </div>
                          {isMine ? (
                            <span className="rounded-full bg-[#eaf0ff] px-2.5 py-1 text-xs font-bold text-[#0052ff]">
                              Yours
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[#496ab3] sm:grid-cols-2">
                          <div>
                            <p className="font-bold uppercase tracking-wide text-[#6280c3]">Seller</p>
                            <p className="mt-0.5 font-mono">{short(row.seller)}</p>
                          </div>
                          <div>
                            <p className="font-bold uppercase tracking-wide text-[#6280c3]">Payment token</p>
                            <p className="mt-0.5 font-mono">
                              {row.paymentToken.toLowerCase() === nativeToken
                                ? "Base Sepolia ETH"
                                : `${row.paymentSymbol} / ${short(row.paymentToken)}`}
                            </p>
                            <p className="mt-0.5">
                              {row.tokenReadable
                                ? `ERC-20 detected, decimals ${row.paymentDecimals}`
                                : "Unknown ERC-20: behavior not guaranteed"}
                            </p>
                          </div>
                        </div>
                        <button
                          className={`mt-4 w-full sm:w-auto ${isMine ? "btn-secondary" : "btn-primary"}`}
                          type="button"
                          disabled={walletDisabled}
                          onClick={() => (isMine ? cancelFlowOrder(row.id) : fillFlowOrder(row))}
                        >
                          {isMine ? "Cancel order" : "Buy FLOW"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>
            </div>
          </div>
        ) : null}

      </div>
      {status ? (
        <StatusBanner
          message={status}
          txHash={txHash}
          onClose={() => {
            setStatus("");
            setTxHash(undefined);
          }}
        />
      ) : null}
    </main>
  );
}
