(function() {
    "use strict";
    var VERSION = "1.0.2";
    window.full_hero_plugin = true;
    var DEBUG = false;
    function log(message, data) {
        if (DEBUG) console.log("[FullHero] " + message, data !== void 0 ? data : "");
    }
    var style = document.createElement("style");
    style.textContent = [ "@media screen and (min-width: 767px) {", "    .full-start-new__left { display: none; }", "}", ".full-start-new__poster .np-unwatched-progress,", ".full-start-new__poster .np-unwatched-remaining,", ".full-start-new__poster .np-unwatched-next,", ".full-start-new__poster .serial-status__type,", ".full-start-new__poster .serial-status__status {", "    display: none !important;", "}", ".fh-meta {", "    color: rgba(255,255,255,.6); font-size: 1.2em;", "    display: flex; align-items: center; flex-wrap: wrap; gap: 0.6em;", "    margin: 0 0 0.5em;", "}", ".fh-meta span { color: #fff; }", ".fh-descr {", "    color: rgba(255,255,255,.75); font-size: 1em; line-height: 1.4;", "    margin: 0.6em 0 1em; max-width: 46em;", "}", ".full-descr__text { display: none; }", ".full-descr__left > .full-start-new__details {", "    margin-bottom: 0.8em;", "}", ".full-start-new__head {", "    display: flex; align-items: center;", "    flex-wrap: wrap; gap: 0.8em;", "}", ".full-start-new__head .full-start-new__rate-line {", "    margin-left: auto;", "}", "@media screen and (min-width: 767px) {", "    .full-start-new__body { align-items: stretch; }", "    .full-start-new__right { display: flex; flex-direction: column; }", "    .full-start-new__title { margin-top: auto; }", "}", ".fh-progress-wrap {", "    max-height: 0; margin-top: 0; margin-bottom: 0; opacity: 0; overflow: hidden;", "    transition: max-height 0.4s ease, margin 0.4s ease, opacity 0.3s ease;", "}", ".fh-progress-wrap--show {", "    max-height: 6em; margin-top: 1.1em; margin-bottom: 1.1em; opacity: 1;", "}", ".fh-progress-text {", "    color: rgba(255,255,255,.75); font-size: 1em; font-weight: 500; margin-bottom: 0.5em;", "    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;", "}", ".fh-progress-bar {", "    position: relative; height: 0.25em; border-radius: 0.25em;", "    background: rgba(255,255,255,.15); overflow: hidden;", "}", ".fh-progress-bar > div {", "    position: absolute; left: 0; top: 0; bottom: 0; width: 0;", "    background: #fff; border-radius: 0.25em; transition: width 0.4s ease;", "}", ".full-start-new__buttons .np-status-btn svg path,", ".full-start-new__buttons .np-status-btn svg circle {", "    stroke-width: 2.4;", "}", ".full-start-new__reactions .reaction {", "    height: 2.6em; box-sizing: border-box;", "}" ].join("\n");
    document.head.appendChild(style);
    var WATCH_THRESHOLD = 90;
    var EVENT_TIMEOUT = 1500;
    function isTvShow(movie) {
        return !!(movie && (movie.number_of_seasons || movie.seasons || movie.first_air_date || movie.original_name));
    }
    function cardIdOf(movie) {
        return movie && movie.id ? movie.id + "_tv" : "";
    }
    function isSameFullCardOpen(movie) {
        if (!movie || !movie.id) return true;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (!active || active.component !== "full") return false;
        var openCard = active.card_data || active.card || active.movie;
        if (!openCard || !openCard.id) return true;
        return String(openCard.id) === String(movie.id);
    }
    function pad2(n) {
        n = parseInt(n, 10) || 0;
        return n < 10 ? "0" + n : "" + n;
    }
    function ensureWrap() {
        var buttons = document.querySelector(".full-start-new__buttons");
        if (!buttons || !buttons.parentNode) return null;
        var wrap = buttons.parentNode.querySelector(".fh-progress-wrap");
        if (!wrap) {
            wrap = document.createElement("div");
            wrap.className = "fh-progress-wrap";
            wrap.innerHTML = '<div class="fh-progress-text"></div><div class="fh-progress-bar"><div></div></div>';
            buttons.parentNode.insertBefore(wrap, buttons);
        }
        return wrap;
    }
    function renderProgress(watched, total, remaining, nextEpisode) {
        if (!total) return;
        var wrap = ensureWrap();
        if (!wrap) return;
        var text = wrap.querySelector(".fh-progress-text");
        var bar = wrap.querySelector(".fh-progress-bar > div");
        var percent = Math.max(0, Math.min(100, Math.round(watched / total * 100)));
        var parts = [];
        if (nextEpisode) parts.push(nextEpisode.replace("/", ""));
        if (remaining) parts.push("осталось " + remaining); else parts.push("Просмотрено " + watched + " из " + total);
        text.textContent = parts.join(" · ");
        bar.style.width = percent + "%";
        wrap.classList.add("fh-progress-wrap--show");
    }
    function clearProgress() {
        var wrap = document.querySelector(".fh-progress-wrap");
        if (wrap) wrap.classList.remove("fh-progress-wrap--show");
    }
    function localFallback(movie) {
        if (!window.Lampa || !Lampa.Timeline || !Lampa.Timeline.watchedEpisode) return;
        var seasons = (movie.seasons || []).filter(function(s) {
            return s.season_number > 0 && s.episode_count > 0;
        });
        if (!seasons.length) return;
        seasons.sort(function(a, b) {
            return a.season_number - b.season_number;
        });
        var watched = 0, total = 0, nextEp = null;
        for (var i = 0; i < seasons.length; i++) {
            var season = seasons[i];
            for (var ep = 1; ep <= season.episode_count; ep++) {
                total++;
                var percent = 0;
                try {
                    percent = Lampa.Timeline.watchedEpisode(movie, season.season_number, ep) || 0;
                } catch (e) {}
                if (percent >= WATCH_THRESHOLD) watched++; else if (!nextEp) nextEp = "S" + pad2(season.season_number) + "/E" + pad2(ep);
            }
        }
        if (!watched) return;
        renderProgress(watched, total, total - watched, nextEp);
    }
    function formatDuration(seconds) {
        var m = Math.round(seconds / 60);
        if (m < 1) return "";
        if (m < 60) return m + " мин";
        var h = Math.floor(m / 60), mm = m % 60;
        return h + " ч" + (mm ? " " + mm + " мин" : "");
    }
    function renderMovieProgress(percent, watchedSeconds, remainingSeconds) {
        if (!percent) return;
        var wrap = ensureWrap();
        if (!wrap) return;
        var text = wrap.querySelector(".fh-progress-text");
        var bar = wrap.querySelector(".fh-progress-bar > div");
        var p = Math.max(0, Math.min(100, Math.round(percent)));
        var parts = [];
        var watched = formatDuration(watchedSeconds);
        parts.push(watched ? "Просмотрено " + watched : "Просмотрено");
        var left = formatDuration(remainingSeconds);
        if (left) parts.push("осталось " + left);
        text.textContent = parts.join(" · ");
        bar.style.width = p + "%";
        wrap.classList.add("fh-progress-wrap--show");
    }
    function movieFallback(movie) {
        if (!window.Lampa || !Lampa.Timeline || !Lampa.Timeline.watched) return;
        var data;
        try {
            data = Lampa.Timeline.watched(movie, true);
        } catch (e) {
            return;
        }
        if (!data || !data.percent) return;
        var remaining = data.duration && data.time ? data.duration - data.time : 0;
        renderMovieProgress(data.percent, data.time, remaining);
    }
    var _liveProgressCardId = null;
    function onLiveProgressEvent(e) {
        if (!e.detail || e.detail.card_id !== _liveProgressCardId) return;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        var openCard = active && (active.card_data || active.card || active.movie);
        if (!openCard || cardIdOf(openCard) !== _liveProgressCardId) {
            document.removeEventListener("np-unwatched-progress", onLiveProgressEvent);
            _liveProgressCardId = null;
            return;
        }
        if (e.detail.found) renderProgress(e.detail.watched, e.detail.aired, e.detail.remaining, e.detail.next_episode); else localFallback(openCard);
    }
    function refreshProgress(movie) {
        if (!isTvShow(movie)) {
            movieFallback(movie);
            return;
        }
        var cardId = cardIdOf(movie);
        var gotAnswer = false;
        if (window.np_unwatched_plugin) {
            if (_liveProgressCardId !== cardId) {
                document.removeEventListener("np-unwatched-progress", onLiveProgressEvent);
                _liveProgressCardId = cardId;
                document.addEventListener("np-unwatched-progress", onLiveProgressEvent);
            }
            var onceHandler = function(e) {
                if (!e.detail || e.detail.card_id !== cardId) return;
                gotAnswer = true;
                document.removeEventListener("np-unwatched-progress", onceHandler);
            };
            document.addEventListener("np-unwatched-progress", onceHandler);
            setTimeout(function() {
                document.removeEventListener("np-unwatched-progress", onceHandler);
                if (gotAnswer || !isSameFullCardOpen(movie)) return;
                localFallback(movie);
            }, EVENT_TIMEOUT);
        } else localFallback(movie);
    }
    function onFullCardReady(movie) {
        clearProgress();
        ensureWrap();
        refreshProgress(movie);
    }
    Lampa.Listener.follow("activity", function(event) {
        if (event.type !== "archive" || event.component !== "full") return;
        var movie = event.object && event.object.card;
        if (!movie) return;
        setTimeout(function() {
            if (!isSameFullCardOpen(movie)) return;
            refreshProgress(movie);
        }, 1500);
    });
    function backdropFallback(movie) {
        if (!movie || movie.backdrop_path || !movie.poster_path) return;
        if (!window.Lampa || !Lampa.Api || !Lampa.Api.img) return;
        var container = document.querySelector(".full-start-new");
        if (!container) return;
        var img = container.querySelector(".full-start__background");
        if (!img) {
            img = document.createElement("img");
            img.className = "full-start__background";
            container.insertBefore(img, container.firstChild);
        }
        img.onload = function() {
            img.classList.add("loaded");
        };
        img.src = Lampa.Api.img(movie.poster_path, "w1280");
    }
    function moveYearCountryAfterTitle() {
        var head = document.querySelector(".full-start-new__head");
        var right = document.querySelector(".full-start-new__right");
        if (!head || !right) return;
        if (right.querySelector(".fh-meta")) return;
        var meta = document.createElement("div");
        meta.className = "fh-meta";
        while (head.firstChild) meta.appendChild(head.firstChild);
        var title = right.querySelector(".full-start-new__title");
        if (title) title.parentNode.insertBefore(meta, title.nextSibling); else right.insertBefore(meta, right.firstChild);
    }
    function moveRateLineToHead() {
        var head = document.querySelector(".full-start-new__head");
        var rateLine = document.querySelector(".full-start-new__rate-line");
        if (!head || !rateLine) return;
        moveYearCountryAfterTitle();
        head.appendChild(rateLine);
    }
    function decorateDescr(attempt) {
        var right = document.querySelector(".full-start-new__right");
        if (!right) return;
        var descrLeft = document.querySelector(".full-descr__left");
        var descrTextEl = document.querySelector(".full-descr__text");
        if (!descrLeft || !descrTextEl) {
            if (attempt < 20) setTimeout(function() {
                decorateDescr((attempt || 0) + 1);
            }, 300);
            return;
        }
        if (document.querySelector(".full-start-new__right") !== right) return;
        var old = document.querySelectorAll(".fh-descr");
        for (var i = 0; i < old.length; i++) old[i].remove();
        var tagline = right.querySelector(".full-start-new__tagline");
        var meta = right.querySelector(".fh-meta");
        var title = right.querySelector(".full-start-new__title");
        var anchorAfter = tagline || meta || title;
        var text = descrTextEl.textContent.trim();
        if (anchorAfter && text) {
            var el = document.createElement("div");
            el.className = "fh-descr";
            el.textContent = text;
            anchorAfter.parentNode.insertBefore(el, anchorAfter.nextSibling);
        }
        var details = right.querySelector(".full-start-new__details");
        if (details) descrLeft.insertBefore(details, descrLeft.firstChild);
    }
    function tightenScrollTop() {
        var node = document.querySelector(".full-start-new");
        while (node && (!node.classList || !node.classList.contains("scroll__content"))) node = node.parentElement;
        if (!node) return;
        node.style.paddingTop = "0.5em";
        var scrollEl = node.parentElement;
        if (scrollEl && scrollEl.classList && scrollEl.classList.contains("scroll--mask")) {
            scrollEl.style.webkitMaskImage = "none";
            scrollEl.style.maskImage = "none";
        }
    }
    var BOTTOM_GAP_REM = 2.4;
    function pinBodyHeight() {
        if (window.innerWidth < 767) return;
        var body = document.querySelector(".full-start-new__body");
        if (!body) return;
        var top = body.getBoundingClientRect().top;
        var rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        var bottomGap = BOTTOM_GAP_REM * rootFontSize;
        var h = window.innerHeight - top - bottomGap;
        if (h > 0) body.style.minHeight = h + "px";
    }
    Lampa.Listener.follow("full", function(event) {
        if (event.type !== "complite" || !event.data || !event.data.movie) return;
        tightenScrollTop();
        pinBodyHeight();
        backdropFallback(event.data.movie);
        moveRateLineToHead();
        decorateDescr(0);
        onFullCardReady(event.data.movie);
    });
})();