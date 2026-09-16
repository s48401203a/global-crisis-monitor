/** HTTP / WebSocket 访问令牌状态机。不把长期令牌写进 WS URL，改用短期 ticket。 */

const TOKEN_KEY = "crisis_access_token";
const MAX_PROMPT_TRIES = 3;

export function createAuthController(opts = {}) {
  const storage = opts.storage || {
    getItem: (k) => {
      try {
        return sessionStorage.getItem(k);
      } catch {
        return "";
      }
    },
    setItem: (k, v) => {
      try {
        sessionStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
    removeItem: (k) => {
      try {
        sessionStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
  const promptFn =
    opts.promptFn ||
    ((msg) => (typeof window !== "undefined" && window.prompt ? window.prompt(msg, "") : null));
  const langFn = opts.langFn || (() => "zh");

  let denied = false;
  let promptOpen = false;
  let tries = 0;
  const listeners = new Set();

  function emit() {
    for (const fn of listeners) fn(snapshot());
  }

  function snapshot() {
    return {
      denied,
      promptOpen,
      tries,
      hasToken: Boolean(getToken()),
    };
  }

  function getToken() {
    return storage.getItem(TOKEN_KEY) || "";
  }

  function setToken(value) {
    const v = String(value || "").trim();
    if (v) storage.setItem(TOKEN_KEY, v);
    else storage.removeItem(TOKEN_KEY);
    denied = false;
    emit();
    return v;
  }

  function noteSuccess() {
    tries = 0;
    denied = false;
    emit();
  }

  function clearToken() {
    storage.removeItem(TOKEN_KEY);
    emit();
  }

  function allowReconnect() {
    return !denied;
  }

  function markDenied() {
    denied = true;
    emit();
  }

  function resetDenied() {
    denied = false;
    tries = 0;
    emit();
  }

  function promptMessage(kind) {
    const en = langFn() === "en";
    if (kind === "invalid") {
      return en
        ? "Access token rejected. Enter ACCESS_TOKEN, or Cancel to stop retrying:"
        : "访问令牌无效。请输入 ACCESS_TOKEN，或取消以停止重试：";
    }
    if (kind === "expired") {
      return en
        ? "Session expired. Enter ACCESS_TOKEN, or Cancel to stop retrying:"
        : "访问已过期。请输入 ACCESS_TOKEN，或取消以停止重试：";
    }
    return en
      ? "This instance requires an access token (ACCESS_TOKEN):"
      : "此实例需要访问令牌（ACCESS_TOKEN）：";
  }

  async function promptForToken(kind = "missing") {
    if (denied) return { ok: false, cancelled: true };
    if (promptOpen) return { ok: false, busy: true };
    if (tries >= MAX_PROMPT_TRIES) {
      denied = true;
      emit();
      return { ok: false, locked: true };
    }
    promptOpen = true;
    emit();
    let entered = null;
    try {
      entered = promptFn(promptMessage(kind));
    } finally {
      promptOpen = false;
    }
    if (entered == null || String(entered).trim() === "") {
      denied = true;
      emit();
      return { ok: false, cancelled: true };
    }
    tries += 1;
    setToken(entered);
    return { ok: true, token: getToken() };
  }

  function noteInvalidCredentials() {
    clearToken();
    return promptForToken("invalid");
  }

  function applyHeaders(headers) {
    const h = headers instanceof Headers ? headers : new Headers(headers || {});
    const tok = getToken();
    if (tok) h.set("X-Access-Token", tok);
    return h;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    getToken,
    setToken,
    clearToken,
    allowReconnect,
    markDenied,
    resetDenied,
    noteSuccess,
    promptForToken,
    noteInvalidCredentials,
    applyHeaders,
    onChange,
    snapshot,
    TOKEN_KEY,
    MAX_PROMPT_TRIES,
  };
}

export const auth = createAuthController();
