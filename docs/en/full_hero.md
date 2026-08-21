---
layout: default
lang: en
body_class: prose
title: Full Hero — Lampa Plugins
---

[Русский](https://igorek1986.github.io/lampa-plugins/docs/full_hero) · **English**

🖼️ Full Hero plugin for Lampa/Lampac
A hero-style redesign of the movie/show detail page: full-screen backdrop art, all text and buttons pinned to the bottom of the screen.

🔹 Key features:
- Full-screen backdrop art instead of the small duplicate poster on the left
- Title, description teaser, rating/year/country, reactions and buttons collected into one block at the bottom of the screen
- Short description teaser under the title (3 lines), the full text stays available in the "Details" section
- Rating, age badge and status shown on the same line as the year and country
- A watch progress bar above the buttons: for shows — episodes watched/remaining and the next episode, for movies — time watched/remaining
- Progress updates instantly when you return to the card after watching, no page reload needed
- If a movie/show has no backdrop art, the plugin stretches the poster in its place instead

⚙️ Technical highlights:
- The bottom-pinned layout adapts to the interface scale — looks equally good in a browser, on Smart TVs and Android TV
- Watch progress is pulled from the "Unwatched" plugin (NUMParser) if installed, otherwise calculated locally from Lampa's watch history
- On mobile screens the poster is left untouched — there's no duplicate backdrop there
- No settings — works right away once installed
