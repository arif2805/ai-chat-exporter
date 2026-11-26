// Runs inside gemini.google.com. Gemini's internal chat data is obfuscated, so this
// extension reads the rendered page instead and converts the HTML to Markdown.

function getChatId() {
  const m = location.pathname.match(/\/app\/([\w-]+)/);
  return m ? m[1] : null;
}

// ---- HTML -> Markdown (small, dependency-free) ----
function toMd(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (["script", "style", "button", "svg", "mat-icon"].includes(tag)) return "";
  const kids = () => [...node.childNodes].map(toMd).join("");

  switch (tag) {
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
      return "\n\n" + "#".repeat(Number(tag[1])) + " " + kids().trim() + "\n\n";
    case "p":
      return "\n\n" + kids().trim() + "\n\n";
    case "br":
      return "\n";
    case "strong": case "b":
      return "**" + kids().trim() + "**";
    case "em": case "i":
      return "*" + kids().trim() + "*";
    case "a":
      return "[" + kids().trim() + "](" + (node.getAttribute("href") || "") + ")";
    case "code":
      return node.closest("pre") ? node.textContent : "`" + node.textContent + "`";
    case "code-block": {
      const pre = node.querySelector("pre");
      const label = node.querySelector(".code-block-decoration span");
      const lang = label ? label.textContent.trim().toLowerCase().replace(/\s+/g, "") : "";
      const text = (pre ? pre.textContent : node.textContent).replace(/\n$/, "");
      return "\n\n```" + lang + "\n" + text + "\n```\n\n";
    }
    case "pre": {
      const code = node.querySelector("code");
      const lang = ((code && code.className.match(/language-([\w-]+)/)) || [])[1] || "";
      return "\n\n```" + lang + "\n" + node.textContent.replace(/\n$/, "") + "\n```\n\n";
    }
    case "ul": case "ol": {
      const items = [...node.children].filter((c) => c.tagName === "LI");
      const lines = items.map(
        (li, i) => (tag === "ol" ? i + 1 + ". " : "- ") + toMd(li).trim().replace(/\n/g, "\n  ")
      );
      return "\n\n" + lines.join("\n") + "\n\n";
    }
    case "blockquote":
      return "\n\n" + kids().trim().split("\n").map((l) => "> " + l).join("\n") + "\n\n";
    case "hr":
      return "\n\n---\n\n";
    case "table": {
      const rows = [...node.querySelectorAll("tr")].map((tr) =>
        [...tr.children].map((c) => toMd(c).trim().replace(/\|/g, "\\|").replace(/\n/g, " "))
      );
      if (!rows.length) return "";
      const out = rows.map((r) => "| " + r.join(" | ") + " |");
      out.splice(1, 0, "| " + Array(rows[0].length).fill("---").join(" | ") + " |");
      return "\n\n" + out.join("\n") + "\n\n";
    }
    default:
      return kids();
  }
}

function htmlToMarkdown(el) {
  return toMd(el).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---- Load the whole chat (Gemini loads older messages as you scroll up) ----
function getScroller() {
  let el = document.querySelector("user-query");
  while (el && el !== document.body) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return null;
}

async function loadAll() {
  const scroller = getScroller();
  if (!scroller) return;
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    scroller.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 600));
    const n = document.querySelectorAll("user-query").length;
    stable = n === last ? stable + 1 : 0;
    last = n;
  }
  scroller.scrollTop = scroller.scrollHeight;
}

function getTitle(firstUserText) {
  const sel = document.querySelector(
    '[data-test-id="conversation"].selected, .conversation.selected, .conversation-items-container .selected'
  );
  const t = sel && sel.innerText ? sel.innerText.trim().split("\n")[0] : "";
  if (t) return t;
  if (firstUserText) return firstUserText.slice(0, 60).replace(/\s+/g, " ");
  return "Gemini chat";
}

async function collect() {
  const chatId = getChatId();
  if (!chatId) throw new Error("Open a specific chat first (URL should contain /app/...)");

  await loadAll();

  const nodes = [...document.querySelectorAll("user-query, model-response")];
  if (!nodes.length) throw new Error("Could not find any messages on the page");

  const messages = [];
  for (const n of nodes) {
    if (n.tagName.toLowerCase() === "user-query") {
      const q = n.querySelector(".query-text") || n;
      const content = q.innerText.replace(/^\s*You said\s*/i, "").trim();
      if (content) messages.push({ role: "user", content, thinking: "" });
    } else {
      const body = n.querySelector("message-content") || n;
      const content = htmlToMarkdown(body);
      if (content) messages.push({ role: "assistant", content, thinking: "" });
    }
  }
  if (!messages.length) throw new Error("Found message containers but no text");

  const firstUser = (messages.find((m) => m.role === "user") || {}).content;
  return { title: getTitle(firstUser), chatId, messages, source: "dom" };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action !== "collect") return;
  collect()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // async response
});
