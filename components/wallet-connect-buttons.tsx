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
  if (!hasInjectedWallet && !walletConnectEnabled) {
    return (
      <span className="text-sm font-semibold text-[#496ab3]">
        Install MetaMask or configure WalletConnect.
      </span>
    );
  }

  return (
    <>
      {hasInjectedWallet ? (
        <button className="btn-primary" type="button" disabled={pending} onClick={onConnectInjected}>
          Browser wallet
        </button>
      ) : null}
      {walletConnectEnabled ? (
        <button
          className={hasInjectedWallet ? "btn-secondary" : "btn-primary"}
          type="button"
          disabled={pending}
          onClick={onConnectWalletConnect}
        >
          WalletConnect
        </button>
      ) : null}
      {!hasInjectedWallet && walletConnectEnabled ? (
        <p className="w-full text-xs leading-5 text-[#496ab3]">
          On mobile, use WalletConnect to open MetaMask.
        </p>
      ) : null}
    </>
  );
}
