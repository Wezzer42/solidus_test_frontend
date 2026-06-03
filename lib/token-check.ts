import { createPublicClient, formatUnits, http, isAddress, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { addresses, erc20Abi } from "./contracts";

export type TokenCheckResult = {
  kind: "native" | "erc20" | "blocked" | "invalid" | "not-erc20";
  status: string;
  symbol?: string;
  decimals?: number;
  balance?: string;
  detail?: string;
};

function publicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC),
  });
}

function blockedTokenMessage(token: Address): string | undefined {
  if (token.toLowerCase() === addresses.flow.toLowerCase()) {
    return "FLOW cannot be used as a payment token on the test exchange.";
  }
  if (token.toLowerCase() === addresses.prime.toLowerCase()) {
    return "PRIME cannot be used as a payment token on the test exchange.";
  }
  return undefined;
}

export async function checkPaymentToken(
  tokenInput: string,
  walletAddress?: Address,
): Promise<TokenCheckResult> {
  const trimmed = tokenInput.trim();

  if (!trimmed) {
    if (walletAddress) {
      const balance = await publicClient().getBalance({ address: walletAddress });
      return {
        kind: "native",
        status: "Token found",
        symbol: "ETH",
        decimals: 18,
        balance: formatUnits(balance, 18),
        detail: "Base Sepolia native ETH.",
      };
    }

    return {
      kind: "native",
      status: "Token found",
      symbol: "ETH",
      decimals: 18,
      detail: "Leave empty to use Base Sepolia ETH.",
    };
  }

  if (!isAddress(trimmed)) {
    return {
      kind: "invalid",
      status: "Not ERC-20",
      detail: "Enter a valid 0x address or leave empty for ETH.",
    };
  }

  const token = trimmed as Address;
  const blocked = blockedTokenMessage(token);
  if (blocked) {
    return {
      kind: "blocked",
      status: "Blocked by protocol",
      detail: blocked,
    };
  }

  try {
    const client = publicClient();
    const [symbol, decimals, balance] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      walletAddress
        ? client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] })
        : Promise.resolve(undefined),
    ]);

    return {
      kind: "erc20",
      status: "Token found",
      symbol: String(symbol),
      decimals: Number(decimals),
      balance: balance !== undefined ? formatUnits(balance, Number(decimals)) : undefined,
    };
  } catch {
    return {
      kind: "not-erc20",
      status: "Not ERC-20",
      detail: "Could not read symbol/decimals. Token may be non-standard, malicious, or not a contract.",
    };
  }
}

export function isBlockedPaymentToken(tokenInput: string) {
  const trimmed = tokenInput.trim();
  if (!trimmed || !isAddress(trimmed)) return false;
  return Boolean(blockedTokenMessage(trimmed as Address));
}
