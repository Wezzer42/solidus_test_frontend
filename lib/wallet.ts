import {
  connectWalletConnectProvider,
  disconnectWalletConnectProvider,
  getCachedWalletConnectProvider,
  getWalletConnectProvider,
  hasStoredWalletConnectSession,
  isWalletConnectConfigured,
} from "./wallet-connect";
import type { EthereumProvider } from "./wallet-provider";

export type WalletConnectionKind = "injected" | "walletconnect";

let activeKind: WalletConnectionKind | null = null;
let bootstrapPromise: Promise<WalletBootstrapResult> | null = null;
let connectInjectedPromise: Promise<EthereumProvider> | null = null;
let connectWalletConnectPromise: Promise<EthereumProvider> | null = null;

export type WalletBootstrapResult = {
  hasInjected: boolean;
  session?: {
    provider: EthereumProvider;
    kind: WalletConnectionKind;
  };
};

export type { EthereumProvider };
export { isWalletConnectConfigured };

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export { isMobileBrowser };

export function getMetaMaskMobileDappLink(pathname = "/") {
  if (typeof window === "undefined") return undefined;

  const host = window.location.host;
  const dappPath = pathname === "/" || pathname === "" ? host : `${host}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  return `https://metamask.app.link/dapp/${dappPath}`;
}

export function shouldProbeInjectedWallet() {
  if (typeof window === "undefined") return false;
  if (isMobileBrowser() && isWalletConnectConfigured()) return false;
  return hasInjectedWallet();
}

export function listInjectedProviders() {
  if (typeof window === "undefined") return [] as EthereumProvider[];

  const injected = (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
  if (!injected) return [];

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.filter((provider) => typeof provider.request === "function");
  }

  return typeof injected.request === "function" ? [injected] : [];
}

export function ethereum() {
  const providers = listInjectedProviders();
  if (providers.length === 0) return undefined;
  return providers.find((provider) => provider.isMetaMask) ?? providers[0];
}

export function hasInjectedWallet() {
  return listInjectedProviders().length > 0;
}

export async function probeInjectedWallet() {
  const bootstrap = await bootstrapWallet();
  return bootstrap.hasInjected;
}

async function readInjectedSession() {
  // Do not call the injected provider on page load. MetaMask throws uncaught errors
  // when its background service is disconnected even if the inpage script is present.
  return { hasInjected: hasInjectedWallet(), session: undefined };
}

async function readWalletConnectSession() {
  if (!isWalletConnectConfigured() || !hasStoredWalletConnectSession()) return undefined;

  const walletConnect = await getWalletConnectProvider();
  if (!walletConnect.session) return undefined;

  activeKind = "walletconnect";
  return { provider: walletConnect, kind: "walletconnect" as const };
}

export async function bootstrapWallet(): Promise<WalletBootstrapResult> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const walletConnectSession = await readWalletConnectSession();
    if (walletConnectSession) {
      return {
        hasInjected: hasInjectedWallet(),
        session: walletConnectSession,
      };
    }

    await readInjectedSession();
    return { hasInjected: hasInjectedWallet(), session: undefined };
  })();

  return bootstrapPromise;
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return (error as { code: unknown }).code;
  }
  return undefined;
}

export function formatInjectedWalletError(error: unknown) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  if (code === -32002 || /already pending/i.test(message)) {
    return "MetaMask is already waiting for approval. Open the MetaMask popup and confirm the request.";
  }

  if (/metamask extension not found|failed to connect to metamask|disconnected from metamask background/i.test(message)) {
    return "MetaMask lost connection. Reload the page, unlock MetaMask, then click MetaMask again. Or use WalletConnect.";
  }

  return message;
}

export async function connectInjectedWallet() {
  if (connectInjectedPromise) return connectInjectedPromise;

  const provider = ethereum();
  if (!provider || typeof provider.request !== "function") {
    throw new Error("Install MetaMask or open this site in your wallet browser.");
  }

  connectInjectedPromise = (async () => {
    try {
      await provider.request({ method: "eth_requestAccounts" });
      activeKind = "injected";
      return provider;
    } catch (error) {
      throw new Error(formatInjectedWalletError(error));
    }
  })();

  try {
    return await connectInjectedPromise;
  } finally {
    connectInjectedPromise = null;
  }
}

export async function connectWalletConnectWallet() {
  if (connectWalletConnectPromise) return connectWalletConnectPromise;

  connectWalletConnectPromise = (async () => {
    const provider = await connectWalletConnectProvider();
    activeKind = "walletconnect";
    return provider;
  })();

  try {
    return await connectWalletConnectPromise;
  } finally {
    connectWalletConnectPromise = null;
  }
}

export async function disconnectActiveWallet() {
  const kind = activeKind;
  activeKind = null;
  connectInjectedPromise = null;
  connectWalletConnectPromise = null;

  if (kind === "walletconnect") {
    await disconnectWalletConnectProvider();
    bootstrapPromise = null;
    return;
  }

  const provider = ethereum();
  if (provider) await revokeWalletAccess(provider);
}

export async function restoreWalletSession() {
  const bootstrap = await bootstrapWallet();
  return bootstrap.session;
}

export function watchInjectedWallet(onChange: (available: boolean) => void) {
  const sync = () => onChange(hasInjectedWallet());
  sync();

  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("ethereum#initialized", sync);
  return () => window.removeEventListener("ethereum#initialized", sync);
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
