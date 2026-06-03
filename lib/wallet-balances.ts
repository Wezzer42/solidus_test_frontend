import { createPublicClient, formatEther, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { addresses, flowAbi, hasContracts, primeAbi } from "./contracts";

export type WalletBalanceSnapshot = {
  flow: bigint;
  prime: bigint;
  eth: bigint;
};

export function formatTokenAmount(value: bigint, symbol: string, digits = 4) {
  const amount = Number(formatEther(value)).toLocaleString("en-US", { maximumFractionDigits: digits });
  return `${amount} ${symbol}`;
}

export async function fetchWalletBalances(account: Address): Promise<WalletBalanceSnapshot | null> {
  if (!hasContracts()) return null;

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC),
  });

  const [flow, prime, eth] = await Promise.all([
    client.readContract({
      address: addresses.flow,
      abi: flowAbi,
      functionName: "balanceOf",
      args: [account],
    }),
    client.readContract({
      address: addresses.prime,
      abi: primeAbi,
      functionName: "balanceOf",
      args: [account],
    }),
    client.getBalance({ address: account }),
  ]);

  return { flow, prime, eth };
}

export function formatInputAmount(value: bigint) {
  return formatEther(value);
}
