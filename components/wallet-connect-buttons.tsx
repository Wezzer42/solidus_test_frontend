"use client";

import { useEffect, useState } from "react";
import { getMetaMaskMobileDappLink, isMobileBrowser } from "../lib/wallet";

export function WalletConnectButtons({
  pending,
  hasInjectedWallet,
  walletConnectEnabled,
  onConnectInjected,
  onConnectWalletConnect,
}: {
  pending: boolean;
  hasInjectedWallet: boolean;
  walletConnectEnabled: boolean;
  onConnectInjected: () => void;
  onConnectWalletConnect: () => void;
}) {
  const [openInMetaMaskHref, setOpenInMetaMaskHref] = useState<string>();

  useEffect(() => {
    if (hasInjectedWallet) {
      setOpenInMetaMaskHref(undefined);
      return;
    }

    if (isMobileBrowser()) {
      setOpenInMetaMaskHref(getMetaMaskMobileDappLink(window.location.pathname));
    }
  }, [hasInjectedWallet]);

  if (!hasInjectedWallet && !walletConnectEnabled && !openInMetaMaskHref) {
    return (
      <span className="text-sm font-semibold text-[#496ab3]">
        Install MetaMask on desktop, or open this site in the MetaMask app on mobile.
      </span>
    );
  }

  return (
    <>
      {openInMetaMaskHref ? (
        <a className="btn-primary" href={openInMetaMaskHref}>
          Open in MetaMask
        </a>
      ) : null}
      {hasInjectedWallet ? (
        <button className="btn-primary" type="button" disabled={pending} onClick={onConnectInjected}>
          MetaMask
        </button>
      ) : null}
      {walletConnectEnabled ? (
        <button
          className={hasInjectedWallet || openInMetaMaskHref ? "btn-secondary" : "btn-primary"}
          type="button"
          disabled={pending}
          onClick={onConnectWalletConnect}
        >
          WalletConnect
        </button>
      ) : null}
      {openInMetaMaskHref && !walletConnectEnabled ? (
        <p className="w-full text-xs leading-5 text-[#496ab3]">
          Opens the site inside the MetaMask app so you can connect your wallet.
        </p>
      ) : null}
      {!hasInjectedWallet && walletConnectEnabled ? (
        <p className="w-full text-xs leading-5 text-[#496ab3]">
          On mobile, tap Open in MetaMask or WalletConnect.
        </p>
      ) : null}
    </>
  );
}
