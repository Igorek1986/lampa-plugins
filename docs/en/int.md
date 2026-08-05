---
layout: default
lang: en
body_class: prose
title: Stylish Interface — Lampa Plugins
---

[Русский](https://igorek1986.github.io/lampa-plugins/docs/int) · **English**

🎨 Stylish Interface plugin for Lampa/Lampac
A reworked home screen: logos instead of titles, backdrop art, colored ratings and flexible card display options.

🔹 Key features:
- Title logo instead of plain text (cached, with a smooth fade-in animation)
- Backdrop/poster art behind the info panel, with selectable image quality (w300 / w780 / w1280 / original)
- Info panel: TMDB rating, genres, runtime, age rating, status (airing / ended / ongoing, etc.)
- Optional season and episode counters
- CUB user reactions shown right on the card
- Colored ratings (red to lawngreen based on score), with an optional border
- Wide posters as an alternative card style
- Hide captions (title/year) under cards for a cleaner look
- Async background loading of card data — ratings and backdrops appear without stutter while scrolling

⚙️ Technical highlights:
- Works on top of Lampa's standard home screen (Maker) without breaking the rest of the interface
- Size-limited logo/preview cache — doesn't grow forever on long scrolls, oldest entries are evicted
- Logo cache can be cleared manually from settings
- Every display element can be toggled independently
- Settings live under Settings → Interface → "Stylish Interface"
