# Privacy

Last updated: 2026-11-26

AI Chat Exporter runs entirely in your browser.

## What it does

When you click the extension icon and choose an export format, the extension reads the conversation that is open in the current tab, builds a Markdown or JSON file in your browser, and saves it to your downloads folder.

## What it does not do

- It does not collect, store or transmit any personal data or chat content.
- It does not send anything to the developer or to any third party.
- It does not use analytics, tracking, advertising or remote code.
- It does not run on any site other than the ones listed below.

The only network requests it makes go to the site you are already using, to load the conversation you opened, using your existing login session. Where a site requires a session token for that request (DeepSeek and ChatGPT), it is read in the page only to make that request. It is not stored or sent anywhere else.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | To talk to the tab you are currently using when you click the extension icon. |
| Host access to `chat.deepseek.com` (DeepSeek extension) | To read the open conversation on that site. |
| Host access to `chatgpt.com` and `chat.openai.com` (ChatGPT extension) | To read the open conversation on those sites. |
| Host access to `claude.ai` (Claude extension) | To read the open conversation on that site. |
| Host access to `gemini.google.com` (Gemini extension) | To read the open conversation from the page. This extension makes no network requests at all. |
| Content script on those same sites | To collect the conversation from the page and return it to the popup. |

## Data you export

The exported file is saved on your device. You decide where it goes next. Exported chats may contain sensitive content, so store and share them with care.

## Changes

If this policy changes, the date above will be updated and the change will appear in this repository's history.

## Contact

Questions about this policy: open an issue in this repository or contact amanahtune@gmail.com.
