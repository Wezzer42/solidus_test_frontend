import { baseSepolia } from "viem/chains";
import type { EthereumProvider } from "./wallet-provider";

export async function ensureBaseSepolia(provider: EthereumProvider) {
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
