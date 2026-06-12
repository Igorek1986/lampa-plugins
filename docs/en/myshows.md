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
- **Series sorting** — 7 options: alphabetical, by progress, by unwatched count, by last episode date (↑/↓), by first unwatched date (↑/↓).  
- **MyShows Calendar** — episode release dates from MyShows right in the "Calendar" section.  
- **"Unwatched series" on Home** — a separate toggle for showing the section on the CUB/TMDB home screen.  
- **NP-server storage mode** — the "Use NP server" setting: unwatched series data is stored on the server for fast loading across all devices.  
- **Cross-device settings sync (NMSync)** — badges, sorting and other settings apply across all your devices automatically.  
- **Manual sync with Lampac** — a "Sync" button for a one-time full reconciliation of watched content.  

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
