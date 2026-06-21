---
layout: default
lang: en
body_class: prose
title: MyShows PRO — Lampa Plugins
---

[Русский](https://igorek1986.github.io/lampa-plugins/docs/myshows_pro) · **English**

📺 MyShows PRO plugin for [Lampac](https://github.com/immisterio/Lampac) and [Lampa](http://lampa.mx/)
Scrobbling of series and movies via the official MyShows API — a "watching now" badge in real time.

> **Requires a MyShows PRO account** and a personal scrobble token.
> Learn more about scrobbling in the [official MyShows article](https://myshows.me/news/12495/scrobbler/) and the [MyShows Scrobbler](https://github.com/myshowsme/myshows-scrobbler#myshows-scrobbler) repository.

---

🔹 What the plugin does

- ✅ Scrobbling of series and movies via the [official MyShows API](https://myshows.me/scrobble)
- ✅ "Watching now" badge on MyShows.me appears immediately on playback start
- ✅ Progressive scrobbling: `/start` on open, `/pause` — periodic updates, `/stop` — on player close
- ✅ External player support — marks all playlist episodes from the launched one to the last
- ✅ Multi-profile — a separate token per Lampa profile
- ✅ Token verification directly from settings

---

⚙️ Setup

1. Get your scrobble token in your [MyShows.me](https://myshows.me) account (PRO section)
2. Install the plugin in Lampa → Extensions
3. Open Settings → **MyShows PRO**
4. Enable scrobbling and paste your token
5. Press "Check token" — you should see a ✅ notification

---

🔧 Technical highlights

- Works with both the built-in and external player
- API requests go through the native HTTP bridge (`Lampa.Reguest.native`) — bypassing CORS
  *(will not work in the lampa.mx browser — only on TV / native WebView)*
- Content matching is handled server-side by MyShows using IMDB/Kinopoisk ID + season/episode
- ES5 — compatible with older WebOS, Tizen, Android WebView
