(function () {
    'use strict';

    // MyShows PRO scrobbler для Lampa.
    // Работает с ОФИЦИАЛЬНЫМ scrobble-API MyShows (личный PRO-токен).
    // Умеет ровно то, что сейчас умеет официальный API: прогрессивный скробблинг фильмов и
    // эпизодов (/start /pause /stop) — сервер сам матчит контент по внешним id + season/number
    // и показывает «смотрит сейчас» на сайте. Списков/статусов/каталога у официального API нет.
    //
    // ES5 only (старые WebOS/Tizen/Android WebView): var + function,
    // без arrow/const/let/template literals/classes/spread.

    var SCROBBLE_URL = 'https://myshows.me/scrobble';
    var EP = { start: '/start', pause: '/pause', stop: '/stop', check: '/check' };
    var SOURCE_APP = 'lampa';

    var pro_icon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="12" rx="3" style="fill:none;stroke:currentColor;stroke-width:2"/><line x1="12" y1="5" x2="7" y2="1" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"/><line x1="12" y1="5" x2="17" y2="1" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"/><circle cx="12" cy="6" r="1" style="fill:currentColor;stroke:none"/><text x="12" y="16.5" text-anchor="middle" style="fill:#FF2D2D;font-size:8px;font-weight:bold;font-family:Arial,sans-serif">pro</text></svg>';

    // ── Профили ──
    function getProfileId() {
        if (window._np_profiles_started || window.profiles_plugin) {
            var profileId = Lampa.Storage.get('lampac_profile_id', '');
            if (profileId) return String(profileId);
        }
        try {
            if (Lampa.Account.Permit.account && Lampa.Account.Permit.account.profile && Lampa.Account.Permit.account.profile.id) {
                return String(Lampa.Account.Permit.account.profile.id);
            }
        } catch (e) {}
        return '';
    }

    function getProfileKey(baseKey) {
        var profileId = getProfileId();
        if (profileId) {
            return baseKey + '_profile_' + profileId;
        } else {
            return baseKey;
        }
    }

    function getProfileSetting(key, defaultValue) {
        return Lampa.Storage.get(getProfileKey(key), defaultValue);
    }

    // sync здесь не используем (PRO-токен на сервер не синкаем).
    function setProfileSetting(key, value, sync) {
        Lampa.Storage.set(getProfileKey(key), value);
    }

    // Базовый ключ из профильного: 'myshows_pro_token_profile_abc' → 'myshows_pro_token'
    function _baseKey(profileKey) {
        var idx = profileKey.lastIndexOf('_profile_');
        return idx >= 0 ? profileKey.slice(0, idx) : profileKey;
    }

    function hasProfileSetting(key) {
        var profileKey = getProfileKey(key);
        return window.localStorage.getItem(profileKey) !== null;
    }

    // Профильные настройки: дефолты в профильный ключ (если нет) + копия профиль → БАЗОВЫЙ ключ
    function loadProfileSettings() {
        if (!hasProfileSetting('myshows_pro_enabled')) {
            setProfileSetting('myshows_pro_enabled', false, false);
        }
        if (!hasProfileSetting('myshows_pro_token')) {
            setProfileSetting('myshows_pro_token', '', false);
        }
        Lampa.Storage.set('myshows_pro_enabled', getProfileSetting('myshows_pro_enabled', false), "true");
        Lampa.Storage.set('myshows_pro_token',   getProfileSetting('myshows_pro_token', ''), "true");
    }

    // ── Storage helpers (профильные) ──────────────────────────────────────────
    function getEnabled() { var v = getProfileSetting('myshows_pro_enabled', false); return v === true || v === 'true'; }
    function getToken()   { return (getProfileSetting('myshows_pro_token', '') || '').toString().trim(); }

    // ── Logging (gated by myshows_pro_debug) ──────────────────────────────────
    function dbg() { return Lampa.Storage.get('myshows_pro_debug', false) === true; }
    function _log(method, args) {
        if (!window.console || !console[method]) return;
        console[method].apply(console, ['[MS-PRO]'].concat([].slice.call(args)));
    }
    var Log = {
        info:  function () { if (dbg()) _log('log', arguments); },
        warn:  function () { if (dbg()) _log('warn', arguments); },
        error: function () { _log('error', arguments); }
    };

    // ── HTTP ──────────────────────────────────────────────────────────────────
    // Lampa.Reguest().native(): на нативных платформах (Tizen/WebOS/Android) запрос идёт
    // через нативный HTTP-мост — мимо браузерного CORS. Официальный /scrobble не отдаёт
    // CORS-заголовки, поэтому из десктоп-браузера (lampa.mx) работать НЕ будет — только на ТВ/
    // в нативном WebView. Сигнатура: native(url, onOk, onErr, body, { headers, method }).
    function request(endpoint, method, body, onOk, onErr) {
        var token = getToken();
        if (!token) { if (onErr) onErr('no token'); return; }
        var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
        var net = new Lampa.Reguest();
        net.native(
            SCROBBLE_URL + endpoint,
            function (resp) { if (onOk) onOk(resp); },
            function (xhr) { if (onErr) onErr(xhr && xhr.status ? ('HTTP ' + xhr.status) : 'native error'); },
            method === 'POST' ? (body ? JSON.stringify(body) : '{}') : false,
            { headers: headers, method: method, dataType: 'json', timeout: 8000 }
        );
    }

    // ── Идентификаторы карточки и DTO ─────────────────────────────────────────
    function extractYear(card) {
        var d = card.release_date || card.first_air_date || card.year || '';
        var m = String(d).match(/\d{4}/);
        return m ? parseInt(m[0], 10) : undefined;
    }

    function isSeriesCard(card) {
        return !!(card.number_of_seasons || card.media_type === 'tv' || card.name || card.original_name);
    }

    function buildIds(card) {
        // ВАЖНО: MyShows матчит контент по imdb/kinopoisk; tmdbId у многих тайтлов на MyShows
        // отсутствует (null). Поэтому обязательно шлём imdb (+kinopoisk), а не только tmdb.
        var ids = {};
        if (card.id) ids.tmdb = String(card.id);
        var imdb = card.imdb_id || card.imdbId || (card.ids && card.ids.imdb);
        if (imdb) {
            imdb = String(imdb);
            if (imdb.indexOf('tt') !== 0) imdb = 'tt' + imdb; // MyShows/Trakt ждут формат "tt…"
            ids.imdb = imdb;
        }
        var kp = card.kinopoisk_id || card.kp_id || (card.ids && card.ids.kp);
        if (kp) { var kpn = parseInt(kp, 10); if (kpn) ids.kinopoisk = kpn; }
        return ids;
    }

    function buildPayload(item, percent) {
        var card = item.card;
        var title    = card.title || card.name;
        var original = card.original_title || card.original_name || title;
        var year     = extractYear(card);
        var p = percent || 0;
        if (p < 0) p = 0; if (p > 100) p = 100;
        p = Math.round(p * 100) / 100; // float 0.0–100.0 как в офиц. скробблере (percentOf)

        var payload = { progress: p, source_app: SOURCE_APP };
        if (item.isEpisode) {
            payload.show = { title: title, original_title: original, year: year, ids: buildIds(card) };
            payload.episode = { season: item.season, number: item.episode };
        } else {
            payload.movie = { title: title, original_title: original, year: year, ids: buildIds(card) };
        }
        return payload;
    }

    // ── Текущее воспроизведение ───────────────────────────────────────────────
    // current = { key, item, started, stopped, lastPercent, external }
    var current = null;

    function itemKey(item) {
        var id = item.card && item.card.id;
        return id + ':' + (item.isEpisode ? (item.season + 'x' + item.episode) : 'movie');
    }

    // Отправить один скроббл для ПРОИЗВОЛЬНОГО элемента (нужно для внешнего плейлиста,
    // где мы отмечаем не только current.item, но и предыдущие серии).
    function scrobbleItem(endpoint, item, percent, onOk, onErr) {
        var payload = buildPayload(item, percent);
        request(endpoint, 'POST', payload,
            function () { Log.info('✅', endpoint, itemKey(item), 'p=' + Math.round(percent || 0)); if (onOk) onOk(); },
            function (err) { Log.error('❌', endpoint, itemKey(item), err); if (onErr) onErr(err); });
    }

    function scrobble(endpoint, percent) {
        if (!current) return;
        scrobbleItem(endpoint, current.item, percent);
    }

    // Отметить серию: /start → /stop. Порог решает сервер (v1 — на подтверждение, v2 — авто при ≥80%),
    // поэтому /stop шлём всегда с фактическим прогрессом, без клиентского порога.
    function markEpisodeWatched(item, percent, onDone) {
        scrobbleItem(EP.start, item, percent, function () {
            scrobbleItem(EP.stop, item, percent, function () { if (onDone) onDone(); }, function () { if (onDone) onDone(); });
        }, function () { if (onDone) onDone(); });
    }

    // Хеш серии как считает Lampa: hash(season + (':' если season>10) + episode + original_name).
    function buildEpisodeHash(season, episode, originalName) {
        return Lampa.Utils.hash('' + season + (season > 10 ? ':' : '') + episode + originalName);
    }

    // Нормализовать плейлист внешнего плеера в список серий с хешами (для матча последней).
    function normalizePlaylist(playlist, card) {
        var out = [];
        if (!playlist || !playlist.length) return out;
        var originalName = card.original_name || card.original_title || card.title;
        for (var i = 0; i < playlist.length; i++) {
            var it = playlist[i] || {};
            var s = (it.season  !== undefined && it.season  !== null) ? parseInt(it.season, 10)  : null;
            var e = (it.episode !== undefined && it.episode !== null) ? parseInt(it.episode, 10) : null;
            if (!s || !e) continue; // не эпизод — пропускаем
            out.push({ season: s, episode: e, hash: buildEpisodeHash(s, e, originalName) });
        }
        return out;
    }

    // Завершить скробблинг (выход из плеера/конец/переход к следующей серии): ВСЕГДА /stop с
    // фактическим прогрессом. Засчитывать или нет решает сервер (v1 — предложит подтвердить,
    // v2 — авто-отметка при ≥80%; ниже — просто закроет сессию). Один раз (stopped).
    function finalizeCurrent(percent) {
        if (!current || current.stopped) return;
        if (typeof percent !== 'number') percent = current.lastPercent || 0;
        Log.info('■ stop', current.key, 'percent=' + Math.round(percent));
        scrobble(EP.stop, percent);
        current.stopped = true;
    }

    // Внешний плеер: пришёл ОДИН финальный таймкод (последней серии), а предыдущие Lampa уже
    // отметила 100%. Отмечаем в MyShows все серии плейлиста от запущенной до последней:
    // предыдущие — progress 100, последнюю — по факту.
    function finalizeExternalPlaylist(lastHash, lastPercent) {
        if (!current || current.stopped) return;
        current.stopped = true;
        var pl = current.playlist;
        var card = current.item.card;

        // Нет плейлиста/хеша — отмечаем только запущенную серию по факту.
        if (!pl || !pl.length || lastHash === undefined || lastHash === null) {
            Log.info('внешний: нет плейлиста/hash — отмечаем только запущенную серию');
            markEpisodeWatched(current.item, lastPercent, function () {});
            return;
        }

        var lastIndex = -1, startIndex = 0;
        for (var i = 0; i < pl.length; i++) if (pl[i].hash === lastHash) { lastIndex = i; break; }
        for (var j = 0; j < pl.length; j++)
            if (pl[j].season === current.item.season && pl[j].episode === current.item.episode) { startIndex = j; break; }

        if (lastIndex < 0) {
            Log.warn('внешний: серию по hash не нашли в плейлисте — отмечаем только запущенную');
            markEpisodeWatched(current.item, lastPercent, function () {});
            return;
        }
        if (lastIndex < startIndex) { var t = startIndex; startIndex = lastIndex; lastIndex = t; }

        Log.info('внешний: отмечаем серии ' + (startIndex + 1) + '..' + (lastIndex + 1) + ' из ' + pl.length);
        var idx = startIndex;
        function next() {
            if (idx > lastIndex) { Log.info('внешний: все серии отправлены'); return; }
            var pi = pl[idx];
            var item = { card: card, season: pi.season, episode: pi.episode, isEpisode: true };
            var pct = (idx < lastIndex) ? 100 : lastPercent; // предыдущие 100%, последняя по факту
            Log.info((idx < lastIndex ? '■ предыдущая 100%' : '■ последняя') + ' S' + pi.season + 'E' + pi.episode + ' p=' + Math.round(pct));
            idx++;
            markEpisodeWatched(item, pct, next);
        }
        next();
    }

    function startScrobble(data, isExternal) {
        if (!getEnabled() || !getToken()) return;
        if (!data) return;
        // Не скробблим IPTV и трейлеры (YouTube)
        if (data.iptv || (data.url && String(data.url).indexOf('youtube.com') >= 0)) return;
        var card = data.card || (Lampa.Activity.active() && Lampa.Activity.active().movie);
        if (!card) { Log.warn('start: нет card — пропускаем'); return; }

        var season  = (data.season  !== undefined && data.season  !== null) ? parseInt(data.season, 10)  : null;
        var episode = (data.episode !== undefined && data.episode !== null) ? parseInt(data.episode, 10) : null;
        var isEpisode = !!(season && episode);

        // Сериал без season/episode — DTO эпизода не собрать, не шлём (иначе уйдёт как фильм).
        if (isSeriesCard(card) && !isEpisode) {
            Log.warn('start: сериал без season/episode — скробблинг пропущен', card.original_name || card.name);
            current = null;
            return;
        }

        // Переход к новому элементу (напр. следующая серия без 'destroy') — завершаем предыдущий.
        if (current && !current.stopped) finalizeCurrent(current.lastPercent);

        var item = { card: card, season: season, episode: episode, isEpisode: isEpisode };
        // Текущий прогресс — сохранённый в Lampa (resume-позиция = где реально стартуем).
        var initPercent = (data.timeline && typeof data.timeline.percent === 'number') ? data.timeline.percent : 0;
        current = { key: itemKey(item), item: item, started: true, stopped: false,
                    lastPercent: initPercent, external: !!isExternal,
                    playlist: isExternal ? normalizePlaylist(data.playlist, card) : null };

        // /start при ОТКРЫТИИ — чтобы сразу появилась плашка «смотрит сейчас» (прогресс сохранён в Lampa).
        Log.info((isExternal ? '▶ start (внешний)' : '▶ start'), current.key, 'percent=' + Math.round(initPercent),
                 (isExternal && current.playlist) ? ('playlist=' + current.playlist.length) : '');
        scrobble(EP.start, initPercent);
    }

    function onPlayerStart(data)    { startScrobble(data, false); }
    function onPlayerExternal(data) { startScrobble(data, true); }

    function onTimelineUpdate(e) {
        if (!getEnabled() || !current || current.stopped) return;
        var hash    = e && e.data && e.data.hash;
        var percent = e && e.data && e.data.road && e.data.road.percent;
        if (typeof percent !== 'number') return;
        current.lastPercent = percent;

        if (current.external) {
            // Внешний плеер: апдейт на возврате — финальный. Отмечаем все серии плейлиста до текущей.
            finalizeExternalPlaylist(hash, percent);
            return;
        }

        // Внутренний плеер: heartbeat синхронизации прогресса — /pause с живым % (модель скробблера:
        // первый тик /start уже отправлен при открытии, последующие → /pause с актуальной позицией).
        // Сервер сам крутит %, а /pause периодически подравнивает его к реальному, чтобы не уплывал.
        Log.info('… sync (/pause)', current.key, 'percent=' + Math.round(percent));
        scrobble(EP.pause, percent);
    }

    function onPlayerDestroy() {
        if (!current) return;
        // Финальный прогресс: живой lastPercent, при возможности уточняем из playdata.
        var percent = current.lastPercent || 0;
        try {
            var w = Lampa.Player.playdata && Lampa.Player.playdata();
            if (w && w.timeline && typeof w.timeline.percent === 'number') percent = w.timeline.percent;
        } catch (e) {}
        finalizeCurrent(percent);
        current = null;
    }

    // ── Проверка токена ───────────────────────────────────────────────────────
    function checkToken() {
        var token = getToken();
        if (!token) { Lampa.Noty.show('MyShows PRO: токен не задан'); return; }
        request(EP.check, 'GET', null,
            function () { Lampa.Noty.show('MyShows PRO: токен действителен ✅'); Log.info('check ok'); },
            function (err) { Lampa.Noty.show('MyShows PRO: токен недействителен ❌ (' + err + ')'); Log.error('check fail', err); });
    }

    // ── Настройки ─────────────────────────────────────────────────────────────
    function initSettings() {
        // Удаляем старый компонент перед пере-добавлением — иначе при повторном вызове
        // (старт + смена профиля) параметры дублируются.
        try { if (Lampa.SettingsApi.removeComponent) Lampa.SettingsApi.removeComponent('myshows_pro'); } catch (e) {}

        // Синк профиль → базовые ключи, чтобы Lampa показала значения текущего профиля.
        loadProfileSettings();

        Lampa.SettingsApi.addComponent({
            component: 'myshows_pro',
            name: 'MyShows PRO',
            icon: pro_icon
        });

        Lampa.SettingsApi.addParam({
            component: 'myshows_pro',
            param: {
                name: 'myshows_pro_enabled',
                type: 'trigger',
                default: getProfileSetting('myshows_pro_enabled', false)
            },
            field: {
                name: 'Включить скробблинг',
                description: 'Отправлять просмотр в MyShows через официальный API (PRO). Настройка — на текущий профиль'
            },
            onChange: function (value) {
                setProfileSetting('myshows_pro_enabled', value === true || value === 'true');
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'myshows_pro',
            param: {
                name: 'myshows_pro_token',
                type: 'input',
                placeholder: 'PRO-токен MyShows',
                values: '',
                default: getProfileSetting('myshows_pro_token', '')
            },
            field: {
                name: 'PRO-токен',
                description: 'Личный scrobble-токен MyShows (только для PRO-аккаунтов). Свой на каждый профиль'
            },
            onChange: function (value) {
                setProfileSetting('myshows_pro_token', (value || '').toString().trim());
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'myshows_pro',
            param: { type: 'button' },
            field: {
                name: 'Проверить токен',
                description: 'Запрос к /check официального API'
            },
            onChange: checkToken
        });
    }

    // Обновление настроек при смене профиля — НЕ пересоздаём компонент,
    // а только синкаем профиль→базовые ключи и (если панель открыта) правим значения в DOM.
    // (Пересоздание компонента ломало открытую панель.) + сбрасываем активную сессию скробблинга.
    function refreshProfileSettings() {
        current = null;
        loadProfileSettings(); // профиль → базовые ключи (для переоткрытия настроек)

        setTimeout(function () {
            var settingsPanel = document.querySelector('[data-component="myshows_pro"]');
            if (!settingsPanel) return;

            var enabled = settingsPanel.querySelector('select[data-name="myshows_pro_enabled"]');
            if (enabled) enabled.value = getProfileSetting('myshows_pro_enabled', false);

            var token = settingsPanel.querySelector('input[data-name="myshows_pro_token"]');
            if (token) token.value = getProfileSetting('myshows_pro_token', '');
        }, 100);

        Log.info('профиль сменился → настройки обновлены (token=' +
            (getToken() ? '…' + getToken().slice(-4) : 'пусто') + ')');
    }

    // ── Подписки на плеер ─────────────────────────────────────────────────────
    function initListeners() {
        if (window.Lampa && Lampa.Player && Lampa.Player.listener) {
            Lampa.Player.listener.follow('start', onPlayerStart);
            Lampa.Player.listener.follow('external', onPlayerExternal);
            Lampa.Player.listener.follow('destroy', onPlayerDestroy);
        }
        if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) {
            Lampa.Timeline.listener.follow('update', onTimelineUpdate);
        }
        // Смена профиля: Lampac → 'profile' changed; Lampa → 'state:changed' favorite/profile.
        Lampa.Listener.follow('profile', function (e) { if (e.type === 'changed') refreshProfileSettings(); });
        Lampa.Listener.follow('state:changed', function (e) { if (e.target === 'favorite' && e.reason === 'profile') refreshProfileSettings(); });
    }

    function startPlugin() {
        if (window.__myshows_pro_started) return;
        window.__myshows_pro_started = true;
        try { initSettings(); } catch (e) { Log.error('initSettings', e); }
        try { initListeners(); } catch (e) { Log.error('initListeners', e); }
        Log.info('MyShows PRO scrobbler инициализирован');
    }

    function boot() {
        if (!window.Lampa) { setTimeout(boot, 200); return; }
        if (window.appready) startPlugin();
        else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') startPlugin(); });
    }

    boot();
})();
