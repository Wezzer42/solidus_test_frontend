import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type FaucetClaimEntry = {
  address: string;
  lastClaimedAt: number;
  txHash?: string;
};

type SolidusDb = {
  faucetClaims: Record<string, FaucetClaimEntry>;
};

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "solidus-db.json");

async function readDb(): Promise<SolidusDb> {
  try {
    const raw = await readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SolidusDb>;
    return {
      faucetClaims: parsed.faucetClaims && typeof parsed.faucetClaims === "object" ? parsed.faucetClaims : {},
    };
  } catch {
    return { faucetClaims: {} };
  }
}

async function writeDb(db: SolidusDb) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export async function getFaucetClaim(address: string): Promise<FaucetClaimEntry | undefined> {
  const key = address.toLowerCase();
  return (await readDb()).faucetClaims[key];
}

export async function setFaucetClaim(address: string, txHash: string) {
  const key = address.toLowerCase();
  const db = await readDb();
  db.faucetClaims[key] = {
    address: key,
    lastClaimedAt: Date.now(),
    txHash,
  };
  await writeDb(db);
}
