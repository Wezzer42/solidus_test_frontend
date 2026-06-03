import type { Address } from "viem";

export const baseSepoliaId = 84532;

export const addresses = {
  flow: process.env.NEXT_PUBLIC_FLOW_ADDRESS as Address,
  prime: process.env.NEXT_PUBLIC_PRIME_ADDRESS as Address,
  reserve: process.env.NEXT_PUBLIC_RESERVE_ADDRESS as Address,
  market: process.env.NEXT_PUBLIC_PRIME_MARKET_ADDRESS as Address,
  testExchange: process.env.NEXT_PUBLIC_TEST_EXCHANGE_ADDRESS as Address,
};

export function hasContracts() {
  return [addresses.flow, addresses.prime, addresses.reserve, addresses.market].every(
    (address) => Boolean(address) && address !== "0x0000000000000000000000000000000000000000",
  );
}

export function hasTestExchange() {
  return Boolean(addresses.testExchange) && addresses.testExchange !== "0x0000000000000000000000000000000000000000";
}

export const flowAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "activeSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const testExchangeAbi = [
  {
    type: "function",
    name: "nextOrderId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "orders",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "paymentToken", type: "address" },
      { name: "flowAmount", type: "uint256" },
      { name: "paymentAmount", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "placeFlowSellOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentToken", type: "address" },
      { name: "flowAmount", type: "uint256" },
      { name: "paymentAmount", type: "uint256" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelFlowSellOrder",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fillFlowSellOrder",
    stateMutability: "payable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const primeAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "cap",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const reserveAbi = [
  {
    type: "function",
    name: "reserveBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "activeRatioBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteRedeem",
    stateMutability: "view",
    inputs: [{ name: "primeAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteRedeemFloor",
    stateMutability: "view",
    inputs: [{ name: "primeAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const marketAbi = [
  {
    type: "function",
    name: "nextOrderId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "orders",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "primeAmount", type: "uint256" },
      { name: "flowPrice", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "sellOrders",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "primeAmount", type: "uint256" },
      { name: "flowPrice", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "placePrimeSellOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "primeAmount", type: "uint256" },
      { name: "flowPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyPrimeFromUser",
    stateMutability: "nonpayable",
    inputs: [{ name: "seller", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelPrimeSellOrder",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "redeemPrime",
    stateMutability: "nonpayable",
    inputs: [{ name: "primeAmount", type: "uint256" }],
    outputs: [{ name: "flowReleased", type: "uint256" }],
  },
] as const;
