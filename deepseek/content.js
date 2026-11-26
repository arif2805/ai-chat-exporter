// Runs inside chat.deepseek.com. Collects the open chat and returns it to the popup.

function getChatId() {
  const m = location.pathname.match(/\/chat\/s\/([\w-]+)/);
  return m ? m[1] : null;
}

function getToken() {
  try {
    const raw = localStorage.getItem("userToken");
    if (!raw) return null;
    try {
      const p = JSON.parse(raw);
      return typeof p === "string" ? p : p.value || null;
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

// Method 1: the same internal endpoint the DeepSeek web app itself uses.
async function fromApi(chatId) {
  const token = getToken();
  if (!token) throw new Error("No session token found (are you logged in?)");

  const res = await fetch(
    `/api/v0/chat/history_messages?chat_session_id=${encodeURIComponent(chatId)}`,
    { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }
  );
  if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);

  const json = await res.json();
  const biz = json?.data?.biz_data;
  const list = biz?.chat_messages;
  if (!Array.isArray(list)) throw new Error("Unexpected API response shape");

  const messages = list.map((m) => {
    let content = "";
    let thinking = "";
    if (Array.isArray(m.fragments)) {
      // newer format
      for (const f of m.fragments) {
        const type = String(f.type || "").toUpperCase();
        if (type.includes("THINK")) thinking += f.content || "";
        else if (type.includes("SEARCH")) continue;
        else content += f.content || "";
      }
    } else {
      // older format
      content = m.content || "";
      thinking = m.thinking_content || "";
    }
    return {
      role: String(m.role).toUpperCase() === "USER" ? "user" : "assistant",
      content,
      thinking,
    };
  });

  return { title: biz?.chat_session?.title || document.title, messages };
}

// Method 2 (fallback): best-effort scrape of the rendered page.
function fromDom() {
  const answers = [...document.querySelectorAll(".ds-markdown")];
  if (!answers.length) throw new Error("Could not find any messages on the page");

  const messages = [];
  for (const a of answers) {
    // walk up until we find a container whose previous sibling holds the user prompt
    let node = a;
    let prompt = "";
    for (let i = 0; i < 8 && node && !prompt; i++) {
      const prev = node.previousElementSibling;
      if (prev && !prev.querySelector(".ds-markdown") && prev.innerText.trim()) {
        prompt = prev.innerText.trim();
      }
      node = node.parentElement;
    }
    if (prompt && !messages.some((m) => m.role === "user" && m.content === prompt)) {
      messages.push({ role: "user", content: prompt, thinking: "" });
    }
    messages.push({ role: "assistant", content: a.innerText.trim(), thinking: "" });
  }
  return { title: document.title, messages };
}

async function collect() {
  const chatId = getChatId();
  if (!chatId) throw new Error("Open a specific chat first (URL should contain /chat/s/...)");
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
