import { LocalAccount } from "viem";
import { CreateHeaders } from "../../verify";
import { SignerWallet } from "./evm";
import { Money } from "./money";
import { Network } from "./network";
import { Resource } from "./resource";

export type FacilitatorConfig = {
  url: Resource;
  createAuthHeaders?: CreateHeaders;
};

export type PaymentMiddlewareConfig = {
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: object;
  customPaywallHtml?: string;
  resource?: Resource;
};

export interface ERC20TokenAmount {
  amount: string;
  asset: {
    address: `0x${string}`;
    decimals: number;
    eip712: {
      name: string;
      version: string;
    };
  };
}

export type Price = Money | ERC20TokenAmount;

export interface RouteConfig {
  price: Price;
  network: Network;
  config?: PaymentMiddlewareConfig;
}

export type RoutesConfig = Record<string, Price | RouteConfig>;

export interface RoutePattern {
  verb: string;
  pattern: RegExp;
  config: RouteConfig;
}

export type Wallet = SignerWallet | LocalAccount;
