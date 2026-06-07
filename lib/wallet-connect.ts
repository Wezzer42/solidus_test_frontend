import { baseSepolia } from "viem/chains";
import type { EthereumProvider } from "./wallet-provider";

let providerInstance: EthereumProvider | null = null;
let providerPromise: Promise<EthereumProvider> | null = null;

export function isWalletConnectConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim());
}

/** Lightweight check — avoids loading @walletconnect/ethereum-provider on every page visit. */
export function hasStoredWalletConnectSession() {
  if (typeof window === "undefined") return false;

  try {
    return Object.keys(localStorage).some(
      (key) => key.startsWith("wc@2:") && key.includes("session"),
    );
  } catch {
    return false;
  }
}

export function getCachedWalletConnectProvider() {
  return providerInstance ?? undefined;
}

async function initWalletConnectProvider() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("WalletConnect project ID is not configured.");
  }

  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const origin = window.location.origin;

  return EthereumProvider.init({
    projectId,
    chains: [baseSepolia.id],
    showQrModal: true,
    metadata: {
      name: "Solidus Testnet",
      description: "Use FLOW. Earn PRIME.",
      url: origin,
      icons: [`${origin}/icon.png`],
    },
  }) as Promise<EthereumProvider>;
}

export async function getWalletConnectProvider() {
  if (providerInstance) return providerInstance;
  if (!providerPromise) {
    providerPromise = initWalletConnectProvider();
  }
  providerInstance = await providerPromise;
  return providerInstance;
}

export async function connectWalletConnectProvider() {
  const provider = await getWalletConnectProvider();
  await provider.connect();
  return provider;
}

export async function disconnectWalletConnectProvider() {
  if (!providerInstance) return;
  await providerInstance.disconnect();
  providerInstance = null;
  providerPromise = null;
}
