(function () {
    'use strict';

    var VERSION = '1.14.0';

    // Флаг для других плагинов (см. full_hero.js): по нему можно решить, ждать
    // ли событие np-unwatched-progress ниже, или сразу считать свой лёгкий
    // локальный фолбэк (Timeline.watchedEpisode), если этого плагина нет.
    window.np_unwatched_plugin = true;

    var DEBUG = false;
    function log(message, data) {
        if (DEBUG) console.log('[NPUnwatched] ' + message, data !== undefined ? data : '');
    }

    // =========================================================================
    // Событие для сторонних плагинов (full_hero.js): готовый прогресс сериала на
    // full-карточке — watched/aired/remaining/next episode, без необходимости
    // дублировать вызов /unwatched/progress. found:false — «спросили, но нет
    // данных» (не смотрели, или это фильм), это тоже полезный ответ — слушатель
    // не должен ждать таймаут в этом случае.
    function dispatchProgressEvent(cardId, progress) {
        var detail = { card_id: cardId, found: !!progress };
        if (progress) {
            var marker = String(progress.progress_marker || '');
            var parts = marker.split('/');
            detail.watched = parseInt(parts[0], 10) || 0;
            detail.aired = parseInt(parts[1], 10) || 0;
            detail.remaining = progress.unwatched_count || 0;
            detail.next_episode = progress.next_episode || null;
        }
        try {
            document.dispatchEvent(new CustomEvent('np-unwatched-progress', { detail: detail }));
        } catch (e) {}
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
        // счётчик остатка сдвигаем ниже него. На постере status.js вешает
        // view--has-status прямо на .full-start-new__poster (тот же элемент,
        // куда np_unwatched.js добавляет .np-unwatched-remaining), поэтому
        // там нужен составной селектор без пробела — иначе правило не матчится.
        'body[data-status-badge-style="2"] .card .view--has-status .np-unwatched-remaining {',
        '    top: 1.6em;',
        '}',
        'body[data-status-badge-style="2"] .full-start-new__poster.view--has-status .np-unwatched-remaining {',
        '    top: 0.95em;',
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
        '.np-status-btn { transition: color 0.5s ease, border-color 0.5s ease; }',
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
        // Скругление угла бейджа под угол карточки/постера (border-radius: 1em
        // у обоих) — только когда статусы сериалов (status.js) выключены: иначе
        // верхний правый угол может быть занят меткой статуса (вариант 2) и
        // скруглённый бейдж там не к месту. status.js ставит data-status-enabled
        // на <body>, пока включён.
        'body:not([data-status-enabled]) .card .np-unwatched-remaining,',
        'body:not([data-status-enabled]) .full-start-new__poster .np-unwatched-remaining {',
        '    border-radius: 0 0.83em 0 1em;',
        '}',
        // При выключенных статусах верхний правый угол постера свободен —
        // поднимаем бейдж вплотную к краю (без дефолтного отступа top: 1em).
        'body:not([data-status-enabled]) .full-start-new__poster .np-unwatched-remaining {',
        '    top: 0;',
        '}',
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
        'body[data-np-unwatched-badge-style="2"][data-status-badge-style="2"] .card .view--has-status .np-unwatched-remaining {',
        '    top: 1.25em;',
        '}',
        'body[data-np-unwatched-badge-style="2"][data-status-badge-style="2"] .full-start-new__poster.view--has-status .np-unwatched-remaining {',
        '    top: 0.95em;',
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
    var STATUS_BUTTONS_KEY = 'np_unwatched_status_buttons';
    var VIEW_IN_MAIN_KEY = 'np_unwatched_view_in_main';
    var TIMETABLE_CALENDAR_KEY = 'np_unwatched_calendar';
    // Порог "серия просмотрена" — не свой, используем настройку np.js
    // numparser_min_progress (тот же смысл, что и для hide_watched).
    var DEFAULT_MIN_PROGRESS = 90;
    // Порог добавления сериала в наш локальный статус "Смотрю" — по образцу
    // myshows_add_threshold у myshows.js, но пишет в наш subjective_statuses
    // (EnsureImpliedStatus на сервере, см. db/store/status.go), не на MyShows.
    // Профильная настройка, читается сервером через plugin_settings (см. её же
    // синхронизацию ниже) — если профиль её не задал, сервер берёт свой
    // дефолт (admin-настройка watching_threshold).
    var WATCHING_THRESHOLD_KEY = 'np_unwatched_watching_threshold';
    var DEFAULT_WATCHING_THRESHOLD = '0';
    var SYNC_PLUGIN = 'np_unwatched';
    var SYNC_KEYS   = [PROGRESS_KEY, REMAINING_KEY, NEXT_KEY, BADGE_STYLE_KEY, SORT_KEY, STATUS_BUTTONS_KEY, VIEW_IN_MAIN_KEY, TIMETABLE_CALENDAR_KEY, WATCHING_THRESHOLD_KEY];

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
        if (!hasProfileSetting(STATUS_BUTTONS_KEY)) setProfileSetting(STATUS_BUTTONS_KEY, true, false);
        if (!hasProfileSetting(VIEW_IN_MAIN_KEY)) setProfileSetting(VIEW_IN_MAIN_KEY, true, false);
        if (!hasProfileSetting(TIMETABLE_CALENDAR_KEY)) setProfileSetting(TIMETABLE_CALENDAR_KEY, true, false);
        if (!hasProfileSetting(WATCHING_THRESHOLD_KEY)) setProfileSetting(WATCHING_THRESHOLD_KEY, DEFAULT_WATCHING_THRESHOLD, false);

        Lampa.Storage.set(PROGRESS_KEY, storableValue(getProfileSetting(PROGRESS_KEY, true)), true);
        Lampa.Storage.set(REMAINING_KEY, storableValue(getProfileSetting(REMAINING_KEY, true)), true);
        Lampa.Storage.set(NEXT_KEY, storableValue(getProfileSetting(NEXT_KEY, true)), true);
        Lampa.Storage.set(BADGE_STYLE_KEY, getProfileSetting(BADGE_STYLE_KEY, '1'), true);
        Lampa.Storage.set(SORT_KEY, getProfileSetting(SORT_KEY, DEFAULT_SORT), true);
        Lampa.Storage.set(STATUS_BUTTONS_KEY, storableValue(getProfileSetting(STATUS_BUTTONS_KEY, true)), true);
        Lampa.Storage.set(VIEW_IN_MAIN_KEY, storableValue(getProfileSetting(VIEW_IN_MAIN_KEY, true)), true);
        Lampa.Storage.set(TIMETABLE_CALENDAR_KEY, storableValue(getProfileSetting(TIMETABLE_CALENDAR_KEY, true)), true);
        Lampa.Storage.set(WATCHING_THRESHOLD_KEY, getProfileSetting(WATCHING_THRESHOLD_KEY, DEFAULT_WATCHING_THRESHOLD).toString(), true);

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

    // BADGES_COMPONENT (в отличие от SETTINGS_COMPONENT) никогда не чистится чужим
    // removeComponent — addParam же просто пушит в массив без дедупа, поэтому
    // регистрируем его пункты РОВНО ОДИН РАЗ за всё время жизни страницы, а не
    // при каждом вызове initSettings() (который может честно перезапускаться —
    // см. registerSettingsSafely()/settingsStillRegistered() ниже). Без этой
    // защиты повторный initSettings() дублирует все пункты «Значки на карточках».
    var _badgesComponentRegistered = false;
    function registerBadgesComponent() {
        if (_badgesComponentRegistered) return;
        _badgesComponentRegistered = true;

        Lampa.Template.add('settings_' + BADGES_COMPONENT, '<div></div>');

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

    function initSettings() {
        if (!Lampa.SettingsApi) return;

        registerBadgesComponent();

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
            component: SETTINGS_COMPONENT,
            param: { name: STATUS_BUTTONS_KEY, type: 'trigger', default: true },
            field: {
                name: 'Кнопки статуса на карточке',
                description: 'Смотрю/Буду смотреть/Брошено/Не смотрю на полной карточке (пишут в личный статус, опционально дублируют в MyShows)',
            },
            onChange: function (value) { setProfileSetting(STATUS_BUTTONS_KEY, value === true || value === 'true'); },
        });

        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: { name: VIEW_IN_MAIN_KEY, type: 'trigger', default: true },
            field: {
                name: 'Непросмотренные на Главной',
                description: 'Строка «Непросмотренные» на главном экране (источники TMDB/CUB)',
            },
            onChange: function (value) { setProfileSetting(VIEW_IN_MAIN_KEY, value === true || value === 'true'); },
        });

        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: { name: TIMETABLE_CALENDAR_KEY, type: 'trigger', default: true },
            field: {
                name: 'Смотрю в Расписании',
                description: 'Дописывать сериалы со статусом «Смотрю» в нативное Расписание Lampa (даты берутся из нашего календаря)',
            },
            onChange: function (value) { setProfileSetting(TIMETABLE_CALENDAR_KEY, value === true || value === 'true'); },
        });

        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: WATCHING_THRESHOLD_KEY, type: 'select',
                values: {
                    '0': 'Сразу при запуске',
                    '5': 'После 5% просмотра',
                    '10': 'После 10% просмотра',
                    '15': 'После 15% просмотра',
                    '20': 'После 20% просмотра',
                    '25': 'После 25% просмотра',
                    '30': 'После 30% просмотра',
                    '35': 'После 35% просмотра',
                    '40': 'После 40% просмотра',
                    '45': 'После 45% просмотра',
                    '50': 'После 50% просмотра',
                },
                default: DEFAULT_WATCHING_THRESHOLD,
            },
            field: {
                name: 'Порог добавления в «Смотрю»',
                description: 'Когда сериал получает наш локальный статус «Смотрю» (не MyShows — свой отдельный порог у него в настройках MyShows)',
            },
            onChange: function (value) { setProfileSetting(WATCHING_THRESHOLD_KEY, value.toString()); },
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

    // Живое удаление карточки со страницы «Непросмотренные», когда досмотрели
    // последнюю вышедшую серию — по образцу removeCompletedCard в myshows.js:
    // fade-out + удаление из DOM, с переносом фокуса на соседнюю карточку, если
    // удаляемая была в фокусе.
    function removeCompletedRowCard(cardEl) {
        var parent = cardEl.parentNode;
        if (!parent) return;

        var wasFocused = cardEl.classList.contains('focus');
        var siblings = [].slice.call(parent.querySelectorAll('.card'));
        var idx = siblings.indexOf(cardEl);
        var nextFocus = null;
        if (wasFocused) {
            nextFocus = idx > 0 ? siblings[idx - 1] : siblings[idx + 1];
        }

        cardEl.style.transition = 'opacity 0.5s ease';
        cardEl.style.opacity = '0';

        setTimeout(function () {
            if (!cardEl.parentNode) return;
            cardEl.remove();
            // Коллекцию (для навигации с клавиатуры/пульта) пересобираем только если
            // удалённая карточка реально была в фокусе — иначе не трогаем чужой фокус.
            if (wasFocused && window.Lampa && Lampa.Controller) {
                setTimeout(function () {
                    Lampa.Controller.collectionSet(parent);
                    if (nextFocus) Lampa.Controller.collectionFocus(nextFocus, parent);
                }, 50);
            }
        }, 500);
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
            dispatchProgressEvent(cardId, progress);
        });

        scheduleEpisodeBadgeDecorate();
    }

    Lampa.Listener.follow('full', function (event) {
        if (event.type !== 'complite' || !event.data || !event.data.movie) return;
        refreshFullCardPoster(event.data.movie);
        renderStatusButtons(event);
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
                dispatchProgressEvent(cardId, progress);
            });
        }, 1500);

        scheduleEpisodeBadgeDecorate();
    }

    // =========================================================================
    // Кнопки статуса на полной карточке (Смотрю/Буду смотреть/Брошено/Не смотрю,
    // для фильмов — Просмотрел/Буду смотреть/Брошено/Не смотрю). Пишут в наш subjective_statuses
    // (GET/PUT /timecode/status) — та же система, что и кнопки на вебе (CardDetailPage.tsx).
    // Опционально дублируют статус в MyShows через window.MyShows.setStatus (см. myshows.js),
    // если он подключён и залогинен — без собственного резолвинга MyShows id.
    // =========================================================================

    var ICON_EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>';
    var ICON_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var ICON_MINUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    var ICON_CROSS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    // status — наш ключ (subjective_statuses), myshows — словарь MyShows для той же кнопки
    // (сериалы: watching/later/cancelled/remove; фильмы: finished/later/remove — см. myshows.js createMyShowsButtons).
    // У фильмов нет статуса 'stopped' в опциях myshows (MyShows не различает "брошено"
    // для фильмов — только watched/later/remove), поэтому у нашей кнопки "Брошено" поле
    // myshows не задано — pushToMyShows() тогда просто ничего не шлёт в MyShows.
    var TV_STATUS_OPTIONS = [
        { status: 'watching',     title: 'Смотрю',            color: '#4CAF50', icon: ICON_EYE,   myshows: 'watching' },
        { status: 'planned',      title: 'Буду смотреть',      color: '#2196F3', icon: ICON_CHECK, myshows: 'later' },
        { status: 'stopped',      title: 'Брошено',           color: '#FF9800', icon: ICON_MINUS, myshows: 'cancelled' },
        { status: 'not_watching', title: 'Не смотрю',          color: '#F44336', icon: ICON_CROSS, myshows: 'remove' }
    ];
    var MOVIE_STATUS_OPTIONS = [
        { status: 'watched',      title: 'Просмотрел',    color: '#4CAF50', icon: ICON_EYE,   myshows: 'finished' },
        { status: 'planned',      title: 'Буду смотреть', color: '#2196F3', icon: ICON_CHECK, myshows: 'later' },
        { status: 'stopped',      title: 'Брошено',       color: '#FF9800', icon: ICON_MINUS },
        { status: 'not_watching', title: 'Не смотрю',      color: '#F44336', icon: ICON_CROSS, myshows: 'remove' }
    ];

    // activity.method — то, с чем реально пушили 'full' (всегда 'tv'/'movie', см. np.js
    // isMovieContent) — надёжнее, чем гадать по полям карточки; heuristics — только фолбэк
    // для случаев без активного activity (не должно случаться на 'full complite', но на всякий).
    function isMovieFullCard(movie) {
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active && active.method === 'movie') return true;
        if (active && active.method === 'tv') return false;
        if (!movie) return false;
        return !(movie.number_of_seasons || movie.seasons || movie.first_air_date || movie.original_name || movie.name);
    }

    function statusCardId(movie, isMovie) {
        if (!movie || !movie.id) return '';
        return movie.id + (isMovie ? '_movie' : '_tv');
    }

    function statusUrl(cardId) {
        var url = getNpBaseUrl() + '/timecode/status?token=' + encodeURIComponent(getNpToken()) +
            '&card_id=' + encodeURIComponent(cardId);
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
        return url;
    }

    // Текущий статус — всегда через API (не кэш/эвристики), см. GET /timecode/status.
    function fetchSubjectiveStatus(cardId, callback) {
        if (!getNpToken() || !cardId) { callback(''); return; }
        fetch(statusUrl(cardId)).then(function (r) { return r.json(); })
            .then(function (data) { callback((data && data.status) || ''); })
            .catch(function () { callback(''); });
    }

    function setSubjectiveStatus(cardId, status, callback) {
        if (!getNpToken() || !cardId) { callback(false); return; }
        fetch(statusUrl(cardId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        }).then(function (r) { callback(r.ok); }).catch(function () { callback(false); });
    }

    // window.MyShows.setStatus — опциональный экспорт из myshows.js (если плагин подключён
    // и залогинен). Без него/при отсутствии плагина кнопки работают только с нашим статусом.
    function myShowsAvailable() {
        return !!(window.MyShows && window.MyShows.isLoggedIn && window.MyShows.isLoggedIn() && window.MyShows.setStatus);
    }

    function pushToMyShows(movie, myshowsStatus, isMovie) {
        if (!myshowsStatus || !myShowsAvailable()) return;
        window.MyShows.setStatus(movie, myshowsStatus, isMovie, function () {});
    }

    // Синтетический таймкод для фильма, отмеченного «Просмотрел» без реального
    // проигрывания — по образцу myshows.js processMovies() (импорт истории): хеш от
    // названия (тот же, что дал бы Lampa.Timeline при реальном просмотре), duration —
    // из movie.runtime (минуты), 7200с (2ч) фолбэк, если TMDB его не прислал. Процент —
    // 90 (watched_threshold по умолчанию), не 100, по просьбе пользователя.
    function markMovieWatchedTimecode(movie, cardId) {
        var token = getNpToken();
        if (!token || !movie) return;
        var duration = movie.runtime ? movie.runtime * 60 : 7200;
        var percent = 90;
        var hash = Lampa.Utils.hash([movie.original_title || movie.title || ''].join(''));
        var url = getNpBaseUrl() + '/timecode?token=' + encodeURIComponent(token);
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                card_id: cardId,
                item: hash.toString(),
                data: JSON.stringify({ time: duration * percent / 100, duration: duration, percent: percent })
            })
        }).catch(function () {});
    }

    function renderStatusButtons(event) {
        if (!getNpToken()) return;
        if (!isTrue(getProfileSetting(STATUS_BUTTONS_KEY, true))) return;
        if (!event.object || !event.object.activity) return;

        var container = event.object.activity.render().find('.full-start-new__buttons');
        if (!container.length || container.data('np-status-initialized')) return;
        container.data('np-status-initialized', true);

        var movie = event.data.movie;
        var isMovie = isMovieFullCard(movie);
        var cardId = statusCardId(movie, isMovie);
        if (!cardId) return;

        var options = isMovie ? MOVIE_STATUS_OPTIONS : TV_STATUS_OPTIONS;
        var buttons = {};

        // Только цвет иконки/текста/рамки, без заливки фона — заливка поверх нативной
        // подсветки .focus (тоже полупрозрачная) давала мутный "стеклянный" вид, особенно
        // заметный в фокусе (жалоба пользователя).
        function applyActive(activeStatus) {
            options.forEach(function (opt) {
                if (opt.status === activeStatus) {
                    buttons[opt.status].css({ color: opt.color, borderColor: opt.color }).addClass('np-status-active');
                } else {
                    buttons[opt.status].css({ color: '', borderColor: '' }).removeClass('np-status-active');
                }
            });
        }

        var currentActiveStatus = 'not_watching';

        options.forEach(function (opt) {
            var btn = $('<div class="full-start__button selector np-status-btn" data-np-status="' + opt.status + '">' + opt.icon + '<span>' + opt.title + '</span></div>');
            btn.on('hover:enter', function () {
                if (!isSameFullCardOpen(movie)) return;
                // Карточка уже в этом статусе — повторный запрос бесполезен (см. аналогичный
                // guard в myshows.js), только подсветим активную кнопку.
                if (opt.status === currentActiveStatus) { applyActive(opt.status); return; }
                applyActive(opt.status);
                setSubjectiveStatus(cardId, opt.status, function (ok) {
                    if (!ok) { Lampa.Noty.show('Ошибка установки статуса'); return; }
                    currentActiveStatus = opt.status;
                    Lampa.Noty.show('Статус "' + opt.title + '" установлен');
                    // Убираем/обновляем карточку в «Непросмотренные» и других уже
                    // отрисованных списках сразу, не дожидаясь WS/следующего reload
                    // (фильмам бейджи "Непросмотренные" не касаются — там просто нет
                    // совпадающих карточек по id, вызов безвреден).
                    onStatusChanged(cardId, opt.status);
                });
                pushToMyShows(movie, opt.myshows, isMovie);
                // "Просмотрел" для фильма без правки movie.js: без реального проигрывания
                // timecode не появляется сам — иначе фильм не считается просмотренным нигде,
                // кроме нашего личного статуса (история, "Продолжить просмотр" и т.п. это не видят).
                if (isMovie && opt.status === 'watched') markMovieWatchedTimecode(movie, cardId);
                // Бейджи прогресса на постере (осталось серий/следующая серия) не связаны
                // со статусом напрямую, но кнопка — тоже "точка возврата" вроде архива после
                // плеера: если прогресс уже есть на сервере (с другого устройства и т.п.),
                // а карточка открыта давно, только сама смена статуса это не подхватывала.
                refreshFullCardPosterAnimated(movie);
            });
            buttons[opt.status] = btn;
            container.append(btn);
        });

        // Не тронутая карточка визуально показывает «Не смотрю» активной, но в БД
        // ничего не пишется (как на вебе, см. CardDetailPage.tsx) — сравнение локальное.
        fetchSubjectiveStatus(cardId, function (status) {
            if (!isSameFullCardOpen(movie)) return;
            currentActiveStatus = status || 'not_watching';
            applyActive(currentActiveStatus);
        });

        if (window.Lampa && window.Lampa.Controller) {
            var allButtons = container.find('> *').filter(function () { return $(this).is(':visible'); });
            Lampa.Controller.collectionSet(container);
            if (allButtons.length > 0) Lampa.Controller.collectionFocus(allButtons.eq(0)[0], container);
        }
    }

    // Возврат на уже открытую полную карточку после просмотра (плеер/эпизод) — кнопки
    // уже отрисованы (renderStatusButtons не перевызывается, 'complite' не шлётся
    // повторно), просто сверяем активную кнопку с сервером и подсвечиваем плавно.
    // Скоуп поиска — как в myshows.js updateButtonStates: Lampa не всегда убирает из
    // DOM предыдущую full-карточку при переходе вперёд, глобальный querySelectorAll
    // мог бы задеть кнопки чужой (неактивной) карточки в стеке.
    function refreshStatusButtonsSmooth(movie) {
        if (!getNpToken() || !isTrue(getProfileSetting(STATUS_BUTTONS_KEY, true))) return;

        var scopeEl = document;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active && active.activity && typeof active.activity.render === 'function') {
            var slide = active.activity.render(true);
            if (slide && slide[0]) scopeEl = slide[0];
        }
        var btnEls = scopeEl.querySelectorAll('.np-status-btn');
        if (!btnEls.length) return;

        var isMovie = isMovieFullCard(movie);
        var cardId = statusCardId(movie, isMovie);
        if (!cardId) return;
        var options = isMovie ? MOVIE_STATUS_OPTIONS : TV_STATUS_OPTIONS;

        fetchSubjectiveStatus(cardId, function (status) {
            if (!isSameFullCardOpen(movie)) return;
            var activeStatus = status || 'not_watching';
            for (var i = 0; i < btnEls.length; i++) {
                var el = btnEls[i];
                var st = el.getAttribute('data-np-status');
                var opt = null;
                for (var j = 0; j < options.length; j++) { if (options[j].status === st) { opt = options[j]; break; } }
                if (!opt) continue;
                var wasActive = el.classList.contains('np-status-active');
                if (st === activeStatus) {
                    el.style.color = opt.color;
                    el.style.borderColor = opt.color;
                    el.classList.add('np-status-active');
                    if (!wasActive) flash(el);
                } else {
                    el.style.color = '';
                    el.style.borderColor = '';
                    el.classList.remove('np-status-active');
                }
            }
        });
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
            setTimeout(function () { refreshStatusButtonsSmooth(event.object.card); }, 1500);
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
                    else if (msg.type === 'unwatched_stale') onUnwatchedStale();
                    else if (msg.type === 'status') onWsStatus(msg);
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

    // Статус поменяли с другого устройства/вкладки того же профиля (см. кнопки
    // статуса на полной карточке ниже) — тот же путь, что и локальный клик,
    // см. onStatusChanged.
    function onWsStatus(msg) {
        var myProfile = getProfileId();
        if (String(msg.profile_id || '') !== String(myProfile || '')) return;
        if (!msg.card_id) return;
        onStatusChanged(msg.card_id, msg.status || '');
    }

    // Сервер шлёт это раз в сутки, в момент пересечения aired_cutoff (см.
    // StartUnwatchedCutoffInvalidation) — без этого счётчик на уже отрисованной
    // карточке не поменяется, пока экран не покинут и не открыт заново (переход
    // сам вызывает свежий запрос). Точечно сверяем каждый ВИДИМЫЙ СЕЙЧАС сериал
    // через /unwatched/progress (не кешируется на сервере, всегда живой) — новые
    // карточки в уже отрисованный список так не добавить, только обновить то, что
    // уже на экране (тот же охват, что и у обновления после реального просмотра).
    function onUnwatchedStale() {
        if (!isPluginEnabled()) return;

        var ids = {};
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            var data = cards[i].card_data || cards[i].data;
            if (data && isTvShow(data)) {
                var id = cardIdOf(data);
                if (id) ids[id] = true;
            }
        }
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active) {
            var openCard = active.card_data || active.card || active.movie;
            if (openCard && isTvShow(openCard)) {
                var openId = cardIdOf(openCard);
                if (openId) ids[openId] = true;
            }
        }

        for (var cardId in ids) {
            if (!ids.hasOwnProperty(cardId)) continue;
            (function (id) {
                fetchProgress(id, function (progress) {
                    if (progress) updateBadgesEverywhere(id, progress);
                });
            })(cardId);
        }
    }

    // Статус ушёл со "Смотрю" (Перестал смотреть/Не смотрю/Буду смотреть) —
    // UnwatchedTVShowProgress перестаёт находить карточку (её "watching"-гейт
    // не пройден), поэтому progress не пришёл бы вовсе — снимаем бейджи и
    // саму карточку из уже отрисованных списков напрямую, тем же путём, что и
    // "досмотрел всё" в animateBadgeUpdate ниже.
    function removeCardEverywhere(cardId) {
        delete knownProgress[cardId];

        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var data = cardElement.card_data || cardElement.data;
            if (!data || cardIdOf(data) !== cardId) continue;

            var cardView = cardElement.querySelector('.card__view');
            if (cardView) removeBadges(cardView);
            if (data.unwatched_count !== undefined) removeCompletedRowCard(cardElement);
        }
    }

    // Общая точка для локального клика по кнопке статуса и WS-события с другого
    // устройства того же профиля — статус снова "Смотрю" обновляет бейджи (если
    // прогресс нашёлся), любой другой статус убирает карточку отовсюду на экране.
    function onStatusChanged(cardId, status) {
        if (status === 'watching') {
            fetchProgress(cardId, function (progress) {
                if (progress) updateBadgesEverywhere(cardId, progress);
            });
        } else {
            removeCardEverywhere(cardId);
        }
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
            // Досмотрели всё, что было вышедшим — снимаем бейджи. На самой странице
            // «Непросмотренные» (а не где-то ещё, где бейдж мог всплыть по знакомому
            // cardId — см. addBadgesToRowCard) убираем и саму карточку: раз серий не
            // осталось, ей тут больше не место, как и в myshows.js.
            removeBadges(container);
            var cardEl = container.closest ? container.closest('.card') : null;
            if (cardEl && cardEl.card_data && cardEl.card_data.unwatched_count !== undefined) {
                removeCompletedRowCard(cardEl);
            }
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
    // Страница «Моё» — хаб личных статусов (Избранное/Смотрю/Буду смотреть/
    // Просмотрел/Брошено), данные с сервера (subjective_statuses + Lampa
    // favorite-блоб, см. GET /media-library в movies-go). Только просмотр —
    // смена статуса из Lampa сюда пока не входит (см. CardDetailPage.tsx на
    // вебе — там есть кнопки, тут будет отдельной задачей).
    // =========================================================================

    var MINE_COMPONENT = 'np_mine';
    var MINE_CATEGORY_COMPONENT = 'np_mine_category';
    var MINE_TITLE = 'Моё NP';
    var MINE_ROWS = [
        { status: 'favorite',  title: 'Избранное' },
        { status: 'continues', title: 'Продолжить просмотр' },
        { status: 'planned',   title: 'Буду смотреть' },
        { status: 'watching',  title: 'Смотрю' },
        { status: 'completed', title: 'Просмотрел' },
        { status: 'stopped',   title: 'Брошено' }
    ];
    var MINE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' +
        '<path fill="currentColor" d="M6 2c-1.1 0-2 .9-2 2v18l8-5.333L20 22V4c0-1.1-.9-2-2-2H6z"/></svg>';

    function mediaLibraryUrl(status, page, perPage) {
        var url = getNpBaseUrl() + '/media-library?token=' + encodeURIComponent(getNpToken()) +
            '&status=' + encodeURIComponent(status) +
            '&page=' + (page || 1) + '&per_page=' + (perPage || 20);
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
        return url;
    }

    function fetchMediaLibrary(status, page, perPage, onSuccess, onError) {
        fetch(mediaLibraryUrl(status, page, perPage))
            .then(function (r) { return r.json(); })
            .then(onSuccess)
            .catch(onError || function () {});
    }

    // «Продолжить просмотр» — не subjective_statuses, а прогресс по таймкодам
    // (карточки, где просмотр начат, но не достиг watched_threshold из БД),
    // отдаётся отдельным эндпоинтом /continues (см. handleContinues/GetContinues).
    function continuesUrl(page, perPage) {
        var url = getNpBaseUrl() + '/continues?token=' + encodeURIComponent(getNpToken()) +
            '&page=' + (page || 1) + '&per_page=' + (perPage || 20);
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
        return url;
    }

    function fetchContinues(page, perPage, onSuccess, onError) {
        fetch(continuesUrl(page, perPage))
            .then(function (r) { return r.json(); })
            .then(onSuccess)
            .catch(onError || function () {});
    }

    function fetchMineRow(status, page, perPage, onSuccess, onError) {
        if (status === 'continues') fetchContinues(page, perPage, onSuccess, onError);
        else fetchMediaLibrary(status, page, perPage, onSuccess, onError);
    }

    function openMineCard(data) {
        Lampa.Activity.push({
            url: '',
            component: 'full',
            id: data.id,
            method: data.media_type === 'tv' ? 'tv' : 'movie',
            card: data
        });
    }

    function addMineComponents() {
        Lampa.Component.add(MINE_COMPONENT, function (object) {
            var comp = Lampa.Maker.make('Main', object);

            comp.use({
                onCreate: function () {
                    this.activity.loader(true);
                    var self = this;

                    if (!getNpToken()) {
                        self.empty();
                        self.activity.loader(false);
                        return;
                    }

                    var lines = new Array(MINE_ROWS.length);
                    var pending = MINE_ROWS.length;

                    function finish() {
                        var built = [];
                        for (var i = 0; i < lines.length; i++) {
                            if (lines[i]) built.push(lines[i]);
                        }
                        if (built.length) self.build(built);
                        else self.empty();
                        self.activity.loader(false);
                    }

                    MINE_ROWS.forEach(function (row, index) {
                        fetchMineRow(row.status, 1, 20, function (data) {
                            var results = (data && data.results) || [];
                            if (results.length) {
                                lines[index] = {
                                    title: row.title,
                                    results: results,
                                    total_pages: (data && data.total_pages) || 1,
                                    params: {
                                        module: Lampa.Maker.module('Line').only('Items', 'Create', 'More', 'Event'),
                                        emit: {
                                            onMore: function () {
                                                Lampa.Activity.push({
                                                    url: '',
                                                    title: row.title,
                                                    component: MINE_CATEGORY_COMPONENT,
                                                    status: row.status,
                                                    page: 1
                                                });
                                            }
                                        }
                                    }
                                };
                            }
                            pending--;
                            if (pending === 0) finish();
                        }, function () {
                            pending--;
                            if (pending === 0) finish();
                        });
                    });
                },

                onInstance: function (item, data) {
                    item.use({
                        onInstance: function (card, data) {
                            card.use({
                                onEnter: function () { openMineCard(data); },
                                onFocus: function () { Lampa.Background.change(Lampa.Utils.cardImgBackground(data)); }
                            });
                        }
                    });
                }
            });

            return comp;
        });

        Lampa.Component.add(MINE_CATEGORY_COMPONENT, function (object) {
            var comp = Lampa.Maker.make('Category', object, function (module) {
                return module.toggle(module.MASK.base, 'Pagination');
            });

            comp.use({
                onCreate: function () {
                    this.activity.loader(true);
                    var self = this;
                    fetchMineRow(object.status, object.page || 1, 20, function (data) {
                        self.build({ results: (data && data.results) || [], total_pages: (data && data.total_pages) || 1 });
                        self.activity.loader(false);
                    }, function () {
                        self.empty();
                        self.activity.loader(false);
                    });
                },
                onNext: function (resolve, reject) {
                    fetchMineRow(object.status, object.page, 20, function (data) {
                        resolve({ results: (data && data.results) || [], total_pages: (data && data.total_pages) || 1 });
                    }, reject);
                },
                onInstance: function (item, data) {
                    item.use({
                        onEnter: function () { openMineCard(data); },
                        onFocus: function () { Lampa.Background.change(Lampa.Utils.cardImgBackground(data)); }
                    });
                }
            });

            return comp;
        });
    }

    // =========================================================================
    // Строка «Непросмотренные» на нативной Главной (источники TMDB/CUB) — по
    // образцу addMyShowsToTMDB()/addMyShowsToCUB() в myshows.js, но без его
    // MyShows-кеширования: /unwatched уже отдаёт карточки в готовом Lampa-формате
    // (см. handleUnwatched), поэтому оборачивать нечего.
    // =========================================================================

    var UNWATCHED_MAIN_COMPONENT = 'np_unwatched_full';
    var UNWATCHED_MAIN_PAGE_SIZE = 20;

    function unwatchedMainUrl(page, perPage) {
        var url = getNpBaseUrl() + '/unwatched?token=' + encodeURIComponent(getNpToken()) +
            '&page=' + (page || 1) + '&per_page=' + (perPage || UNWATCHED_MAIN_PAGE_SIZE) +
            '&sort=' + encodeURIComponent(getProfileSetting(SORT_KEY, DEFAULT_SORT));
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
        return url;
    }

    function fetchUnwatchedMain(page, perPage, onSuccess, onError) {
        fetch(unwatchedMainUrl(page, perPage)).then(function (r) { return r.json(); })
            .then(onSuccess).catch(onError || function () {});
    }

    function addNpUnwatchedData(data, oncomplite) {
        if (getNpToken() && isTrue(getProfileSetting(VIEW_IN_MAIN_KEY, true))) {
            var startProfile = getProfileId();
            fetchUnwatchedMain(1, UNWATCHED_MAIN_PAGE_SIZE, function (json) {
                // Профиль мог смениться, пока строилась строка — не подмешиваем чужие данные
                if (getProfileId() === startProfile && json && json.results && json.results.length) {
                    data.unshift({
                        title: 'Непросмотренные',
                        results: json.results,
                        source: 'tmdb',
                        url: 'np://unwatched',
                        total_pages: json.total_pages || 1
                    });
                }
                oncomplite(data);
            }, function () { oncomplite(data); });
            return true;
        }
        oncomplite(data);
        return false;
    }

    // Перехват Activity.push: любая навигация с url=np://unwatched → наш полный
    // пагинированный список (по образцу patchActivityForMyShows в myshows.js).
    function patchActivityForNpUnwatched() {
        if (window._np_unwatched_activity_patched) return;
        window._np_unwatched_activity_patched = true;

        var originalPush = Lampa.Activity.push;
        Lampa.Activity.push = function (params) {
            if (params && params.url === 'np://unwatched') {
                return originalPush.call(this, {
                    component: UNWATCHED_MAIN_COMPONENT,
                    title: params.title || 'Непросмотренные',
                    page: params.page || 1
                });
            }
            return originalPush.call(this, params);
        };
    }

    // Главная TMDB
    function addNpUnwatchedToTMDB() {
        if (window._np_unwatched_tmdb_patched) return;
        if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;
        window._np_unwatched_tmdb_patched = true;

        var originalTMDBMain = Lampa.Api.sources.tmdb.main;
        Lampa.Api.sources.tmdb.main = function (params, oncomplite, onerror) {
            return originalTMDBMain.call(this, params, function (data) {
                addNpUnwatchedData(data, oncomplite);
            }, onerror);
        };
    }

    // Главная CUB
    function addNpUnwatchedToCUB() {
        if (window._np_unwatched_cub_patched) return;
        if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.cub) return;
        window._np_unwatched_cub_patched = true;

        var originalCUBMain = Lampa.Api.sources.cub.main;
        Lampa.Api.sources.cub.main = function (params, oncomplite, onerror) {
            return originalCUBMain.call(this, params, function (data) {
                addNpUnwatchedData(data, oncomplite);
            }, onerror);
        };
    }

    function addUnwatchedMainComponent() {
        Lampa.Component.add(UNWATCHED_MAIN_COMPONENT, function (object) {
            var comp = Lampa.Maker.make('Category', object, function (module) {
                return module.toggle(module.MASK.base, 'Pagination');
            });

            comp.use({
                onCreate: function () {
                    this.activity.loader(true);
                    var self = this;
                    fetchUnwatchedMain(object.page || 1, 20, function (data) {
                        self.build({ results: (data && data.results) || [], total_pages: (data && data.total_pages) || 1 });
                        self.activity.loader(false);
                    }, function () {
                        self.empty();
                        self.activity.loader(false);
                    });
                },
                onNext: function (resolve, reject) {
                    fetchUnwatchedMain(object.page, 20, function (data) {
                        resolve({ results: (data && data.results) || [], total_pages: (data && data.total_pages) || 1 });
                    }, reject);
                },
                onInstance: function (item, data) {
                    item.use({
                        onEnter: function () { openMineCard(data); },
                        onFocus: function () { Lampa.Background.change(Lampa.Utils.cardImgBackground(data)); }
                    });
                }
            });

            return comp;
        });
    }

    // =========================================================================
    // «Смотрю» в нативном Расписании Lampa — оборачиваем ЧТО БЫ ТАМ НИ БЫЛО
    // зарегистрировано как компонент 'timetable' (нативный Lampa или подставленный
    // сторонним плагином вроде myshows.js), не редактируя чужой код и не завися от
    // порядка загрузки плагинов: перехватываем Lampa.Component.add('timetable', ...)
    // на будущее И сразу оборачиваем то, что уже зарегистрировано на момент нашей
    // инициализации (могло быть подставлено раньше нас).
    //
    // Источник данных — уже существующий GET /calendar (тот же, что кормит веб-
    // страницу «Календарь»): берём текущий + следующий месяц, чтобы закрыть
    // 30-дневное окно, которое реально рисует экран Расписания.
    // =========================================================================

    function npTimetableEnabled() {
        return isTrue(getProfileSetting(TIMETABLE_CALENDAR_KEY, true)) && !!getNpToken();
    }

    function calendarMonthUrl(year, month) {
        var url = getNpBaseUrl() + '/calendar?token=' + encodeURIComponent(getNpToken()) +
            '&year=' + year + '&month=' + month;
        var profileId = getProfileId();
        if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
        return url;
    }

    function fetchCalendarMonth(year, month, callback) {
        fetch(calendarMonthUrl(year, month)).then(function (r) { return r.json(); })
            .then(function (data) { callback((data && data.episodes) || []); })
            .catch(function () { callback([]); });
    }

    // Текущий + следующий месяц покрывают любое 30-дневное окно от «сегодня».
    function fetchCalendarWindow(callback) {
        var now = new Date();
        var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        var results = [];
        var pending = 2;
        function done() { if (--pending === 0) callback(results); }
        fetchCalendarMonth(now.getFullYear(), now.getMonth() + 1, function (eps) { results = results.concat(eps); done(); });
        fetchCalendarMonth(next.getFullYear(), next.getMonth() + 1, function (eps) { results = results.concat(eps); done(); });
    }

    // /calendar отдаёт poster_path уже полным URL (http://image.tmdb.org/t/p/w500/...),
    // а и нативный timetable-рендер, и myshows.js ждут относительный TMDB-путь
    // (сами добавляют t/p/wNNN/ спереди) — обрезаем размерный сегмент обратно.
    function toRelativePosterPath(url) {
        if (!url) return null;
        var m = /\/t\/p\/\w+(\/.+)$/.exec(url);
        return m ? m[1] : url;
    }

    // Дописывает в table/cardsMap сериалы из нашего календаря, которых там ещё
    // нет (Lampa-закладки/MyShows уже в table к моменту вызова — не задваиваем),
    // затем вызывает done(). table/cardsMap — те же объекты, что принимает
    // TimeTable-компонент (см. Lampa.TimeTable.all()/myshows.js _fill).
    function mergeNpCalendarIntoTimetable(table, cardsMap, done) {
        if (!npTimetableEnabled()) { done(); return; }

        var existingIds = {};
        table.forEach(function (e) { if (e && e.id != null) existingIds[e.id] = true; });

        fetchCalendarWindow(function (episodes) {
            var byShow = {};
            episodes.forEach(function (ep) {
                if (!ep || !ep.tmdb_id || !ep.air_date || existingIds[ep.tmdb_id]) return;
                if (!byShow[ep.tmdb_id]) {
                    byShow[ep.tmdb_id] = {
                        episodes: [],
                        card: {
                            id: ep.tmdb_id,
                            name: ep.title || '',
                            original_name: ep.title || '',
                            poster_path: toRelativePosterPath(ep.poster_path),
                            source: 'tmdb'
                        }
                    };
                }
                byShow[ep.tmdb_id].episodes.push({
                    air_date: ep.air_date,
                    season_number: ep.season,
                    episode_number: ep.episode,
                    name: ep.episode_name || ''
                });
            });
            Object.keys(byShow).forEach(function (sid) {
                var id = parseInt(sid, 10);
                cardsMap[id] = byShow[sid].card;
                table.push({ id: id, episodes: byShow[sid].episodes, next: null });
            });
            done();
        });
    }

    // Оборачивает компонент 'timetable' (фабрика, вызываемая через `new`):
    // после того как оригинал отработал this.create()/присвоил this._fill —
    // если у инстанса есть _fill (миф myshows.js-подобной реализации; у голого
    // нативного компонента Lampa его нет — там своя, другая структура, и мы её
    // не трогаем, остаётся как есть) — оборачиваем его домешиванием нашего
    // календаря перед реальной отрисовкой.
    function wrapTimetableFactory(originalFactory) {
        if (!originalFactory || originalFactory._npCalendarWrapped) return originalFactory;

        function WrappedTimetable(object) {
            originalFactory.call(this, object);
            var self = this;
            var realFill = this._fill;
            if (typeof realFill === 'function') {
                this._fill = function (table, cardsMap) {
                    mergeNpCalendarIntoTimetable(table, cardsMap, function () {
                        realFill.call(self, table, cardsMap);
                    });
                };
            }
        }
        WrappedTimetable._npCalendarWrapped = true;
        WrappedTimetable.prototype = originalFactory.prototype;
        return WrappedTimetable;
    }

    function patchNativeTimetable() {
        if (!Lampa.Component || !Lampa.Component.add) return;
        if (window._np_unwatched_timetable_patched) return;
        window._np_unwatched_timetable_patched = true;

        var originalAdd = Lampa.Component.add;
        Lampa.Component.add = function (name, factory) {
            if (name === 'timetable') factory = wrapTimetableFactory(factory);
            return originalAdd.call(this, name, factory);
        };

        // То, что уже зарегистрировано на момент нашей инициализации (нативный
        // Lampa или сторонний плагин, успевший подставиться раньше нас) —
        // перерегистрируем через уже пропатченный .add выше, чтобы обернуть и его.
        if (Lampa.Component.get) {
            var existing = Lampa.Component.get('timetable');
            if (existing) Lampa.Component.add('timetable', existing);
        }
    }

    function updateMineMenuItem() {
        var token = getNpToken();
        var menuItem = $('.menu__item.selector .menu__text:contains("' + MINE_TITLE + '")').closest('.menu__item');

        if (token) {
            if (menuItem.length === 0) {
                var btn = $('<li class="menu__item selector"><div class="menu__ico">' + MINE_ICON + '</div><div class="menu__text">' + MINE_TITLE + '</div></li>');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({ url: '', title: MINE_TITLE, component: MINE_COMPONENT });
                });
                $('.menu .menu__list').eq(0).append(btn);
            }
        } else if (menuItem.length > 0) {
            menuItem.remove();
        }
    }

    // ── SURS-интеграция (по образцу myshows.js) ─────────────────────────────
    var _sursMineBtn = {
        id: 'np_mine',
        title: MINE_TITLE,
        icon: MINE_ICON,
        action: function () { Lampa.Activity.push({ url: '', title: MINE_TITLE, component: MINE_COMPONENT }); }
    };

    function sursAddMineBtn() {
        if (typeof window.surs_addExternalButton !== 'function') return;
        if (!getNpToken()) {
            if (typeof window.surs_removeExternalButton === 'function') window.surs_removeExternalButton(_sursMineBtn.id);
            return;
        }
        var existing = window.surs_external_buttons && window.surs_external_buttons.some(function (b) { return b.id === _sursMineBtn.id; });
        if (!existing) window.surs_addExternalButton(_sursMineBtn);
    }

    function registerSursMineBtn() {
        if (window.plugin_custom_buttons_ready) {
            sursAddMineBtn();
        } else {
            Lampa.Listener.follow('custom_buttons', function (e) {
                if (e.type === 'ready') sursAddMineBtn();
            });
        }
    }
    // ── end SURS-интеграция ──────────────────────────────────────────────────

    // =========================================================================
    // Инициализация
    // =========================================================================

    function onProfileChanged() {
        loadProfileSettings();
        processedRowCards = [];
        knownProgress = {};
        episodeWatchedCache = {};
        removeAllEpisodeBadges();
        updateMineMenuItem();
    }

    function init() {
        var isLampa3 = Lampa.Manifest && Lampa.Manifest.app_digital >= 300;

        // Патчим источники Главной сразу — до любых async-операций, иначе Lampa
        // успевает вызвать tmdb.main/cub.main до нашего патча (как в myshows.js).
        addNpUnwatchedToTMDB();
        addNpUnwatchedToCUB();
        patchActivityForNpUnwatched();
        addUnwatchedMainComponent();
        patchNativeTimetable();

        loadProfileSettings();
        registerSettingsSafely();
        registerNMSync();
        connectWS();

        addMineComponents();
        waitForNumparser(updateMineMenuItem);
        registerSursMineBtn();

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
