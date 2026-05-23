/** Arc testnet network constants — public network parameters, safe in the browser. */
export const ARC = {
  chainId: 5042002,
  chainIdHex: "0x4CEF52",
  chainName: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  /** USDC ERC-20 interface on Arc (6 decimals). */
  usdc: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  faucet: "https://faucet.circle.com",
} as const;

/** The network object MetaMask expects for `wallet_addEthereumChain`. */
export const ARC_NETWORK_PARAMS = {
  chainId: ARC.chainIdHex,
  chainName: ARC.chainName,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [ARC.rpcUrl],
  blockExplorerUrls: [ARC.explorer],
};

export const addressUrl = (address: string): string => `${ARC.explorer}/address/${address}`;
export const txUrl = (hash: string): string => `${ARC.explorer}/tx/${hash}`;
