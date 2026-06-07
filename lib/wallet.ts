import {
  connectWalletConnectProvider,
  disconnectWalletConnectProvider,
  getCachedWalletConnectProvider,
  getWalletConnectProvider,
  isWalletConnectConfigured,
} from "./wallet-connect";
import type { EthereumProvider } from "./wallet-provider";

export type WalletConnectionKind = "injected" | "walletconnect";

let activeKind: WalletConnectionKind | null = null;

export type { EthereumProvider };
export { isWalletConnectConfigured };

export function ethereum() {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
}

export function hasInjectedWallet() {
  return Boolean(ethereum());
}

export function getActiveWalletKind() {
  return activeKind;
}

export function getWalletProvider() {
  if (activeKind === "walletconnect") {
    return getCachedWalletConnectProvider();
  }
  return ethereum();
}

export async function revokeWalletAccess(provider: EthereumProvider) {
  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Wallet may not support revoke; local disconnect still clears UI state.
  }
}

export async function connectInjectedWallet() {
  const provider = ethereum();
  if (!provider) {
    throw new Error("Install MetaMask or open this site in your wallet browser.");
  }

  await provider.request({ method: "eth_requestAccounts" });
  activeKind = "injected";
  return provider;
}

export async function connectWalletConnectWallet() {
  const provider = await connectWalletConnectProvider();
  activeKind = "walletconnect";
  return provider;
}

export async function disconnectActiveWallet() {
  const kind = activeKind;
  activeKind = null;

  if (kind === "walletconnect") {
    await disconnectWalletConnectProvider();
    return;
  }

  const provider = ethereum();
  if (provider) await revokeWalletAccess(provider);
}

export async function restoreWalletSession() {
  const injected = ethereum();
  if (injected) {
    const accounts = (await injected.request({ method: "eth_accounts" })) as string[];
    if (accounts[0]) {
      activeKind = "injected";
      return { provider: injected, kind: "injected" as const };
    }
  }

  if (!isWalletConnectConfigured()) return undefined;

  const walletConnect = await getWalletConnectProvider();
  if (walletConnect.session) {
    activeKind = "walletconnect";
    return { provider: walletConnect, kind: "walletconnect" as const };
  }

  return undefined;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function bindWalletProvider(
  provider: EthereumProvider,
  handlers: {
    onAccountsChanged: (accounts: string[]) => void;
    onChainChanged: (chainId: number) => void;
  },
) {
  const onAccountsChanged = (accounts: unknown) => {
    handlers.onAccountsChanged(accounts as string[]);
  };
  const onChainChanged = (hexChain: unknown) => {
    handlers.onChainChanged(Number(hexChain));
  };

  provider.on?.("accountsChanged", onAccountsChanged);
  provider.on?.("chainChanged", onChainChanged);

  return () => {
    provider.removeListener?.("accountsChanged", onAccountsChanged);
    provider.removeListener?.("chainChanged", onChainChanged);
  };
}

export async function readWalletState(provider: EthereumProvider) {
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const hexChain = (await provider.request({ method: "eth_chainId" })) as string;
  return {
    account: accounts[0] as `0x${string}` | undefined,
    chainId: Number(hexChain),
  };
}
