import test from "node:test";
import assert from "node:assert/strict";

import {
  FaucetCooldownError,
  reserveFaucetClaim,
  reserveFaucetIpClaim,
  rollbackFaucetClaim,
  rollbackFaucetIpClaim,
} from "../lib/db-store.ts";

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

type RedisBody = {
  result?: unknown;
  error?: string;
};

function jsonResponse(body: RedisBody, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(handler: (command: unknown[]) => RedisBody) {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    const body = JSON.parse(String(init?.body ?? "[]")) as unknown[];
    return jsonResponse(handler(body));
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function withRedisEnv(fn: () => Promise<void>) {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

  return fn().finally(() => {
    if (previousUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    }

    if (previousToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    }
  });
}

test("reserveFaucetClaim reserves address cooldown through Redis SET NX PX", async () => {
  await withRedisEnv(async () => {
    const fetchMock = installFetchMock((command) => {
      assert.equal(command[0], "SET");
      assert.equal(command[1], "solidus:faucet:0xabc");
      assert.match(String(command[2]), /"address":"0xabc"/);
      assert.equal(command[3], "PX");
      assert.equal(command[4], 86_400_000);
      assert.equal(command[5], "NX");
      return { result: "OK" };
    });

    try {
      const reservedAt = await reserveFaucetClaim("0xabc", 86_400_000);
      assert.equal(typeof reservedAt, "number");
      assert.equal(fetchMock.calls.length, 1);
    } finally {
      fetchMock.restore();
    }
  });
});

test("reserveFaucetClaim throws FaucetCooldownError when Redis key already exists", async () => {
  await withRedisEnv(async () => {
    const now = Date.now();
    let callCount = 0;
    const fetchMock = installFetchMock((command) => {
      callCount += 1;

      if (callCount === 1) {
        assert.deepEqual(command.slice(0, 2), ["SET", "solidus:faucet:0xdef"]);
        return { result: null };
      }

      assert.deepEqual(command, ["GET", "solidus:faucet:0xdef"]);
      return {
        result: JSON.stringify({
          address: "0xdef",
          lastClaimedAt: now - 1_000,
        }),
      };
    });

    try {
      await assert.rejects(
        () => reserveFaucetClaim("0xdef", 86_400_000),
        (error: unknown) => {
          assert.ok(error instanceof FaucetCooldownError);
          assert.ok(error.retryAfterMs > 0);
          return true;
        },
      );
      assert.equal(fetchMock.calls.length, 2);
    } finally {
      fetchMock.restore();
    }
  });
});

test("rollbackFaucetClaim deletes Redis reservation only when timestamp matches", async () => {
  await withRedisEnv(async () => {
    let deleted = false;
    const fetchMock = installFetchMock((command) => {
      if (command[0] === "GET") {
        return {
          result: JSON.stringify({
            address: "0x123",
            lastClaimedAt: 777,
          }),
        };
      }

      assert.deepEqual(command, ["DEL", "solidus:faucet:0x123"]);
      deleted = true;
      return { result: 1 };
    });

    try {
      await rollbackFaucetClaim("0x123", 777);
      assert.equal(deleted, true);
    } finally {
      fetchMock.restore();
    }
  });
});

test("reserveFaucetIpClaim reserves IP cooldown through Redis", async () => {
  await withRedisEnv(async () => {
    const fetchMock = installFetchMock((command) => {
      assert.equal(command[0], "SET");
      assert.equal(command[1], "solidus:faucet:ip:203.0.113.7");
      assert.match(String(command[2]), /^\d+$/);
      assert.equal(command[3], "PX");
      assert.equal(command[4], 86_400_000);
      assert.equal(command[5], "NX");
      return { result: "OK" };
    });

    try {
      const reservedAt = await reserveFaucetIpClaim("203.0.113.7", 86_400_000);
      assert.equal(typeof reservedAt, "number");
      assert.equal(fetchMock.calls.length, 1);
    } finally {
      fetchMock.restore();
    }
  });
});

test("rollbackFaucetIpClaim does not delete when stored timestamp differs", async () => {
  await withRedisEnv(async () => {
    let deleteCalled = false;
    const fetchMock = installFetchMock((command) => {
      if (command[0] === "GET") {
        return { result: "111" };
      }

      deleteCalled = true;
      return { result: 1 };
    });

    try {
      await rollbackFaucetIpClaim("203.0.113.8", 222);
      assert.equal(deleteCalled, false);
    } finally {
      fetchMock.restore();
    }
  });
});
