// Runs inside chatgpt.com. Collects the open conversation and returns it to the popup.

function getChatId() {
  const m = location.pathname.match(/\/c\/([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

// Removes ChatGPT's internal citation markers (private-use characters).
function clean(text) {
  return String(text || "")
    .replace(/[\s\S]*?/g, "")
    .replace(/[-]/g, "")
    .trim();
}

async function getToken() {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) throw new Error(`Session request failed (HTTP ${res.status})`);
  const json = await res.json();
  if (!json?.accessToken) throw new Error("No session token found (are you logged in?)");
  return json.accessToken;
}

function partsToText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof p === "string" ? p : p && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n\n");
}

// Method 1: the same internal endpoint the ChatGPT web app itself uses.
async function fromApi(chatId) {
  const token = await getToken();
  const res = await fetch(`/backend-api/conversation/${encodeURIComponent(chatId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);

  const json = await res.json();
  const mapping = json?.mapping;
  if (!mapping || !json.current_node) throw new Error("Unexpected API response shape");

  // Walk from the last message back to the root, so only the active branch is exported.
  const chain = [];
  let id = json.current_node;
  while (id && mapping[id]) {
    chain.push(mapping[id]);
    id = mapping[id].parent;
  }
  chain.reverse();

  const messages = [];
  let pendingThinking = "";

  for (const node of chain) {
    const msg = node.message;
    if (!msg) continue;
    if (msg.metadata?.is_visually_hidden_from_conversation) continue;

    const role = msg.author?.role;
    const type = msg.content?.content_type;

    // Reasoning from thinking models: keep it, attach it to the next answer.
    if (role === "assistant" && type === "thoughts") {
      const t = (msg.content.thoughts || [])
        .map((x) => [x.summary, x.content].filter(Boolean).join(": "))
        .join("\n\n");
      if (t) pendingThinking += (pendingThinking ? "\n\n" : "") + clean(t);
      continue;
    }

    if (role !== "user" && role !== "assistant") continue;

    let content = "";
    if (type === "text" || type === "multimodal_text") {
      content = clean(partsToText(msg.content.parts));
    } else if (type === "code") {
      const lang = msg.content.language && msg.content.language !== "unknown" ? msg.content.language : "";
      content = "```" + lang + "\n" + (msg.content.text || "") + "\n```";
    } else {
      continue; // reasoning recaps, tool output, etc.
    }
    if (!content) continue;

    messages.push({
      role,
      content,
      thinking: role === "assistant" ? pendingThinking : "",
    });
    if (role === "assistant") pendingThinking = "";
  }

  return { title: json.title || document.title, messages };
}

// Method 2 (fallback): best-effort scrape of the rendered page.
function fromDom() {
  const nodes = [...document.querySelectorAll("[data-message-author-role]")];
  if (!nodes.length) throw new Error("Could not find any messages on the page");
  const messages = nodes.map((n) => ({
    role: n.getAttribute("data-message-author-role") === "user" ? "user" : "assistant",
    content: n.innerText.trim(),
    thinking: "",
  }));
  return { title: document.title, messages };
}

async function collect() {
  const chatId = getChatId();
  if (!chatId) throw new Error("Open a specific conversation first (URL should contain /c/...)");
  try {
    const data = await fromApi(chatId);
    return { ...data, chatId, source: "api" };
  } catch (apiErr) {
    const data = fromDom();
    return { ...data, chatId, source: "dom (fallback: " + apiErr.message + ")" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action !== "collect") return;
  collect()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // async response
});
