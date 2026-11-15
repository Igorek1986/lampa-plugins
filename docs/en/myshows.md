---
layout: default
lang: en
body_class: prose
title: MyShows — Lampa Plugins
---

[Русский](https://igorek1986.github.io/lampa-plugins/docs/myshows) · **English**

📺 MyShows plugin for [Lampac](https://github.com/immisterio/Lampac) and [Lampa](http://lampa.mx/)  
Automatic sync of watched series and movies with MyShows.me  

![Plugin example](https://raw.githubusercontent.com/Igorek1986/lampa-plugins/main/docs/MyShows.png)

🔹 Key features

- ✅ Login/password authentication (no manual token entry required)  
- ✅ Multi-profile support — individual settings for each Lampa profile  
- ✅ Automatic token refresh on expiration  
- ✅ Series watch progress display  
- ✅ Next unwatched episode display  
- ✅ "Unwatched series (MyShows)" shown on the CUB/TMDB Home screen  
- ✅ Flexible conditions for adding a series to "Watching":  
- Immediately when the first episode starts.  
- After watching 5% to 50% of the first episode  

- ✅ Accurate watch sync with a configurable mark threshold (50%-100%)  

- ✅ Smart operating mode:  
- Marks watched episodes and movies  

🆕 What's new:

- **Customizable card badges** — three independent toggles:  
- "Episodes progress" — watched / total episodes (e.g. 5/12)  
- "Episodes left" — number of unwatched episodes  
- "Next episode" — number of the next episode (e.g. S01E05)  
- **Badge placement** — two layout options:  
- Variant 1 — classic.  
- Variant 2 — next episode bottom-left, progress bottom-right, episodes left top-right, with rounded corners like the card.  
- **"Next episode" badge** — now also visible in the "Torrents" / "Online" windows, updates after the player is closed.  
- **Series sorting** — 8 options: alphabetical, by relevance, by progress, by unwatched count, by last episode date (↑/↓), by first unwatched date (↑/↓).
- **MyShows Calendar** — episode release dates from MyShows right in the "Calendar" section.  
- **"Unwatched series" on Home** — a separate toggle for showing the section on the CUB/TMDB home screen.  
- **NP-server storage mode** — the "Use NP server" setting: unwatched series data is stored on the server for fast loading across all devices.  
- **Cross-device settings sync (NMSync)** — badges, sorting and other settings apply across all your devices automatically.  
- **Manual sync with Lampac** — a "Sync" button for a one-time full reconciliation of watched content.  

### Relevance sorting

Choose **По актуальности** (By relevance) in series sorting. Shows rank by the
newer of their last episode viewing date and latest released unwatched episode
date, descending. Ties use alphabetical order. Progress remains the default.
The list appears immediately using known dates. If loaded history changes the
order, the current page refreshes through Lampa: a recent show enters the first
20 cards, and More uses the complete updated order.

Only this mode requests MyShows viewing history. Dates are stored locally per
profile and retained after completing a show; NP cards without dates use known
local dates. Successful episode marks update the viewing date; undoing a mark
reloads history. Request failures retain known dates and cards, while successful
empty history clears the viewing date. Missing, ambiguous, invalid and future
dates do not raise priority. The Lampa list and Android TV channel share the
ordering; private viewing dates are not sent to Android.

### Android TV home channel (optional)

In MyShows settings, enable **MyShows на главном экране Android TV** to publish
unwatched shows as a separate **MyShows** channel. This requires an Android TV
Lampa build exposing `AndroidJS.publishPluginChannel` and
`AndroidJS.clearPluginChannel`, plus a launcher that displays application channels
(for example, Projectivy). Older APKs and browsers keep working and explain the
unsupported capability in the setting.

The switch defaults to off and is saved per profile on this device; it is not
synced to other devices. The channel follows the selected MyShows sort order.
Cards open the existing Lampa show page. Their description includes the next
episode and unwatched count when available; stream availability and automatic
episode playback are not implied.

The existing cache appears first, then the successful fresh list replaces it.
Publication updates while Lampa runs, after list refreshes and episode/status
changes. When Lampa is closed, cards remain but new episodes wait for the next
Lampa startup/refresh. A request error preserves the current profile's last
successful list; a successful empty list clears it. Switching profiles, logging
out, or disabling the switch immediately requests clearing the previous cards.
If the native bridge rejects clearing, the plugin reports that failure instead
of claiming the old cards were removed. Launcher channel visibility and row
order are configured in the launcher. Favorites and Watch Next are separate.

For reproducible release generation and regression tests, see
[MyShows development](myshows-development.md).

⚙️ Plugin settings  
- 🔐 Authentication via a proxy server (login/password are not stored in plain text) [myshows_proxy](https://github.com/Igorek1986/myshows_proxy)  
- 🎚 Add-to-"Watching" threshold and watch-mark threshold  
- ⏳ Cache lifetime (7–90 days)  
- 🎛 Badge display and placement, sorting, management buttons on cards  


🔧 Technical highlights  
- Works with the built-in player and external players (that report a timecode)  
- 📊 Integration with the Lampac progress storage  
- 🔍 Series detection by IMDB ID  
- 💾 Local data caching to reduce API requests. Cache lifetime (7-90 days)  
- 🔄 Sync of watched movies and series with Lampac. Requires the [TimecodeUser](https://github.com/Igorek1986/lampa-plugins/tree/main/module/TimecodeUser) module  

🧩 Public JS API for other plugins  
The plugin exports `window.MyShows` — other Lampa plugins can use it without duplicating MyShows ID resolution and authentication:

- `isLoggedIn()` — whether the current profile is logged in to MyShows.
- `setStatus(cardData, status, isMovie, callback)` — set a card's status on MyShows without your own ID resolution (by IMDB/Kinopoisk ID or title+year). `cardData` is a regular Lampa/TMDB card object (`id`, `imdb_id`/`kinopoisk_id`, `title`/`name`, release date). Series statuses: `watching`/`later`/`cancelled`/`remove`; movie statuses: `finished`/`later`/`remove`. `callback(success)` fires after the MyShows request completes.
- `openPage()` — open the "MyShows" section (unwatched series) as a Lampa activity.
- `getUnwatchedShowsWithDetails(callback)` — get the list of unwatched series with details (progress, next episode, etc.).

Check availability and login before calling:
```js
if (window.MyShows && window.MyShows.isLoggedIn && window.MyShows.isLoggedIn()) {
    window.MyShows.setStatus(cardData, 'watching', false, function (success) { /* ... */ });
}
```
See np_unwatched.js (full-card status buttons) for a live usage example.

📌 How it works  
- On watch start:  

- Detects the series by IMDB ID (Kinopoisk ID, original title and year)  
- Checks the conditions for adding to "Watching"  
- Builds a local episode mapping  
- Detects the movie by original title and release year.  

- On watch completion:  
- Tracks progress along the timeline  
- Once the threshold is reached, marks it as watched  

💡 Usage tips  
- ✔️ For new users — just enter your MyShows login/password  
- ✔️ Set comfortable mark thresholds for your viewing style  


🔄 What's new in this version  
- Completely reworked authentication system  

- Lampa multi-profile support  
- Improved episode detection algorithm  
- Optimized number of API requests  
- More stable operation  
