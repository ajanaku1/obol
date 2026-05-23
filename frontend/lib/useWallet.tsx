"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { ARC, ARC_NETWORK_PARAMS } from "./arc";

/** A minimal EIP-1193 provider — what an injected browser wallet exposes. */
interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

type Status = "disconnected" | "connecting" | "connected";

/** Obol's own wallet, as reported by `/api/wallet`. Address only — its balance
 * is private and never exposed to the client. */
export interface ObolWallet {
  address: string;
}

interface WalletState {
  status: Status;
  account: string | null;
  onArc: boolean;
  error: string | null;
  obol: ObolWallet | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshObol: () => Promise<void>;
  /** Builds a USDC payment and prompts the wallet to sign it; returns the tx hash. */
  payObol: (amountUsdc: number) => Promise<string>;
}

const WalletContext = createContext<WalletState | null>(null);

function discoverProvider(): Promise<Eip1193Provider | null> {
  return new Promise((resolve) => {
    const injected = (window as { ethereum?: Eip1193Provider }).ethereum ?? null;
    let found: Eip1193Provider | null = null;
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as { provider?: Eip1193Provider };
      if (!found && detail?.provider) found = detail.provider;
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve(found ?? injected);
    }, 350);
  });
}

function connectError(err: unknown): string {
  const e = err as { code?: number; message?: string };
  if (e?.code === 4001) return "Connection request rejected in your wallet.";
  if (e?.code === -32002) return "A wallet request is already pending — open your wallet.";
  return e?.message || "Could not connect the wallet.";
}

const switchToArc = (provider: Eip1193Provider) =>
  provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: ARC.chainIdHex }],
  });

/**
 * Puts the wallet on Arc Testnet. Tries a plain switch first; on any failure
 * (chain not added, or a wallet that reports it oddly) it adds Arc — which
 * prompts the user once and then switches automatically.
 */
async function ensureArc(provider: Eip1193Provider): Promise<void> {
  try {
    await switchToArc(provider);
    return;
  } catch {
    // Fall through — adding the chain handles "not added" and odd error shapes.
  }
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [ARC_NETWORK_PARAMS],
  });
  // Most wallets switch as part of adding; nudge the rest, ignoring noise.
  await switchToArc(provider).catch(() => undefined);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [status, setStatus] = useState<Status>("disconnected");
  const [account, setAccount] = useState<string | null>(null);
  const [onArc, setOnArc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obol, setObol] = useState<ObolWallet | null>(null);

  const refreshObol = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (res.ok) setObol((await res.json()) as ObolWallet);
    } catch {
      // leave the last known value in place
    }
  }, []);

  useEffect(() => {
    refreshObol();
  }, [refreshObol]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const found = provider ?? (await discoverProvider());
      if (!found) {
        setError("No browser wallet detected. Install MetaMask, then retry.");
        setStatus("disconnected");
        return;
      }
      const accounts = (await found.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) {
        setError("Your wallet returned no account.");
        setStatus("disconnected");
        return;
      }
      setProvider(found);
      setAccount(accounts[0] ?? null);
      setStatus("connected");

      // Network switch is best-effort — a connected wallet on the wrong
      // chain is still connected; we just flag it.
      try {
        await ensureArc(found);
        setOnArc(true);
      } catch {
        setOnArc(false);
        setError("Connected — now switch your wallet to Arc Testnet to pay Obol.");
      }
    } catch (err) {
      setError(connectError(err));
      setStatus("disconnected");
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    // Best-effort revoke — supported by MetaMask, ignored elsewhere. Either
    // way the app forgets the session.
    try {
      await provider?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // wallet doesn't support revoke — clearing local state is enough
    }
    setAccount(null);
    setOnArc(false);
    setError(null);
    setStatus("disconnected");
  }, [provider]);

  const payObol = useCallback(
    async (amountUsdc: number): Promise<string> => {
      if (!provider || !account) throw new Error("Connect a wallet first.");
      if (!obol?.address) throw new Error("Obol's wallet is not available yet.");
      await ensureArc(provider);
      // Build the USDC payment; the wallet prompts the user to sign it.
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        // toFixed(6) guarantees ≤6 decimals — `String(0.0115)` float artifacts
        // would otherwise make parseUnits throw on odd cost-plus-markup amounts.
        args: [obol.address as `0x${string}`, parseUnits(amountUsdc.toFixed(6), 6)],
      });
      return (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: ARC.usdc, data }],
      })) as string;
    },
    [provider, account, obol],
  );

  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts[0] ?? null);
      if (accounts.length === 0) setStatus("disconnected");
    };
    const onChain = (...args: unknown[]) => {
      const chainId = String(args[0] ?? "");
      setOnArc(chainId.toLowerCase() === ARC.chainIdHex.toLowerCase());
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  return (
    <WalletContext.Provider
      value={{ status, account, onArc, error, obol, connect, disconnect, refreshObol, payObol }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
