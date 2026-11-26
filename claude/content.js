// Runs inside claude.ai. Collects the open conversation and returns it to the popup.

function getChatId() {
  const m = location.pathname.match(/\/chat\/([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

async function getJson(url) {
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.split("?")[0]}`);
  return res.json();
}

// The conversation belongs to one organization; try each one the account has.
async function fetchConversation(chatId) {
  const orgs = await getJson("/api/organizations");
  if (!Array.isArray(orgs) || !orgs.length) throw new Error("No organization found (are you logged in?)");

  let lastErr = null;
  for (const org of orgs) {
    try {
      return await getJson(
        `/api/organizations/${org.uuid}/chat_conversations/${encodeURIComponent(chatId)}?tree=True&rendering_mode=messages&render_all_tools=true`
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Conversation not found");
}

// Method 1: the same internal endpoints the Claude web app itself uses.
async function fromApi(chatId) {
  const json = await fetchConversation(chatId);
  const all = json?.chat_messages;
  if (!Array.isArray(all)) throw new Error("Unexpected API response shape");

  // Export only the active branch: walk from the last message back to the root.
  let list = all;
  if (json.current_leaf_message_uuid) {
    const byId = new Map(all.map((m) => [m.uuid, m]));
    const chain = [];
    let cur = byId.get(json.current_leaf_message_uuid);
    while (cur) {
      chain.push(cur);
      cur = byId.get(cur.parent_message_uuid);
    }
    if (chain.length) list = chain.reverse();
  }

  const messages = [];
  for (const m of list) {
    let content = "";
    let thinking = "";
    if (Array.isArray(m.content) && m.content.length) {
      for (const block of m.content) {
        if (block.type === "text" && block.text) content += (content ? "\n\n" : "") + block.text;
        else if (block.type === "thinking" && block.thinking) thinking += (thinking ? "\n\n" : "") + block.thinking;
        // tool calls and results are skipped
      }
    } else {
      content = m.text || "";
    }
    content = content.trim();
    if (!content) continue;
    messages.push({
      role: m.sender === "human" ? "user" : "assistant",
      content,
      thinking: m.sender === "human" ? "" : thinking,
    });
  }

  return { title: json.name || document.title, messages };
}

// Method 2 (fallback): best-effort scrape of the rendered page.
function fromDom() {
  const nodes = [
    ...document.querySelectorAll('[data-testid="user-message"], .font-claude-response, .font-claude-message'),
  ];
  if (!nodes.length) throw new Error("Could not find any messages on the page");
  const messages = nodes.map((n) => ({
    role: n.matches('[data-testid="user-message"]') ? "user" : "assistant",
    content: n.innerText.trim(),
    thinking: "",
  }));
  return { title: document.title, messages };
}

async function collect() {
  const chatId = getChatId();
  if (!chatId) throw new Error("Open a specific chat first (URL should contain /chat/...)");
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
