import { createPublicClient, formatEther, http } from "viem";
import { baseSepolia } from "viem/chains";
import { addresses, flowAbi, hasContracts, primeAbi, reserveAbi } from "./contracts";

export type ProtocolStatsSnapshot = {
  activeFlow: bigint;
  reserveFlow: bigint;
  totalFlow: bigint;
  primeSupply: bigint;
  primeCap: bigint;
  activeRatioBps: bigint;
};

export function formatProtocolAmount(value: bigint, symbol: string, digits = 2) {
  const amount = Number(formatEther(value)).toLocaleString("en-US", { maximumFractionDigits: digits });
  return `${amount} ${symbol}`;
}

export async function fetchProtocolStats(): Promise<ProtocolStatsSnapshot | null> {
  if (!hasContracts()) return null;

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC),
  });

  const [activeFlow, reserveFlow, totalFlow, primeSupply, primeCap, activeRatioBps] = await Promise.all([
    client.readContract({
      address: addresses.flow,
      abi: flowAbi,
      functionName: "activeSupply",
    }),
    client.readContract({
      address: addresses.reserve,
      abi: reserveAbi,
      functionName: "reserveBalance",
    }),
    client.readContract({
      address: addresses.flow,
      abi: flowAbi,
      functionName: "totalSupply",
    }),
    client.readContract({
      address: addresses.prime,
      abi: primeAbi,
      functionName: "totalSupply",
    }),
    client.readContract({
      address: addresses.prime,
      abi: primeAbi,
      functionName: "cap",
    }),
    client.readContract({
      address: addresses.reserve,
      abi: reserveAbi,
      functionName: "activeRatioBps",
    }),
  ]);

  return {
    activeFlow,
    reserveFlow,
    totalFlow,
    primeSupply,
    primeCap,
    activeRatioBps,
  };
}
