# AI Chat Exporter

Small, local browser extensions that export a single AI chat thread to Markdown or JSON, so you can keep it or continue it in a new chat.

No accounts, no servers, no third-party services. The extension reads the chat you have open, builds a file in your browser, and saves it to your downloads folder. Nothing is sent anywhere.

## Why this exists

I wanted to move one specific DeepSeek conversation into a new chat. Most exporter extensions ask for broad permissions and route data through someone else's code. For private or work-related conversations, I preferred to keep it local and be able to read every line of what runs.

Each extension is four small files, so you can check what it does in a few minutes.

## What's included

| Folder | Site | Status |
|---|---|---|
| [`deepseek/`](deepseek) | chat.deepseek.com | Tested |
| [`chatgpt/`](chatgpt) | chatgpt.com, chat.openai.com | Tested |
| [`claude/`](claude) | claude.ai | Experimental, not yet widely tested |
| [`gemini/`](gemini) | gemini.google.com | Experimental, page-based (see Limitations) |

## Install (Chrome, Edge, other Chromium browsers)

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `deepseek`, `chatgpt`, `claude` or `gemini` folder, depending on the site you want to export from. Each folder is a separate extension, and you can install any combination.

If the chat tab was already open, reload it once.

## Use

1. Open the conversation you want to export (the URL should point to a specific chat).
2. Click the extension icon.
3. Choose **Download Markdown** or **Download JSON**.

Only the conversation that is currently open is exported. Tick "Include reasoning" if you also want the model's thinking text, where the site provides it.

## Markdown or JSON?

- **Markdown** is better for continuing a conversation in a new chat. It reads naturally for a model, uses fewer tokens, and is easy to trim before pasting.
- **JSON** is better if you want to process or archive the chat with a script, since it keeps the structure (roles, messages, optional reasoning).

Tips for reusing a thread: leave the reasoning text out, and for long threads, trim the early parts or ask the new chat to summarize first and continue from the summary.

## How it works

Each extension tries two methods, in this order:

1. **Site endpoint:** it requests the open conversation from the same internal endpoint the site's own web app uses, with your existing login session in the page.
2. **Page scraping (fallback):** if that fails, it reads the messages from the rendered page.

The popup tells you which method was used.

The Gemini extension is the exception: Gemini's internal chat data is obfuscated, so it only reads the rendered page. It scrolls the chat to load older messages, then converts the page content to Markdown.

## Privacy

The extensions make requests only to the site they run on, and only to load the chat you opened. They collect, store and transmit nothing. See [PRIVACY.md](PRIVACY.md) for details and a permission-by-permission explanation.

## Limitations

- These extensions rely on **internal, undocumented behavior** of the sites. The sites can change it at any time, which may break an extension until it is updated.
- The page-scraping fallback is less reliable. It can miss messages that are not loaded on the page.
- The Gemini extension depends on the page's HTML structure, so it is the most likely to break after a site update. Its reasoning text is not exported.
- Text and code are exported. Images and file attachments are not.
- Only the active conversation branch is exported (ChatGPT and Claude), not alternative regenerated or edited versions.
- Exported files are only as complete as what the site provides.

## Troubleshooting

- **"Reload the tab once":** the extension was installed after the tab was opened. Reload the page.
- **"Open a specific chat first":** you are on the home page, not inside a conversation.
- **API error in the status line, then fallback used:** the site probably changed its internals. Please open an issue and include the status text (without chat content).

## Contributing

Issues and pull requests are welcome, especially fixes after a site changes and adapters for other platforms. Please do not include private chat content in issues.

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or sponsored by DeepSeek, OpenAI, Anthropic or Google. Product names are used only to describe compatibility. Use it for your own conversations and check the terms of the service you use.

## License

[MIT](LICENSE)
