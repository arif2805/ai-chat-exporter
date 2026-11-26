const statusEl = document.getElementById("status");

function slug(s) {
  return (s || "deepseek-chat").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "deepseek-chat";
}

function toMarkdown(data, withThinking) {
  const parts = [`# ${data.title}\n`];
  for (const m of data.messages) {
    parts.push(`## ${m.role === "user" ? "You" : "DeepSeek"}\n`);
    if (withThinking && m.thinking) {
      parts.push(`<details><summary>Thinking</summary>\n\n${m.thinking}\n\n</details>\n`);
    }
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
  statusEl.textContent = "Collecting…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("https://chat.deepseek.com/")) {
    statusEl.textContent = "Open a chat on chat.deepseek.com first.";
    return;
  }
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { action: "collect" });
  } catch {
    statusEl.textContent = "Reload the DeepSeek tab once, then try again.";
    return;
  }
  if (!res?.ok) {
    statusEl.textContent = "Error: " + (res?.error || "unknown");
    return;
  }
  const withThinking = document.getElementById("thinking").checked;
  const data = res.data;
  const base = slug(data.title);
  if (format === "md") {
    download(base + ".md", toMarkdown(data, withThinking), "text/markdown");
  } else {
    const out = withThinking
      ? data
      : { ...data, messages: data.messages.map(({ thinking, ...rest }) => rest) };
    download(base + ".json", JSON.stringify(out, null, 2), "application/json");
  }
  statusEl.textContent = `Saved ${data.messages.length} messages (source: ${data.source.split(" ")[0]}).`;
}

document.getElementById("md").onclick = () => run("md");
document.getElementById("json").onclick = () => run("json");
