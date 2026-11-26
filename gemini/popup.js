const statusEl = document.getElementById("status");
const ALLOWED = ["https://gemini.google.com/"];

function slug(s) {
  return (s || "gemini-chat").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "gemini-chat";
}

function toMarkdown(data) {
  const parts = [`# ${data.title}\n`];
  for (const m of data.messages) {
    parts.push(`## ${m.role === "user" ? "You" : "Gemini"}\n`);
    parts.push(m.content + "\n");
  }
  return parts.join("\n");
}

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function run(format) {
  statusEl.textContent = "Loading the full chat…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !ALLOWED.some((p) => tab.url.startsWith(p))) {
    statusEl.textContent = "Open a conversation on gemini.google.com first.";
    return;
  }
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { action: "collect" });
  } catch {
    statusEl.textContent = "Reload the Gemini tab once, then try again.";
    return;
  }
  if (!res?.ok) {
    statusEl.textContent = "Error: " + (res?.error || "unknown");
    return;
  }
  const data = res.data;
  const base = slug(data.title);
  if (format === "md") {
    download(base + ".md", toMarkdown(data), "text/markdown");
  } else {
    const out = { ...data, messages: data.messages.map(({ thinking, ...rest }) => rest) };
    download(base + ".json", JSON.stringify(out, null, 2), "application/json");
  }
  statusEl.textContent = `Saved ${data.messages.length} messages.`;
}

document.getElementById("md").onclick = () => run("md");
document.getElementById("json").onclick = () => run("json");
