"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet, polygon, bsc, arbitrum, base, sepolia } from "viem/chains";
import { ReactNode } from "react";
import { metaMask } from "wagmi/connectors";

export const connectors = [
  metaMask({
    infuraAPIKey: process.env.NEXT_PUBLIC_INFURA_API_KEY,
  }),
];

const queryClient = new QueryClient();

// 支持的所有链
const supportedChains = [mainnet, polygon, bsc, arbitrum, base, sepolia] as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors,
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
});

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
