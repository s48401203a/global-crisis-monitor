import { describe, expect, it } from "vite-plus/test";
import { createAuthController } from "../../src/api/auth.js";

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
    data,
  };
}

describe("auth controller", () => {
  it("attaches the stored token to headers", () => {
    const auth = createAuthController({
      storage: memoryStorage({ crisis_access_token: "abc" }),
      promptFn: () => null,
    });
    const h = auth.applyHeaders(new Headers());
    expect(h.get("X-Access-Token")).toBe("abc");
  });

  it("canceling the prompt stops reconnects and does not loop", async () => {
    let n = 0;
    const auth = createAuthController({
      storage: memoryStorage(),
      promptFn: () => {
        n += 1;
        return null;
      },
    });
    const a = await auth.promptForToken("missing");
    const b = await auth.promptForToken("missing");
    expect(a.cancelled).toBe(true);
    expect(b.cancelled).toBe(true);
    expect(n).toBe(1);
    expect(auth.allowReconnect()).toBe(false);
  });

  it("invalid credentials clear the token and prompt again until max tries", async () => {
    let n = 0;
    const auth = createAuthController({
      storage: memoryStorage({ crisis_access_token: "old" }),
      promptFn: () => {
        n += 1;
        return n === 1 ? "new-token" : "";
      },
    });
    const r = await auth.noteInvalidCredentials();
    expect(r.ok).toBe(true);
    expect(auth.getToken()).toBe("new-token");
    const r2 = await auth.noteInvalidCredentials();
    expect(r2.cancelled || r2.ok === false).toBe(true);
    expect(n).toBe(2);
  });

  it("locks after MAX_PROMPT_TRIES prompts without a successful request", async () => {
    const auth = createAuthController({
      storage: memoryStorage(),
      promptFn: () => "x",
    });
    expect((await auth.promptForToken()).ok).toBe(true);
    expect((await auth.promptForToken()).ok).toBe(true);
    expect((await auth.promptForToken()).ok).toBe(true);
    const last = await auth.promptForToken();
    expect(last.locked).toBe(true);
    expect(auth.allowReconnect()).toBe(false);
    auth.noteSuccess();
    expect(auth.allowReconnect()).toBe(true);
  });
});
