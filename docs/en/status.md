---
layout: default
lang: en
body_class: prose
title: Status Serials — Lampa Plugins
---

[Русский](https://igorek1986.github.io/lampa-plugins/docs/status) · **English**

🎬 Status Serials plugin for Lampac  
Visual status badges for series and integration with [Movies-api](https://github.com/Igorek1986/movies-api)! (TMDB, CUB)  

![Plugin example](https://raw.githubusercontent.com/Igorek1986/lampa-plugins/main/docs/status_card.png)

🔹 Key features:  
- Bright status badges for all series:  
- Airing (blue)  
- Ended (green)  
- Paused (yellow, if the series is on hiatus)  
- TV badge for series (red)  
- Automatic status display on cards across all sections:  
- Home, All series, History, Favorites, etc.  
- Correct behavior with dynamic card loading (badges appear even on scroll and list refresh)  
- Consistent style and badge order on all cards  
- Flexible support for different data sources (works with series from various APIs)  
- Compatibility and synergy with NUMParser:  
- Series status badges perfectly complement NUMParser's filtering and cataloging  
- Lets you instantly tell apart ended, ongoing and paused series right in the NUMParser catalog  

🆕 What's new:  
- **Badge placement** — two layout schemes to choose from:  
- Variant 1 — classic: badges stacked on the left, colored.  
- Variant 2 — in the top corners of the card: "Series" top-left, status top-right, no color (minimal look).  
- **Cross-device settings sync (NMSync)** — the chosen badge style and on/off state apply across all your devices automatically. Works together with NUMParser.  

⚙️ Technical highlights:  
- Automatic card type detection (series/movie)  
- Smart handling of cards without an explicit status (defaults to "Airing" for series)  
- Minimal interface load, no conflicts with other plugins  
- Global "Show series status" toggle to enable/disable badges across all sections  
