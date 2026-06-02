import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export function serverPublicClient() {
  const rpc =
    process.env.BASE_SEPOLIA_RPC?.trim() ||
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC?.trim() ||
    "https://sepolia.base.org";

  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpc),
  });
}
