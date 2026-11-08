---
type: Script
title: TikTok Live Chat Log
description: Records live chat into a filterable log with pause, per-user filter and gift highlighting.
repo: https://github.com/chirag127/tiktok-live-chat-userscript
install: https://github.com/chirag127/tiktok-live-chat-userscript/raw/main/tiktok-live-chat-userscript.user.js
version: "1.0.0"
tags: [userscript, tiktok]
timestamp: 2026-11-09T00:00:00Z
---

# TikTok Live Chat Log

Records live chat into a filterable log with pause, per-user filter and gift highlighting.

## Method

MutationObserver on the chat container, per-node user/text extraction, CSV/JSON export.

## Limits

- Only messages rendered while the panel is open are captured
- Gift detection is class-based
- Very busy chats drop rows past the 5000 cap
