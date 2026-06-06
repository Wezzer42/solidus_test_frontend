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
let faucetClaimMutex = Promise.resolve();
const faucetRedisKeyPrefix = "solidus:faucet:";
const faucetIpRedisKeyPrefix = "solidus:faucet:ip:";

export class FaucetCooldownError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Faucet cooldown active.");
    this.name = "FaucetCooldownError";
    this.retryAfterMs = retryAfterMs;
  }
}

type RedisResult<T> = {
  result?: T;
  error?: string;
};

function getRedisConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim() ||
    process.env.KV_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.KV_TOKEN?.trim();

  if (!url || !token) return undefined;
  return { url, token };
}

function shouldUseRedis() {
  if (getRedisConfig()) return true;
  if (process.env.VERCEL) {
    throw new Error("Redis is not configured for this Vercel deployment.");
  }
  return false;
}

async function runRedisCommand<T>(command: Array<string | number>): Promise<T> {
  const config = getRedisConfig();
  if (!config) {
    throw new Error("Redis is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  const body = (await response.json()) as RedisResult<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error || `Redis request failed with status ${response.status}.`);
  }

  return body.result as T;
}

function faucetRedisKey(address: string) {
  return `${faucetRedisKeyPrefix}${address.toLowerCase()}`;
}

function faucetIpRedisKey(ip: string) {
  return `${faucetIpRedisKeyPrefix}${ip}`;
}

async function getRedisFaucetClaim(address: string): Promise<FaucetClaimEntry | undefined> {
  const raw = await runRedisCommand<string | null>(["GET", faucetRedisKey(address)]);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as FaucetClaimEntry;
    if (!parsed || typeof parsed.lastClaimedAt !== "number") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

async function reserveRedisFaucetClaim(address: string, cooldownMs: number): Promise<number> {
  const now = Date.now();
  const key = faucetRedisKey(address);
  const payload = JSON.stringify({
    address: address.toLowerCase(),
    lastClaimedAt: now,
  } satisfies FaucetClaimEntry);

  const reserved = await runRedisCommand<"OK" | null>(["SET", key, payload, "PX", cooldownMs, "NX"]);
  if (reserved === "OK") return now;

  const existing = await getRedisFaucetClaim(address);
  const retryAfterMs = existing ? Math.max(cooldownMs - (Date.now() - existing.lastClaimedAt), 1) : cooldownMs;
  throw new FaucetCooldownError(retryAfterMs);
}

async function finalizeRedisFaucetClaim(address: string, lastClaimedAt: number, txHash: string, cooldownMs: number) {
  const ttlMs = Math.max(cooldownMs - (Date.now() - lastClaimedAt), 1);
  const payload = JSON.stringify({
    address: address.toLowerCase(),
    lastClaimedAt,
    txHash,
  } satisfies FaucetClaimEntry);

  await runRedisCommand(["SET", faucetRedisKey(address), payload, "PX", ttlMs, "XX"]);
}

async function rollbackRedisFaucetClaim(address: string, lastClaimedAt: number) {
  const current = await getRedisFaucetClaim(address);
  if (!current || current.lastClaimedAt !== lastClaimedAt) return;
  await runRedisCommand(["DEL", faucetRedisKey(address)]);
}

async function reserveRedisFaucetIpClaim(ip: string, cooldownMs: number): Promise<number> {
  const now = Date.now();
  const reserved = await runRedisCommand<"OK" | null>(["SET", faucetIpRedisKey(ip), now.toString(), "PX", cooldownMs, "NX"]);
  if (reserved === "OK") return now;

  const existing = await runRedisCommand<string | null>(["GET", faucetIpRedisKey(ip)]);
  const previous = existing ? Number(existing) : undefined;
  const retryAfterMs = previous ? Math.max(cooldownMs - (Date.now() - previous), 1) : cooldownMs;
  throw new FaucetCooldownError(retryAfterMs);
}

async function rollbackRedisFaucetIpClaim(ip: string, lastClaimedAt: number) {
  const existing = await runRedisCommand<string | null>(["GET", faucetIpRedisKey(ip)]);
  if (!existing || Number(existing) !== lastClaimedAt) return;
  await runRedisCommand(["DEL", faucetIpRedisKey(ip)]);
}

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
  if (shouldUseRedis()) {
    return getRedisFaucetClaim(key);
  }
  return (await readDb()).faucetClaims[key];
}

export async function reserveFaucetClaim(address: string, cooldownMs: number): Promise<number> {
  if (shouldUseRedis()) {
    return reserveRedisFaucetClaim(address, cooldownMs);
  }

  const key = address.toLowerCase();
  const operation = faucetClaimMutex.then(async () => {
    const db = await readDb();
    const previous = db.faucetClaims[key];
    const now = Date.now();

    if (previous && now - previous.lastClaimedAt < cooldownMs) {
      throw new FaucetCooldownError(cooldownMs - (now - previous.lastClaimedAt));
    }

    db.faucetClaims[key] = {
      address: key,
      lastClaimedAt: now,
      txHash: previous?.txHash,
    };
    await writeDb(db);
    return now;
  });

  faucetClaimMutex = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

export async function finalizeFaucetClaim(address: string, lastClaimedAt: number, txHash: string, cooldownMs: number) {
  if (shouldUseRedis()) {
    await finalizeRedisFaucetClaim(address, lastClaimedAt, txHash, cooldownMs);
    return;
  }

  const key = address.toLowerCase();
  const operation = faucetClaimMutex.then(async () => {
    const db = await readDb();
    db.faucetClaims[key] = {
      address: key,
      lastClaimedAt,
      txHash,
    };
    await writeDb(db);
  });

  faucetClaimMutex = operation.then(
    () => undefined,
    () => undefined,
  );

  await operation;
}

export async function rollbackFaucetClaim(address: string, lastClaimedAt: number) {
  if (shouldUseRedis()) {
    await rollbackRedisFaucetClaim(address, lastClaimedAt);
    return;
  }

  const key = address.toLowerCase();
  const operation = faucetClaimMutex.then(async () => {
    const db = await readDb();
    const current = db.faucetClaims[key];
    if (!current || current.lastClaimedAt !== lastClaimedAt) return;
    delete db.faucetClaims[key];
    await writeDb(db);
  });

  faucetClaimMutex = operation.then(
    () => undefined,
    () => undefined,
  );

  await operation;
}

export async function reserveFaucetIpClaim(ip: string, cooldownMs: number): Promise<number> {
  if (shouldUseRedis()) {
    return reserveRedisFaucetIpClaim(ip, cooldownMs);
  }

  const key = `ip:${ip}`;
  const operation = faucetClaimMutex.then(async () => {
    const db = await readDb();
    const previous = db.faucetClaims[key];
    const now = Date.now();

    if (previous && now - previous.lastClaimedAt < cooldownMs) {
      throw new FaucetCooldownError(cooldownMs - (now - previous.lastClaimedAt));
    }

    db.faucetClaims[key] = {
      address: key,
      lastClaimedAt: now,
      txHash: previous?.txHash,
    };
    await writeDb(db);
    return now;
  });

  faucetClaimMutex = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

export async function rollbackFaucetIpClaim(ip: string, lastClaimedAt: number) {
  if (shouldUseRedis()) {
    await rollbackRedisFaucetIpClaim(ip, lastClaimedAt);
    return;
  }

  const key = `ip:${ip}`;
  const operation = faucetClaimMutex.then(async () => {
    const db = await readDb();
    const current = db.faucetClaims[key];
    if (!current || current.lastClaimedAt !== lastClaimedAt) return;
    delete db.faucetClaims[key];
    await writeDb(db);
  });

  faucetClaimMutex = operation.then(
    () => undefined,
    () => undefined,
  );

  await operation;
}
