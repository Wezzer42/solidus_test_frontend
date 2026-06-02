import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { addresses, flowAbi } from "../../../lib/contracts";
import { getFaucetClaim, setFaucetClaim } from "../../../lib/db-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const faucetAmount = parseEther("1000000");
const cooldownMs = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const privateKey = process.env.FAUCET_PRIVATE_KEY;
    const rpcUrl = process.env.BASE_SEPOLIA_RPC || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC;
    if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Faucet private key is not configured." }, { status: 500 });
    }
    if (!rpcUrl) {
      return NextResponse.json({ error: "Base Sepolia RPC is not configured." }, { status: 500 });
    }
    if (!addresses.flow) {
      return NextResponse.json({ error: "FLOW contract address is not configured." }, { status: 500 });
    }

    const faucetAccount = privateKeyToAccount(privateKey as `0x${string}`);
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    const remaining = await client.readContract({
      address: addresses.flow,
      abi: flowAbi,
      functionName: "balanceOf",
      args: [faucetAccount.address],
    });

    return NextResponse.json({
      remaining: remaining.toString(),
      faucetAmount: faucetAmount.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Faucet status failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { address?: string };
    const address = body.address;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
    }

    const privateKey = process.env.FAUCET_PRIVATE_KEY;
    const rpcUrl = process.env.BASE_SEPOLIA_RPC || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC;

    if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Faucet private key is not configured." }, { status: 500 });
    }
    if (!rpcUrl) {
      return NextResponse.json({ error: "Base Sepolia RPC is not configured." }, { status: 500 });
    }
    if (!addresses.flow) {
      return NextResponse.json({ error: "FLOW contract address is not configured." }, { status: 500 });
    }

    const key = address.toLowerCase();
    const previous = (await getFaucetClaim(key))?.lastClaimedAt || 0;
    const now = Date.now();
    if (now - previous < cooldownMs) {
      const hoursLeft = Math.ceil((cooldownMs - (now - previous)) / (60 * 60 * 1000));
      return NextResponse.json({ error: `Faucet cooldown active. Try again in about ${hoursLeft}h.` }, { status: 429 });
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const hash = await walletClient.writeContract({
      address: addresses.flow,
      abi: flowAbi,
      functionName: "transfer",
      args: [address, faucetAmount],
    });

    await setFaucetClaim(key, hash);
    return NextResponse.json({ hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Faucet request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
