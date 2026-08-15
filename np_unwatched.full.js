(function () {
    'use strict';

    var VERSION = '1.7.4';

    var DEBUG = false;
    function log(message, data) {
        if (DEBUG) console.log('[NPUnwatched] ' + message, data !== undefined ? data : '');
    }

    // =========================================================================
    // Стили
    // =========================================================================

    // Палитра/раскладка — как у myshows.js (.myshows-progress/-remaining/-next-episode),
    // чтобы переход с myshows на этот плагин был визуально бесшовным: прогресс —
    // зелёный, снизу слева; остаток — тёмный, справа сверху; следующая серия —
    // синяя, снизу слева над прогрессом. Свой атрибут-переключатель варианта
    // (data-np-unwatched-badge-style), не завязан на myshows_badge_style.
    var style = document.createElement('style');
    style.textContent = [
        '.np-unwatched-progress {',
        '    position: absolute; left: 0em; bottom: 0em;',
        '    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 0.5em;',
        '    font-weight: bold; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
        '    background: #4CAF50; color: #fff;',
        '    transition: all 0.3s ease, transform 0.15s ease !important;',
        '}',
        '.np-unwatched-remaining {',
        '    position: absolute; right: 0em; top: 0em;',
        '    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 1em 0 0 1em;',
        '    font-weight: bold; z-index: 2;',
        '    background: rgba(0,0,0,0.5); color: #fff; transition: all 0.3s ease;',
        '}',
        // status.js (вариант 2) занимает правый верхний угол статусом сериала —
        // счётчик остатка сдвигаем ниже него.
        'body[data-status-badge-style="2"] .card .view--has-status .np-unwatched-remaining,',
        'body[data-status-badge-style="2"] .full-start-new__poster .view--has-status .np-unwatched-remaining {',
        '    top: 1.6em;',
        '}',
        '.np-unwatched-next {',
        '    position: absolute; left: 0em; bottom: 1.5em;',
        '    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 0.5em;',
        '    font-weight: bold; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
        '    letter-spacing: 0.04em; line-height: 1.1;',
        '    background: #2196F3; color: #fff; transition: all 0.3s ease;',
        '}',
        /* «Следующая серия: SxxExx» в левой панели Торрентов/Онлайна — между
           .explorer-card__head и .explorer-card__body, обычным текстом Lampa. */
        '.np-unwatched-explorer-next {',
        '    margin: 0 0 1em;',
        '    font-size: 1.15em; font-weight: 300;',
        '}',
        /* Зелёная галочка "просмотрено" в правом нижнем углу карточки серии */
        '.full-episode__img, .season-episode__img, .online-prestige__img, .np-unwatched-check-anchor { position: relative; }',
        '.np-unwatched-episode-checked {',
        '    position: absolute; right: 0.4em; bottom: 0.4em;',
        '    width: 1.6em; height: 1.6em; border-radius: 50%;',
        '    background: #4CAF50; color: #fff; z-index: 3;',
        '    display: flex; align-items: center; justify-content: center;',
        '    box-shadow: 0 2px 6px rgba(0,0,0,0.4);',
        '    animation: npCheckPop 0.25s ease;',
        '}',
        '.np-unwatched-episode-checked::after { content: "\\2713"; font-size: 1em; font-weight: bold; line-height: 1; }',
        '@keyframes npCheckPop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }',
        '@keyframes npUnwatchedFlip {',
        '    0%   { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }',
        '    50%  { transform: scale(1); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }',
        '    100% { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }',
        '}',
        '.np-unwatched-flip { animation: npUnwatchedFlip 0.4s ease; }',
        '.full-start-new__poster { position: relative; }',
        '.full-start-new__poster .np-unwatched-progress,',
        '.full-start-new__poster .np-unwatched-next {',
        '    position: absolute; left: 0.5em; z-index: 3;',
        '}',
        '.full-start-new__poster .np-unwatched-progress,',
        '.full-start-new__poster .np-unwatched-remaining,',
        '.full-start-new__poster .np-unwatched-next {',
        '    transition: all 0.3s ease !important;',
        '}',
        '.full-start-new__poster .np-unwatched-progress { bottom: 0.5em; }',
        '.full-start-new__poster .np-unwatched-next     { bottom: 2em; }',
        '.full-start-new__poster .np-unwatched-remaining { top: 1em; }',
        'body.true--mobile.orientation--portrait .full-start-new__poster .np-unwatched-progress  { bottom: 15em; }',
        'body.true--mobile.orientation--portrait .full-start-new__poster .np-unwatched-next       { bottom: 17em; }',
        'body.true--mobile.orientation--landscape .full-start-new__poster .np-unwatched-progress  { bottom: 2.5em; }',
        'body.true--mobile.orientation--landscape .full-start-new__poster .np-unwatched-next       { bottom: 4em; }',
        '@media screen and (min-width: 580px) and (max-width: 1024px) {',
        '    body.true--mobile .full-start-new__poster .np-unwatched-progress  { bottom: 2.5em; font-size: 1.1em; }',
        '    body.true--mobile .full-start-new__poster .np-unwatched-next      { bottom: 4em;   font-size: 1.1em; }',
        '}',
        'body.glass--style.platform--browser .card .np-unwatched-progress,',
        'body.glass--style.platform--nw .card .np-unwatched-progress,',
        'body.glass--style.platform--apple .card .np-unwatched-progress {',
        '    background-color: rgba(76,175,80,0.8);',
        '    -webkit-backdrop-filter: blur(1em); backdrop-filter: blur(1em);',
        '}',
        'body.glass--style.platform--browser .card .np-unwatched-next,',
        'body.glass--style.platform--nw .card .np-unwatched-next,',
        'body.glass--style.platform--apple .card .np-unwatched-next {',
        '    background-color: rgba(33,150,243,0.8);',
        '    -webkit-backdrop-filter: blur(1em); backdrop-filter: blur(1em);',
        '}',
        // Вариант 2: метки по углам, как card_overlay — радиус карточки Lampa 1em,
        // у меток font-size 1.2em, поэтому 0.83em внутри метки ≈ 1em карточки.
        'body[data-np-unwatched-badge-style="2"] .card .np-unwatched-next,',
        'body[data-np-unwatched-badge-style="2"] .full-start-new__poster .np-unwatched-next {',
        '    left: 0; bottom: 0; border-radius: 0 0.83em;',
        '    background: rgba(0,0,0,0.5); box-shadow: none;',
        '}',
        'body[data-np-unwatched-badge-style="2"] .card .np-unwatched-progress,',
        'body[data-np-unwatched-badge-style="2"] .full-start-new__poster .np-unwatched-progress {',
        '    left: auto; right: 0; bottom: 0; border-radius: 0.83em 0;',
        '    background: rgba(0,0,0,0.5); box-shadow: none;',
        '}',
        'body[data-np-unwatched-badge-style="2"].glass--style .card .np-unwatched-progress,',
        'body[data-np-unwatched-badge-style="2"].glass--style .card .np-unwatched-next {',
        '    background-color: rgba(0,0,0,0.5);',
        '    -webkit-backdrop-filter: none; backdrop-filter: none;',
        '}',
        'body[data-np-unwatched-badge-style="2"][data-status-badge-style="2"] .card .view--has-status .np-unwatched-remaining,',
        'body[data-np-unwatched-badge-style="2"][data-status-badge-style="2"] .full-start-new__poster .view--has-status .np-unwatched-remaining {',
        '    top: 1.25em;',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    // =========================================================================
    // Конфигурация сервера (общая с np.js)
    // =========================================================================

    function getNpToken() { return Lampa.Storage.get('numparser_api_key', ''); }
    function getNpBaseUrl() { return Lampa.Storage.get('base_url_numparser', ''); }

    // =========================================================================
    // Профильные настройки (канонический рецепт — см. plugins/status.js)
    // =========================================================================

    function getProfileId() {
        if (window._np_profiles_started || window.profiles_plugin) {
            var lampacId = Lampa.Storage.get('lampac_profile_id', '');
            if (lampacId) return String(lampacId);
        }
        try {
            if (Lampa.Account.Permit.account && Lampa.Account.Permit.account.profile &&
                Lampa.Account.Permit.account.profile.id) {
                return String(Lampa.Account.Permit.account.profile.id);
            }
        } catch (e) {}
        return '';
    }

    function getProfileKey(baseKey) {
        var profileId = getProfileId();
        if (profileId && profileId.charAt(0) === '_') profileId = profileId.slice(1);
        return profileId ? baseKey + '_profile_' + profileId : baseKey;
    }

    function getProfileSetting(key, defaultValue) {
        return Lampa.Storage.get(getProfileKey(key), defaultValue);
    }

    function isTrue(v) { return v === true || v === 'true'; }

    // Свои настройки не выносим отдельным пунктом меню — кнопка внутри существующего
    // раздела NUMParser открывает подраздел (как «Значки на карточках» у myshows).
    var SETTINGS_COMPONENT = 'numparser_settings';
    var BADGES_COMPONENT   = 'np_unwatched_badges';
    var PROGRESS_KEY   = 'np_unwatched_badge_progress';
    var REMAINING_KEY  = 'np_unwatched_badge_remaining';
    var NEXT_KEY       = 'np_unwatched_badge_next';
    var BADGE_STYLE_KEY = 'np_unwatched_badge_style';
    var SORT_KEY = 'np_unwatched_sort_order';
    var DEFAULT_SORT = 'progress';
    // Порог "серия просмотрена" — не свой, используем настройку np.js
    // numparser_min_progress (тот же смысл, что и для hide_watched).
    var DEFAULT_MIN_PROGRESS = 90;
    var SYNC_PLUGIN = 'np_unwatched';
    var SYNC_KEYS   = [PROGRESS_KEY, REMAINING_KEY, NEXT_KEY, BADGE_STYLE_KEY, SORT_KEY];

    // Булевы в Storage пишем строками 'true'/'false' — Storage.get затирает
    // закешированный boolean false дефолтом (value || empty), строка выживает.
    function storableValue(v) {
        if (v === true) return 'true';
        if (v === false) return 'false';
        return v;
    }

    var _syncApplying = false;

    function setProfileSetting(key, value, sync) {
        value = storableValue(value);
        Lampa.Storage.set(getProfileKey(key), value);
        if (sync !== false && !_syncApplying && window.__NMSync) {
            window.__NMSync.patch(SYNC_PLUGIN, getProfileKey(key), value);
        }
    }

    function hasProfileSetting(key) {
        return window.localStorage.getItem(getProfileKey(key)) !== null;
    }

    function _applySetting(profileKey, value) {
        if (profileKey.indexOf('_profile_') < 0) return;
        value = storableValue(value);
        _syncApplying = true;
        Lampa.Storage.set(profileKey, value);
        _syncApplying = false;
    }

    function registerNMSync() {
        if (!window.__NMSync) return;
        window.__NMSync.register(SYNC_PLUGIN, [], _applySetting, function (serverKeys) {
            SYNC_KEYS.forEach(function (key) {
                var profileKey = getProfileKey(key);
                if (serverKeys.indexOf(profileKey) < 0 && hasProfileSetting(key)) {
                    setProfileSetting(key, getProfileSetting(key));
                }
            });
        });
    }

    function loadProfileSettings() {
        if (!hasProfileSetting(PROGRESS_KEY)) setProfileSetting(PROGRESS_KEY, true, false);
        if (!hasProfileSetting(REMAINING_KEY)) setProfileSetting(REMAINING_KEY, true, false);
        if (!hasProfileSetting(NEXT_KEY)) setProfileSetting(NEXT_KEY, true, false);
        if (!hasProfileSetting(BADGE_STYLE_KEY)) setProfileSetting(BADGE_STYLE_KEY, '1', false);
        if (!hasProfileSetting(SORT_KEY)) setProfileSetting(SORT_KEY, DEFAULT_SORT, false);

        Lampa.Storage.set(PROGRESS_KEY, storableValue(getProfileSetting(PROGRESS_KEY, true)), true);
        Lampa.Storage.set(REMAINING_KEY, storableValue(getProfileSetting(REMAINING_KEY, true)), true);
        Lampa.Storage.set(NEXT_KEY, storableValue(getProfileSetting(NEXT_KEY, true)), true);
        Lampa.Storage.set(BADGE_STYLE_KEY, getProfileSetting(BADGE_STYLE_KEY, '1'), true);
        Lampa.Storage.set(SORT_KEY, getProfileSetting(SORT_KEY, DEFAULT_SORT), true);

        applyBadgeStyleAttr();
    }

    // Вариант раскладки значков ('1' классика/'2' по углам) — как у myshows.js,
    // но свой атрибут на <body>, независимый от myshows_badge_style.
    function applyBadgeStyleAttr() {
        var v = getProfileSetting(BADGE_STYLE_KEY, '1').toString();
        if (v === '2') document.body.setAttribute('data-np-unwatched-badge-style', v);
        else document.body.removeAttribute('data-np-unwatched-badge-style');
    }

    // Если параллельно включён myshows.js — его бейджи используют те же имена
    // полей (next_episode, progress_marker) и задвоятся с нашими. Отключается
    // вручную одним тумблером на его стороне («Отключить все значки» в настройках
    // myshows → «Значки на карточках») — сюда специально не лезем.
    function isPluginEnabled() {
        return isTrue(getProfileSetting(PROGRESS_KEY, true)) ||
               isTrue(getProfileSetting(REMAINING_KEY, true)) ||
               isTrue(getProfileSetting(NEXT_KEY, true));
    }

    var BADGES_BUTTON_NAME = 'Непросмотренные — значки на карточках';

    function initSettings() {
        if (!Lampa.SettingsApi) return;

        Lampa.Template.add('settings_' + BADGES_COMPONENT, '<div></div>');

        // Кнопка внутри NUMParser, открывающая подраздел со значками — сгруппированы
        // отдельно, как «Значки на карточках» у myshows, а не плоским списком.
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: { type: 'button' },
            field: {
                name: BADGES_BUTTON_NAME,
                description: 'Прогресс, остаток серий, следующий эпизод. Если пользуетесь myshows — отключите его значки (myshows → Значки на карточках → «Отключить все значки»), иначе будут задвоены.',
            },
            onChange: function () {
                Lampa.Settings.create(BADGES_COMPONENT, {
                    onBack: function () { Lampa.Settings.create(SETTINGS_COMPONENT); }
                });
            },
        });

        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: { name: PROGRESS_KEY, type: 'trigger', default: true },
            field: { name: 'Прогресс эпизодов', description: 'Просмотрено/вышло, например 5/12' },
            onChange: function (value) { setProfileSetting(PROGRESS_KEY, value === true || value === 'true'); },
        });

        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: { name: REMAINING_KEY, type: 'trigger', default: true },
            field: { name: 'Осталось серий', description: 'Количество непросмотренных серий' },
            onChange: function (value) { setProfileSetting(REMAINING_KEY, value === true || value === 'true'); },
        });

        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: { name: NEXT_KEY, type: 'trigger', default: true },
            field: { name: 'Следующий эпизод', description: 'Номер следующего эпизода для просмотра, например S01E05' },
            onChange: function (value) { setProfileSetting(NEXT_KEY, value === true || value === 'true'); },
        });

        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: BADGE_STYLE_KEY, type: 'select',
                values: { '1': 'Вариант 1', '2': 'Вариант 2' },
                default: '1',
            },
            field: {
                name: 'Расположение значков',
                description: 'Вариант 2: следующий эпизод слева внизу, прогресс справа внизу, остаток серий справа вверху, скругления как у карточки',
            },
            onChange: function (value) {
                setProfileSetting(BADGE_STYLE_KEY, value.toString());
                applyBadgeStyleAttr();
            },
        });

        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: SORT_KEY, type: 'select',
                values: {
                    'progress': 'По прогрессу',
                    'unwatched_count': 'По количеству непросмотренных',
                    'air_date': 'По дате последнего эпизода ↓',
                    'air_date_asc': 'По дате последнего эпизода ↑',
                    'first_unwatched_date': 'По дате первого непросмотренного ↓',
                    'first_unwatched_date_asc': 'По дате первого непросмотренного ↑',
                    'alphabet': 'По алфавиту',
                },
                default: DEFAULT_SORT,
            },
            field: {
                name: 'Сортировка «Непросмотренные»',
                description: 'Порядок показа сериалов в категории',
            },
            onChange: function (value) { setProfileSetting(SORT_KEY, value.toString()); },
        });
    }

    // Проверяет, что наша кнопка всё ещё в реестре Lampa.SettingsApi (могла быть
    // стёрта чужим removeComponent('numparser_settings') — сам подраздел
    // BADGES_COMPONENT отдельный и этим не затрагивается, но без кнопки до него
    // не добраться).
    function settingsStillRegistered() {
        if (!Lampa.SettingsApi.getParam) return true; // API недоступен — не рискуем задваивать
        var list = Lampa.SettingsApi.getParam(SETTINGS_COMPONENT) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].field && list[i].field.name === BADGES_BUTTON_NAME) return true;
        }
        return false;
    }

    // np.js выставляет window.numparser_plugin = true в самом начале своего
    // запуска — ждём этого (несколько попыток), чтобы регистрировать наши
    // настройки уже после того, как np.js гарантированно начал исполняться, а не
    // до него (иначе он может быть ещё не загружен вовсе). Само по себе это не
    // гарантирует, что np.js уже закончил СВОЮ (асинхронную) регистрацию настроек
    // — за это отвечает settingsStillRegistered()-перепроверка ниже.
    function waitForNumparser(callback, attemptsLeft) {
        if (attemptsLeft === undefined) attemptsLeft = 20; // ~10с при шаге 500мс
        if (window.numparser_plugin || attemptsLeft <= 0) { callback(); return; }
        setTimeout(function () { waitForNumparser(callback, attemptsLeft - 1); }, 500);
    }

    function registerSettingsSafely() {
        waitForNumparser(function () {
            initSettings();
            // np.js может завершить СВОЮ асинхронную регистрацию (пинг + setTimeout,
            // до ~4с) уже после этого момента и стереть нас через
            // removeComponent('numparser_settings') — перепроверяем с запасом и
            // перерегистрируемся только если нас правда стёрли (иначе задвоим пункты,
            // т.к. addParam просто пушит в массив без дедупа).
            setTimeout(function () {
                if (!settingsStillRegistered()) initSettings();
            }, 5000);
        });
    }

    // =========================================================================
    // Сеть
    // =========================================================================

    function isTvShow(card) {
        if (!card) return false;
        return !!(card.number_of_seasons || card.seasons || card.first_air_date || card.original_name);
    }

    function cardIdOf(card) {
        if (!card || !card.id) return '';
        return card.id + '_tv';
    }

    // Точечный запрос прогресса ОДНОГО сериала — не тянем весь список
    // «Непросмотренные», только карточку, которую сейчас смотрим/открыли.
    function fetchProgress(cardId, callback) {
        var token = getNpToken();
        var base = getNpBaseUrl();
        if (!token || !base || !cardId) { callback(null); return; }

        var minProgress = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
        var url = base + '/unwatched/progress?token=' + encodeURIComponent(token) +
            '&card_id=' + encodeURIComponent(cardId) +
            '&percent=' + encodeURIComponent(minProgress);
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);

        var network = new Lampa.Reguest();
        network.timeout(8000);
        network.silent(url, function (json) {
            callback(json && json.found ? json : null);
        }, function (err) {
            log('fetchProgress error', err);
            callback(null);
        });
    }

    function padTwo(n) { n = parseInt(n, 10) || 0; return n < 10 ? '0' + n : '' + n; }
    // Сервер уже отдаёт next_episode готовой строкой "S01E04" (не объектом) —
    // важно для совместимости: некоторые плагины (myshows.js) читают
    // card_data.next_episode как строку и получат "[object Object]", если это
    // будет объект.

    // =========================================================================
    // Карточки в строках (данные уже приезжают в самой карточке из /unwatched)
    // =========================================================================

    var processedRowCards = [];

    // Прогресс по card_id, который мы уже где-то видели (из карточек своей
    // категории /unwatched). Позволяет декорировать ЭТОТ ЖЕ сериал и в других
    // строках/категориях (например «Непросмотренные (MyShows)»), не делая для
    // них отдельных запросов — используем то, что уже знаем.
    var knownProgress = {};

    function addBadgesToRowCard(cardHtml) {
        if (!isPluginEnabled()) return;

        var cardElement = cardHtml && cardHtml.get ? cardHtml.get(0) : (cardHtml && cardHtml[0] ? cardHtml[0] : cardHtml);
        if (!cardElement) return;
        if (processedRowCards.indexOf(cardElement) !== -1) return;

        var data = cardElement.card_data || cardElement.data || {};
        var cardId = cardIdOf(data);
        var progress;

        if (data.unwatched_count !== undefined && data.unwatched_count !== null) {
            // Карточка из нашей категории /unwatched — данные уже в ней, запоминаем
            // на случай, если этот же сериал встретится в другой строке.
            progress = data;
            if (cardId) knownProgress[cardId] = {
                unwatched_count: data.unwatched_count,
                progress_marker: data.progress_marker,
                next_episode: data.next_episode,
            };
        } else if (cardId && knownProgress[cardId]) {
            // Карточка из другой категории (например myshows_unwatched), но этот
            // сериал мы уже видели — используем сохранённый прогресс.
            progress = knownProgress[cardId];
        } else {
            return;
        }

        var cardView = cardElement.querySelector('.card__view');
        if (!cardView) return;

        processedRowCards.push(cardElement);
        renderBadges(cardView, progress);
    }

    function renderBadges(container, data) {
        var old = container.querySelectorAll('.np-unwatched-progress, .np-unwatched-remaining, .np-unwatched-next');
        for (var i = 0; i < old.length; i++) old[i].remove();

        if (isTrue(getProfileSetting(REMAINING_KEY, true)) && data.unwatched_count) {
            var r = document.createElement('div');
            r.className = 'np-unwatched-remaining';
            r.textContent = data.unwatched_count;
            container.appendChild(r);
        }
        if (isTrue(getProfileSetting(PROGRESS_KEY, true)) && data.progress_marker) {
            var p = document.createElement('div');
            p.className = 'np-unwatched-progress';
            p.textContent = data.progress_marker;
            container.appendChild(p);
        }
        if (isTrue(getProfileSetting(NEXT_KEY, true)) && data.next_episode) {
            var n = document.createElement('div');
            n.className = 'np-unwatched-next';
            n.textContent = data.next_episode;
            container.appendChild(n);
        }
    }

    function removeBadges(container) {
        var old = container.querySelectorAll('.np-unwatched-progress, .np-unwatched-remaining, .np-unwatched-next');
        for (var i = 0; i < old.length; i++) {
            (function (el) {
                el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                el.style.opacity = '0';
                el.style.transform = 'translateY(10px)';
                setTimeout(function () { if (el.parentNode) el.remove(); }, 400);
            })(old[i]);
        }
    }

    // =========================================================================
    // Полная карточка (full/detail)
    // =========================================================================

    function isSameFullCardOpen(card) {
        if (!card || !card.id) return true;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (!active || active.component !== 'full') return false;
        var openCard = active.card_data || active.card || active.movie;
        if (!openCard || !openCard.id) return true;
        return String(openCard.id) === String(card.id);
    }

    function renderFullCardBadges(posterEl, progress) {
        var old = posterEl.querySelectorAll('.np-unwatched-progress, .np-unwatched-remaining, .np-unwatched-next');
        for (var i = 0; i < old.length; i++) old[i].remove();
        renderBadges(posterEl, {
            unwatched_count: progress.unwatched_count,
            progress_marker: progress.progress_marker,
            next_episode: progress.next_episode,
        });
    }

    // Общий путь для «открыли карточку» (full/complite) И «вернулись назад в уже
    // открытую карточку» (activity/archive ниже) — Lampa не шлёт complite повторно
    // при возврате, поэтому без второго хука бейджи оставались бы теми, что были
    // на момент первого открытия, даже если за это время досмотрели серию.
    function refreshFullCardPoster(movie) {
        if (!isPluginEnabled() || !isTvShow(movie)) return;

        var cardId = cardIdOf(movie);
        fetchProgress(cardId, function (progress) {
            if (!isSameFullCardOpen(movie)) return; // ушли на другую карточку, пока грузилось
            if (progress && cardId) knownProgress[cardId] = progress;
            var posterEl = document.querySelector('.full-start-new__poster');
            if (!posterEl) return;
            if (progress) renderFullCardBadges(posterEl, progress);
            else removeBadges(posterEl);
        });

        scheduleEpisodeBadgeDecorate();
    }

    Lampa.Listener.follow('full', function (event) {
        if (event.type !== 'complite' || !event.data || !event.data.movie) return;
        refreshFullCardPoster(event.data.movie);
    });

    // Возврат в уже открытую карточку — на экране ещё старые цифры (как при живом
    // просмотре), поэтому вместо мгновенной подмены ждём и играем ту же
    // анимацию перелистывания, что и при обновлении во время просмотра
    // (см. animateBadgeUpdate). Задержка — как у myshows.js: небольшая пауза
    // перед сверкой с сервером, чтобы не дёргать бейджи мгновенно на каждый шаг назад.
    function refreshFullCardPosterAnimated(movie) {
        if (!isPluginEnabled() || !isTvShow(movie)) return;

        var cardId = cardIdOf(movie);
        setTimeout(function () {
            fetchProgress(cardId, function (progress) {
                if (!isSameFullCardOpen(movie)) return;
                if (progress) knownProgress[cardId] = progress;
                var posterEl = document.querySelector('.full-start-new__poster');
                if (!posterEl) return;
                if (progress) animateBadgeUpdate(posterEl, progress);
                else removeBadges(posterEl);
            });
        }, 1500);

        scheduleEpisodeBadgeDecorate();
    }

    // =========================================================================
    // Панели «Торренты»/«Онлайн» (Explorer) — метка следующей серии
    // =========================================================================

    function addNextEpisodeToExplorer(movie) {
        if (!movie || !movie.id) return;
        if (!isTrue(getProfileSetting(NEXT_KEY, true))) return;
        if (!isTvShow(movie)) return;

        var cardId = cardIdOf(movie);
        fetchProgress(cardId, function (progress) {
            if (cardId) knownProgress[cardId] = progress || knownProgress[cardId];

            // Explorer может ещё не отрендериться — несколько попыток; активность
            // могла смениться, пока грузился запрос — сверяем tmdb id.
            var attempts = 0;
            (function tryInsert() {
                var act = Lampa.Activity.active && Lampa.Activity.active();
                var actOk = act && act.movie && String(act.movie.id) === String(movie.id);
                var cardEl = actOk ? document.querySelector('.activity--active .explorer-card') : null;
                if (!actOk || !cardEl) {
                    if (++attempts < 12) setTimeout(tryInsert, 300);
                    return;
                }
                var old = cardEl.querySelector('.np-unwatched-explorer-next');
                if (!progress || !progress.next_episode) {
                    if (old) old.remove();
                    return;
                }
                if (old) old.remove();
                var el = document.createElement('div');
                el.className = 'np-unwatched-explorer-next';
                el.textContent = 'Следующая серия: ' + progress.next_episode;
                var body = cardEl.querySelector('.explorer-card__body');
                if (body) cardEl.insertBefore(el, body);
                else cardEl.appendChild(el);
            })();
        });
    }

    // При возврате на главную/в категорию карточки в строках могли остаться со
    // старыми данными: onTimecodeSaved обновляет DOM только тех .card, что были
    // смонтированы В МОМЕНТ подтверждения (см. updateBadgesEverywhere) — если в
    // этот момент были в Торрентах/full, а не на этой странице, карточка не
    // тронута. knownProgress уже содержит свежие данные — просто перекладываем их
    // в видимые сейчас карточки.
    // Задержка — та же логика, что и у refreshFullCardPosterAnimated: на экране
    // ещё старые цифры, поэтому не подменяем их мгновенно, а даём небольшую паузу
    // и проигрываем анимацию перелистывания (или ничего не меняем, если данные
    // и так уже свежие — animateBadgeUpdate/animate* сами это определяют).
    function refreshVisibleRowCards() {
        if (!isPluginEnabled()) return;
        setTimeout(function () {
            var cards = document.querySelectorAll('.card');
            for (var i = 0; i < cards.length; i++) {
                var cardElement = cards[i];
                var data = cardElement.card_data || cardElement.data;
                if (!data) continue;
                var cardId = cardIdOf(data);
                var progress = knownProgress[cardId];
                if (!progress) continue;

                data.unwatched_count = progress.unwatched_count;
                data.progress_marker = progress.progress_marker;
                data.next_episode = progress.next_episode;

                var cardView = cardElement.querySelector('.card__view');
                if (cardView) animateBadgeUpdate(cardView, progress);
            }
        }, 1500);
    }

    Lampa.Listener.follow('activity', function (event) {
        // Торренты/Онлайн: у активности есть movie (у full — card).
        if (event.type === 'start' && event.component !== 'full' && event.object && event.object.movie) {
            addNextEpisodeToExplorer(event.object.movie);
            scheduleEpisodeBadgeDecorate();
        }

        // 'archive' шлётся ТОЛЬКО при возврате назад (в отличие от 'start', который
        // фигурирует и при обычном открытии) — точный момент, когда стоит сверить
        // бейджи с сервером, без лишних перерисовок на каждый заход вперёд.
        if (event.type === 'archive' && event.component === 'full' && event.object && event.object.card) {
            refreshFullCardPosterAnimated(event.object.card);
        }
        if (event.type === 'archive' && (event.component === 'main' || event.component === 'category')) {
            refreshVisibleRowCards();
        }
    });

    // Обновление бейджей после реального просмотра держится на одном источнике
    // истины — событии 'np_timecode_saved', которое np.js шлёт СРАЗУ ПОСЛЕ
    // подтверждённого POST /timecode (см. onTimelineUpdate в np.js). Это работает
    // одинаково и для внутреннего, и для внешнего плеера: у внешнего Timeline
    // 'update' не приходит живьём во время просмотра, но один раз срабатывает при
    // возврате в Lampa с итоговым таймкодом — np.js его сохраняет и шлёт то же
    // событие. Никакого setTimeout-гадания не нужно.

    // =========================================================================
    // Галочки "просмотрено" на карточках серий (season/episode picker, Explorer)
    // =========================================================================

    // По сериалу (card_id) — множество просмотренных серий: по хэшу (основной,
    // надёжный путь) и по "сезон_серия" (фолбэк для карточек без .time-line).
    var episodeWatchedCache = {}; // cardId -> { byHash: {}, bySeasonEp: {} }

    function fetchWatchedEpisodes(cardId, callback) {
        var token = getNpToken();
        var base = getNpBaseUrl();
        if (!token || !base || !cardId) { callback(null); return; }

        var minProgress = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
        var url = base + '/unwatched/episodes?token=' + encodeURIComponent(token) +
            '&card_id=' + encodeURIComponent(cardId) +
            '&percent=' + encodeURIComponent(minProgress);
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);

        var network = new Lampa.Reguest();
        network.timeout(8000);
        network.silent(url, function (json) {
            var byHash = {}, bySeasonEp = {};
            var list = (json && json.episodes) || [];
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                if (e.hash) byHash[e.hash] = true;
                if (e.season !== undefined && e.episode !== undefined) bySeasonEp[e.season + '_' + e.episode] = true;
            }
            callback({ byHash: byHash, bySeasonEp: bySeasonEp });
        }, function () { callback(null); });
    }

    // Сезон из заголовка строки/активности (для карточек без .time-line).
    function episodeLineSeason(cardEl) {
        var line = cardEl.parentNode;
        while (line && line.classList && !line.classList.contains('items-line')) line = line.parentNode;
        if (line && line.querySelector) {
            var t = line.querySelector('.items-line__title');
            if (t) { var m = (t.textContent || '').match(/(\d+)/); if (m) return parseInt(m[1], 10); }
        }
        var act = Lampa.Activity.active && Lampa.Activity.active();
        if (act && act.season) return parseInt(act.season, 10);
        return null;
    }

    // Ближайший «карточный» предок таймлайна (для произвольных онлайн/торрент-скинов).
    function nearestCardAnchor(tlEl) {
        var n = tlEl, depth = 0;
        while (n && depth < 8) {
            if (n.classList) {
                if (n.classList.contains('card-watched')) return null; // попап серий на постере
                if (n.classList.contains('full-episode') || n.classList.contains('season-episode') ||
                    n.classList.contains('online-prestige')) return n;
                if (n.classList.contains('selector')) {
                    return n.classList.contains('card') ? null : n; // .card = постер, не серия
                }
            }
            n = n.parentNode; depth++;
        }
        return null;
    }

    // Собрать карточки серий во всех вью: full/season-episode, online-prestige (Lampac)
    // и любые карточки с таймлайном (.time-line[data-hash]) — Онлайн/Торренты.
    function collectEpisodeCards() {
        var set = [], seen = [];
        function add(el) { if (el && seen.indexOf(el) === -1) { seen.push(el); set.push(el); } }
        var direct = document.querySelectorAll('.full-episode, .season-episode, .online-prestige');
        for (var i = 0; i < direct.length; i++) add(direct[i]);
        var tls = document.querySelectorAll('.time-line[data-hash]');
        for (var j = 0; j < tls.length; j++) add(nearestCardAnchor(tls[j]));
        return set;
    }

    // Навесить/снять галочку на одной DOM-карточке серии.
    function decorateOneEpisodeCard(cardEl, watched, fallbackSeason) {
        var isWatched = false;

        var tl = cardEl.querySelector('.time-line[data-hash]');
        if (tl) {
            var hash = tl.getAttribute('data-hash');
            isWatched = !!watched.byHash[hash];
        } else {
            var numEl = cardEl.querySelector('.full-episode__num, .season-episode__episode-number');
            var num = numEl ? parseInt((numEl.textContent || '').replace(/\D/g, ''), 10) : NaN;
            var season = fallbackSeason;
            if (!isNaN(num) && season) isWatched = !!watched.bySeasonEp[season + '_' + num];
        }

        var imgBox = cardEl.querySelector('.full-episode__img, .season-episode__img, .online-prestige__img');
        if (!imgBox) {
            var img = cardEl.querySelector('img');
            if (img && img.parentNode && img.parentNode !== cardEl) imgBox = img.parentNode;
        }
        if (!imgBox) imgBox = cardEl;
        imgBox.classList.add('np-unwatched-check-anchor');
        var existing = imgBox.querySelector('.np-unwatched-episode-checked');

        if (isWatched) {
            if (!existing) {
                var badge = document.createElement('div');
                badge.className = 'np-unwatched-episode-checked';
                imgBox.appendChild(badge);
                if (imgBox === cardEl) {
                    var thumb = cardEl.querySelector('img');
                    if (thumb && thumb.offsetWidth && thumb.offsetWidth < cardEl.offsetWidth * 0.6) {
                        badge.style.right = (cardEl.offsetWidth - thumb.offsetLeft - thumb.offsetWidth + 6) + 'px';
                    }
                }
            }
        } else if (existing) {
            existing.remove();
        }
    }

    function removeAllEpisodeBadges() {
        var b = document.querySelectorAll('.np-unwatched-episode-checked');
        for (var i = 0; i < b.length; i++) b[i].remove();
    }

    function decorateEpisodeCards() {
        if (!isTrue(getProfileSetting(REMAINING_KEY, true)) && !isTrue(getProfileSetting(PROGRESS_KEY, true)) && !isTrue(getProfileSetting(NEXT_KEY, true))) return;

        var card = getCurrentCard();
        if (!card || !isTvShow(card)) { removeAllEpisodeBadges(); return; }

        var cards = collectEpisodeCards();
        if (!cards.length) return;

        var cardId = cardIdOf(card);
        var cached = episodeWatchedCache[cardId];
        if (!cached) {
            fetchWatchedEpisodes(cardId, function (watched) {
                if (!watched) return;
                episodeWatchedCache[cardId] = watched;
                if (cardIdOf(getCurrentCard() || {}) === cardId) decorateEpisodeCards();
            });
            return;
        }

        for (var i = 0; i < cards.length; i++) {
            decorateOneEpisodeCard(cards[i], cached, episodeLineSeason(cards[i]));
        }
    }

    var episodeBadgeTimer = null;
    function scheduleEpisodeBadgeDecorate() {
        if (episodeBadgeTimer) clearTimeout(episodeBadgeTimer);
        episodeBadgeTimer = setTimeout(function () {
            episodeBadgeTimer = null;
            try { decorateEpisodeCards(); } catch (e) { log('decorateEpisodeCards error: ' + e); }
        }, 150);
    }

    if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) {
        Lampa.Timeline.listener.follow('view', scheduleEpisodeBadgeDecorate);
    }

    // =========================================================================
    // Живое обновление при просмотре (Lampa.Timeline)
    // =========================================================================

    function getCurrentCard() {
        var active = Lampa.Activity.active && Lampa.Activity.active();
        return (active && (active.card_data || active.card || active.movie)) || null;
    }

    var lastOptimisticKey = ''; // защита от повторной отрисовки на одном и том же тике Timeline

    // Мгновенная (оптимистичная) галочка на карточке серии — не ждём сохранения
    // на сервере, это чисто визуальный отклик. Авторитетное обновление счётчиков
    // и общего прогресса — в onTimecodeSaved ниже, по факту подтверждённого
    // сохранения (см. 'np_timecode_saved' в np.js).
    function processTimelineUpdate(e) {
        // np_profiles.js применяет так таймкоды с ДРУГИХ устройств (см. onWsTimecode
        // в np_profiles.js) — у нас это и так покрыто отдельным путём через
        // onTimecodeSaved/onWsTimecode, дублировать оптимистичную обработку не нужно.
        if (window.__npRemoteTimelineUpdate) return;
        if (!isPluginEnabled()) return;
        if (!e || !e.data || !e.data.hash || !e.data.road) return;

        var percent = e.data.road.percent;
        var minProgress = parseInt(getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS), 10);
        if (percent < minProgress) return;

        var card = getCurrentCard();
        if (!card || !isTvShow(card)) return;

        var cardId = cardIdOf(card);
        var key = cardId + ':' + e.data.hash;
        if (key === lastOptimisticKey) return;
        lastOptimisticKey = key;

        if (episodeWatchedCache[cardId]) {
            episodeWatchedCache[cardId].byHash[e.data.hash] = true;
            scheduleEpisodeBadgeDecorate();
        }
    }

    var lastConfirmedKey = '';

    // np.js шлёт это СРАЗУ после успешного POST /timecode — точный момент, когда
    // серверные данные уже точно свежие, без гадания с задержкой. Работает и для
    // внутреннего, и для внешнего плеера (см. комментарий у места удаления
    // Player.listener-блока выше).
    function onTimecodeSaved(e) {
        if (!isPluginEnabled() || !e || !e.card_id || !e.hash) return;
        if (e.card_id.slice(-3) !== '_tv') return; // не сериал — не наша забота

        var minProgress = parseInt(getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS), 10);
        var percent = e.percent || 0;
        // percent=0 — не промежуточный тик, а явное снятие отметки (mark.js по
        // повторному тапу на уже просмотренной серии). Пропускаем только
        // промежуточные тики ниже порога просмотра, а не сам факт снятия.
        if (percent > 0 && percent < minProgress) return;

        var key = e.card_id + ':' + e.hash + ':' + percent;
        if (key === lastConfirmedKey) return;
        lastConfirmedKey = key;

        var cardId = e.card_id;
        fetchProgress(cardId, function (progress) {
            if (progress) updateBadgesEverywhere(cardId, progress);
        });

        // Не доверяем кешу серий целиком — за время просмотра (особенно у внешнего
        // плеера, где могло пройти несколько серий подряд) он мог отстать;
        // перезапросим полный список при следующей отрисовке.
        delete episodeWatchedCache[cardId];
        scheduleEpisodeBadgeDecorate();
    }

    // =========================================================================
    // WebSocket — обновления с ДРУГИХ устройств в реальном времени
    // =========================================================================

    // 'np_timecode_saved' покрывает только это устройство (np.js шлёт его после
    // своего же POST). Если смотрели на другом устройстве, здесь об этом узнать
    // неоткуда без сети — сервер уже рассылает такие события всем остальным
    // устройствам пользователя через тот же /timecode/ws, которым пользуется
    // np_profiles.js для живой синхронизации таймлайна. Свой собственный сокет —
    // чтобы не зависеть от np_profiles.js (может быть не активен) и не тянуть его
    // внутреннее состояние; сервер спокойно держит несколько соединений на
    // устройство.
    var _ws = null;
    var _wsReconnectTimer = null;

    function connectWS() {
        var token = getNpToken();
        var base = getNpBaseUrl();
        if (!token || !base) return;
        if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

        clearTimeout(_wsReconnectTimer);

        // client_id (выставляет np_profiles.js) нужен и на ЭТОМ соединении тоже —
        // иначе сервер откатывается на исключение по deviceID для соединений без
        // client_id, и такой сокет никогда не получит broadcast даже на другом
        // физическом экране с тем же токеном.
        var wsUrl = base.replace(/^http/, 'ws') + '/timecode/ws?token=' + encodeURIComponent(token) +
            '&client_id=' + encodeURIComponent(window.__npClientId || '');
        try {
            _ws = new WebSocket(wsUrl);

            _ws.onmessage = function (event) {
                try {
                    var msg = JSON.parse(event.data);
                    if (msg.type === 'timecode') onWsTimecode(msg);
                } catch (e) {}
            };

            _ws.onclose = function () {
                _ws = null;
                _wsReconnectTimer = setTimeout(connectWS, 5000);
            };
        } catch (e) {
            _wsReconnectTimer = setTimeout(connectWS, 5000);
        }
    }

    // Сервер сам исключает устройство-отправителя из рассылки (см. TimecodeHub.
    // Broadcast) — эхо своих же таймкодов сюда не прилетает, доп. дедуп не нужен.
    function onWsTimecode(msg) {
        var myProfile = getProfileId();
        if (String(msg.profile_id || '') !== String(myProfile || '')) return;
        if (!msg.card_id || !msg.item) return;

        var data = msg.data;
        try { if (typeof data === 'string') data = JSON.parse(data); } catch (e) { return; }
        if (!data) return;

        onTimecodeSaved({ card_id: msg.card_id, hash: msg.item, percent: data.percent || 0 });
    }

    function updateBadgesEverywhere(cardId, progress) {
        if (cardId) knownProgress[cardId] = progress;

        // Полная карточка, если открыта именно эта
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active && active.component === 'full') {
            var openCard = active.card_data || active.card || active.movie;
            if (openCard && cardIdOf(openCard) === cardId) {
                var posterEl = document.querySelector('.full-start-new__poster');
                if (posterEl) animateBadgeUpdate(posterEl, progress);
            }
        } else if (active && active.movie && cardIdOf(active.movie) === cardId) {
            // Торренты/Онлайн для этого же сериала — обновляем метку сразу,
            // не дожидаясь закрытия плеера.
            addNextEpisodeToExplorer(active.movie);
        }

        // Карточки в строках (каталог/подборки/непросмотренные), видимые в DOM.
        // Один и тот же сериал может одновременно рендериться в НЕСКОЛЬКИХ строках
        // (например ещё и в «Непросмотренные (MyShows)») — progress тут авторитетный
        // (свежий точечный /unwatched/progress для конкретного cardId), поэтому
        // обновляем любую совпавшую по id карточку.
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var data = cardElement.card_data || cardElement.data;
            if (!data || cardIdOf(data) !== cardId) continue;

            data.unwatched_count = progress.unwatched_count;
            data.progress_marker = progress.progress_marker;
            data.next_episode = progress.next_episode;

            var cardView = cardElement.querySelector('.card__view');
            if (cardView) animateBadgeUpdate(cardView, progress);
        }
    }

    function animateBadgeUpdate(container, progress) {
        var remainingEl = container.querySelector('.np-unwatched-remaining');
        var progressEl = container.querySelector('.np-unwatched-progress');
        var nextEl = container.querySelector('.np-unwatched-next');

        if (progress.unwatched_count <= 0) {
            // Досмотрели всё, что было вышедшим — снимаем бейджи.
            removeBadges(container);
            return;
        }

        if (isTrue(getProfileSetting(REMAINING_KEY, true))) {
            if (remainingEl) animateCounter(remainingEl, parseInt(remainingEl.textContent, 10) || 0, progress.unwatched_count);
            else { var r = document.createElement('div'); r.className = 'np-unwatched-remaining'; r.textContent = progress.unwatched_count; container.appendChild(r); }
        }
        if (isTrue(getProfileSetting(PROGRESS_KEY, true)) && progress.progress_marker) {
            var newProgressText = progress.progress_marker;
            var totalEpisodes = newProgressText.split('/')[1];
            if (progressEl) animateDigitByDigit(progressEl, progressEl.textContent, newProgressText, totalEpisodes);
            else { var p = document.createElement('div'); p.className = 'np-unwatched-progress'; p.textContent = newProgressText; container.appendChild(p); }
        }
        if (isTrue(getProfileSetting(NEXT_KEY, true)) && progress.next_episode) {
            var newNextText = progress.next_episode;
            if (nextEl) animateNextEpisode(nextEl, nextEl.textContent, newNextText);
            else { var n = document.createElement('div'); n.className = 'np-unwatched-next'; n.textContent = newNextText; container.appendChild(n); }
        }
    }

    // =========================================================================
    // Анимации (портировано из myshows.js, самодостаточно — не зависит от MyShows)
    // =========================================================================

    function flash(el) {
        el.classList.remove('np-unwatched-flip');
        void el.offsetWidth; // reflow — перезапустить анимацию, если класс уже был
        el.classList.add('np-unwatched-flip');
        setTimeout(function () { el.classList.remove('np-unwatched-flip'); }, 400);
    }

    // Счётчик остатка серий: считаем от старого числа к новому по шагам.
    function animateCounter(container, startNum, endNum) {
        if (startNum === endNum) { flash(container); return; }
        var direction = startNum < endNum ? 'up' : 'down';
        var current = startNum;
        var speed = 200;

        function step() {
            container.textContent = current;
            setTimeout(function () {
                if (direction === 'up' && current < endNum) { current++; setTimeout(step, speed); }
                else if (direction === 'down' && current > endNum) { current--; setTimeout(step, speed); }
            }, 60);
        }
        step();
    }

    // Прогресс "X/Y" — считаем первую цифру, вторая (общее число серий) не меняется
    // в рамках одного показа (меняется только когда выходит новая серия — это уже
    // покроет следующий live-апдейт). Во время счёта подсвечиваем бейдж цветом
    // направления (зелёный вверх/оранжевый вниз) — как в myshows.js, иначе
    // перелистывание цифр смотрится "сухо" на фоне их анимации.
    function animateDigitByDigit(container, oldText, newText, totalEpisodes) {
        var oldParts = (oldText || '').split('/');
        var newParts = (newText || '').split('/');
        if (oldParts.length !== 2 || newParts.length !== 2) { container.textContent = newText; flash(container); return; }

        var oldWatched = parseInt(oldParts[0], 10);
        var newWatched = parseInt(newParts[0], 10);
        if (isNaN(oldWatched) || isNaN(newWatched) || oldWatched === newWatched) {
            container.textContent = newText;
            flash(container);
            return;
        }

        var direction = oldWatched < newWatched ? 'up' : 'down';
        var current = oldWatched;
        var speed = 200;
        // Вариант 2 (метки по углам) — фон нейтральный, направление красим текстом,
        // иначе — фон самого бейджа (как у прогресса в варианте 1).
        var neutralBg = document.body.getAttribute('data-np-unwatched-badge-style') === '2';

        function step() {
            container.textContent = current + '/' + totalEpisodes;
            if (neutralBg) container.style.color = direction === 'up' ? '#4CAF50' : '#FF9800';
            else container.style.backgroundColor = direction === 'up' ? '#2E7D32' : '#EF6C00';

            setTimeout(function () {
                if (direction === 'up' && current < newWatched) { current++; setTimeout(step, speed); }
                else if (direction === 'down' && current > newWatched) { current--; setTimeout(step, speed); }
                else {
                    setTimeout(function () {
                        container.style.color = '';
                        container.style.backgroundColor = '';
                    }, 200);
                }
            }, 60);
        }
        step();
    }

    // Следующая серия "S01/E05" — как в myshows.js, 4 сценария:
    // 1) сезон уменьшился — досчитываем эпизод вниз до E01, переключаем сезон,
    //    затем считаем в новом сезоне до цели;
    // 2) сезон увеличился — сразу переключаемся на новый сезон (с E01) и считаем
    //    вверх до цели (общее число серий сезона нам неизвестно — прыгать в конец
    //    сезона не на что опереться);
    // 3) тот же сезон — считаем эпизод в одну сторону;
    // 4) без изменений по факту — вспышка.
    function animateNextEpisode(container, oldText, newText) {
        oldText = (oldText || '').trim();
        newText = (newText || '').trim();
        if (oldText === newText) return;

        var oldMatch = oldText.match(/^S(\d+)\/E(\d+)$/);
        var newMatch = newText.match(/^S(\d+)\/E(\d+)$/);
        if (!oldMatch || !newMatch) { container.textContent = newText; flash(container); return; }

        var oldSeason = parseInt(oldMatch[1], 10), oldEp = parseInt(oldMatch[2], 10);
        var newSeason = parseInt(newMatch[1], 10), newEp = parseInt(newMatch[2], 10);

        if (newSeason < oldSeason) { countDownEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp); return; }
        if (newSeason > oldSeason) { countUpEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp); return; }
        if (oldEp !== newEp) { countSameSeasonEpisode(container, oldSeason, oldEp, newEp); return; }

        container.textContent = newText;
        flash(container);
    }

    function countSameSeasonEpisode(container, season, startEp, endEp) {
        var direction = startEp < endEp ? 'up' : 'down';
        var current = startEp;
        var speed = 200;

        function step() {
            container.textContent = 'S' + padTwo(season) + '/E' + padTwo(current);
            setTimeout(function () {
                if (direction === 'up' && current < endEp) { current++; setTimeout(step, speed); }
                else if (direction === 'down' && current > endEp) { current--; setTimeout(step, speed); }
            }, 60);
        }
        step();
    }

    function countDownEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp) {
        var season = oldSeason, ep = oldEp, speed = 200;

        function step() {
            container.textContent = 'S' + padTwo(season) + '/E' + padTwo(ep);
            setTimeout(function () {
                if (season === oldSeason && ep > 1) { ep--; setTimeout(step, speed); }
                else if (season === oldSeason && ep === 1 && newSeason < oldSeason) { season--; ep = 1; setTimeout(step, speed); }
                else if (season === newSeason && ep < newEp) { ep++; setTimeout(step, speed); }
                else if (season === newSeason && ep > newEp) { ep--; setTimeout(step, speed); }
            }, 60);
        }
        step();
    }

    function countUpEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp) {
        var season = oldSeason, ep = oldEp, speed = 200;

        function step() {
            container.textContent = 'S' + padTwo(season) + '/E' + padTwo(ep);
            setTimeout(function () {
                if (season < newSeason) { season++; ep = 1; setTimeout(step, speed); }
                else if (season === newSeason && ep < newEp) { ep++; setTimeout(step, speed); }
            }, 60);
        }
        step();
    }

    // =========================================================================
    // Инициализация
    // =========================================================================

    function onProfileChanged() {
        loadProfileSettings();
        processedRowCards = [];
        knownProgress = {};
        episodeWatchedCache = {};
        removeAllEpisodeBadges();
    }

    function init() {
        var isLampa3 = Lampa.Manifest && Lampa.Manifest.app_digital >= 300;

        loadProfileSettings();
        registerSettingsSafely();
        registerNMSync();
        connectWS();

        Lampa.Listener.follow('profile', function (e) { if (e.type === 'changed') onProfileChanged(); });
        if (Lampa.Account && Lampa.Account.listener) {
            Lampa.Account.listener.follow('profile_select', function () { onProfileChanged(); });
        }
        Lampa.Listener.follow('profile_select', function () { onProfileChanged(); });
        Lampa.Listener.follow('state:changed', function (e) {
            if (e.target === 'favorite' && e.reason === 'profile') onProfileChanged();
        });

        if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) {
            Lampa.Timeline.listener.follow('update', processTimelineUpdate);
        }
        Lampa.Listener.follow('np_timecode_saved', onTimecodeSaved);

        if (isLampa3 && Lampa.Maker && Lampa.Maker.map) {
            try {
                var cardMap = Lampa.Maker.map('Card');
                if (cardMap && cardMap.Card && cardMap.Card.onVisible) {
                    var originalOnVisible = cardMap.Card.onVisible;
                    cardMap.Card.onVisible = function () {
                        originalOnVisible.call(this);
                        if (isPluginEnabled() && this.html) addBadgesToRowCard(this.html);
                    };
                }
            } catch (e) {
                log('Card.onVisible intercept failed: ' + e);
            }
        }

        log('Initialization complete, profile: ' + getProfileId());
    }

    function boot() {
        init();
        try {
            Lampa.Manifest.plugins = {
                type: 'other',
                version: VERSION,
                name: 'NP Unwatched',
                description: 'Бейджи прогресса просмотра на карточках «Непросмотренные» (локальные данные, без MyShows)'
            };
        } catch (e) {}
        console.log('NPUnwatched', 'plugin ready, version', VERSION);
    }

    if (window.appready) {
        boot();
    } else {
        Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); });
    }
})();
