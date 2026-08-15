(function () {
    'use strict';

    var VERSION = '1.1.1';

    var DEBUG = false;

    function log(message, data) {
        if (DEBUG) console.log('[SerialStatus] ' + message, data !== undefined ? data : '');
    }

    var style = document.createElement('style');
    style.textContent = [
        '.serial-status__type {',
        '    position: absolute;',
        '    left: 0;',
        '    top: 0.8em;',
        '    padding: 0.2em 0.8em;',
        '    font-size: 0.9em;',
        '    border-radius: 0.5em;',
        '    text-transform: uppercase;',
        '    font-weight: bold;',
        '    z-index: 2;',
        '    box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
        '    letter-spacing: 0.04em;',
        '    line-height: 1.1;',
        '    background: #ff4242;',
        '    color: #fff;',
        '}',
        '.serial-status__status {',
        '    position: absolute;',
        '    left: 0;',
        '    top: 2.8em;',
        '    padding: 0.2em 0.8em;',
        '    font-size: 0.9em;',
        '    border-radius: 0.5em;',
        '    text-transform: uppercase;',
        '    font-weight: bold;',
        '    z-index: 2;',
        '    box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
        '    letter-spacing: 0.04em;',
        '    line-height: 1.1;',
        '}',
        '.serial-status__status[data-status="ended"]   { background: #4CAF50; color: #fff; }',
        '.serial-status__status[data-status="airing"]  { background: #2196F3; color: #fff; }',
        '.serial-status__status[data-status="paused"]  { background: #FFC107; color: #222; }',
        '.serial-status__status[data-status="canceled"]{ background: #FFC107; color: #222; }',
        /* ── Вариант 2 (настройка «Расположение меток»): «Сериал» — левый
           верхний угол, статус — правый верхний, не цветные.
           Радиус карточки Lampa = 1em; при font-size 0.9em это 1.11em:
           внешний угол повторяет угол карточки, противоположный — такой же. */
        'body[data-status-badge-style="2"] .serial-status__type {',
        '    top: 0; left: 0;',
        '    border-radius: 1.11em 0;',
        '    box-shadow: none;',
        '    background: rgba(0,0,0,0.5); color: #fff;',
        '}',
        'body[data-status-badge-style="2"] .serial-status__status {',
        '    top: 0; left: auto; right: 0;',
        '    border-radius: 0 1.11em;',
        '    box-shadow: none;',
        '    background: rgba(0,0,0,0.5); color: #fff;',
        '}',
        // Постер полной карточки крупнее карточек в сетке — те же em-размеры
        // на нём превращаются в непропорционально большие метки, которые
        // касаются друг друга (и наезжают на счётчик np_unwatched).
        '.full-start-new__poster .serial-status__type,',
        '.full-start-new__poster .serial-status__status {',
        '    font-size: 0.7em;',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    var SETTINGS_COMPONENT = 'serial_status_settings';
    var BASE_KEY           = 'serial_status_enabled';
    var STYLE_KEY          = 'serial_status_style';
    var GLOBAL_DEFAULT     = true;
    var SYNC_PLUGIN        = 'serial_status';
    var SYNC_KEYS          = [BASE_KEY, STYLE_KEY];

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

    var _syncApplying = false;

    // sync=false — только локально (дефолты при загрузке профиля).
    // Без флага — пользователь явно изменил, отправляем на NP-сервер.
    // Булевы пишем строками 'true'/'false': Storage.set кладёт в кеш readed сырое
    // значение, а Storage.get затирает закешированный boolean false дефолтом
    // (value || empty). Строка выживает и парсится get'ом обратно в boolean.
    function storableValue(v) {
        if (v === true) return 'true';
        if (v === false) return 'false';
        return v;
    }

    function setProfileSetting(key, value, sync) {
        value = storableValue(value);
        Lampa.Storage.set(getProfileKey(key), value);
        if (sync !== false && !_syncApplying && window.__NMSync) {
            window.__NMSync.patch(SYNC_PLUGIN, getProfileKey(key), value);
        }
    }

    // Применить настройку, пришедшую с NP-сервера (без обратной отправки)
    function _applyStatusSetting(profileKey, value) {
        if (profileKey.indexOf('_profile_') < 0) return;
        value = storableValue(value);
        _syncApplying = true;
        Lampa.Storage.set(profileKey, value);
        var base = profileKey.slice(0, profileKey.lastIndexOf('_profile_'));
        if (getProfileKey(base) === profileKey) {
            Lampa.Storage.set(base, value, true);
            if (base === STYLE_KEY) applyStatusStyleAttr();
        }
        _syncApplying = false;
    }

    function registerNMSync() {
        if (!window.__NMSync) return;
        window.__NMSync.register(SYNC_PLUGIN, [], _applyStatusSetting, function (serverKeys) {
            // Досылаем на сервер локальные значения, которых там ещё нет
            SYNC_KEYS.forEach(function (key) {
                var profileKey = getProfileKey(key);
                if (serverKeys.indexOf(profileKey) < 0 && hasProfileSetting(key)) {
                    setProfileSetting(key, getProfileSetting(key));
                }
            });
        });
    }

    function hasProfileSetting(key) {
        return window.localStorage.getItem(getProfileKey(key)) !== null;
    }

    function loadProfileSettings() {
        if (!hasProfileSetting(BASE_KEY)) {
            setProfileSetting(BASE_KEY, GLOBAL_DEFAULT, false);
        }
        if (!hasProfileSetting(STYLE_KEY)) {
            setProfileSetting(STYLE_KEY, '1', false);
        }
        // Восстанавливаем в Lampa.Storage — триггер UI читает именно оттуда
        Lampa.Storage.set(BASE_KEY, storableValue(getProfileSetting(BASE_KEY, GLOBAL_DEFAULT)), true);
        Lampa.Storage.set(STYLE_KEY, getProfileSetting(STYLE_KEY, '1'), true);

        applyStatusStyleAttr();
    }

    // Вариант расположения меток: '1' — классический (столбиком слева),
    // '2' — по верхним углам, не цветные. Переключение через атрибут на <body>.
    function applyStatusStyleAttr() {
        var v = getProfileSetting(STYLE_KEY, '1').toString();
        if (v === '2') document.body.setAttribute('data-status-badge-style', v);
        else document.body.removeAttribute('data-status-badge-style');
    }

    function isPluginEnabled() {
        return getProfileSetting(BASE_KEY, GLOBAL_DEFAULT);
    }

    // =========================================================================
    // Карточки
    // =========================================================================

    var processedCards = [];

    // Общая логика меток «Сериал» + статус — используется и для карточек в сетке
    // (.card__view), и для постера полной карточки (.full-start-new__poster).
    // Сначала снимает НАТИВНЫЕ метки Lampa (full/start.js сам вешает
    // <div class="card__type">TV</div> на постер) — иначе у нас будет и чужой
    // "TV", и наш "Сериал" одновременно.
    function decorateBadges(container, data) {
        var isTv = data.type === 'tv' || data.name || data.first_air_date || data.number_of_seasons;
        if (!isTv || !data.id) return;

        var old = container.querySelectorAll('.card__type, .card__status, .serial-status__type, .serial-status__status');
        for (var i = 0; i < old.length; i++) old[i].remove();
        container.classList.remove('view--has-status');

        var typeElem = document.createElement('div');
        typeElem.className = 'serial-status__type';
        typeElem.textContent = 'Сериал';
        container.appendChild(typeElem);

        var existingStatus = (data.status || '').toLowerCase();
        if (existingStatus) {
            addStatusBadge(existingStatus, container);
        } else {
            fetchSeriesStatus(data.id, function (status) {
                if (status) addStatusBadge(status.toLowerCase(), container);
            });
        }
    }

    function addStatusToCard(card) {
        if (!isPluginEnabled()) return;

        var cardElement = card;
        if (card && card.get)  cardElement = card.get(0);
        else if (card && card[0]) cardElement = card[0];
        if (!cardElement) return;

        if (processedCards.indexOf(cardElement) !== -1) return;

        var cardView = cardElement.querySelector('.card__view');
        if (!cardView) return;

        var data = cardElement.card_data || cardElement.data || {};
        processedCards.push(cardElement);
        decorateBadges(cardView, data);
    }

    // Постер полной карточки — отдельный элемент, переиспользуется Lampa между
    // открытиями разных карточек, поэтому без dedup-списка: просто перерисовываем
    // при каждом событии 'full'/'complite'.
    function decorateFullPoster(movie) {
        if (!isPluginEnabled() || !movie) return;
        var posterEl = document.querySelector('.full-start-new__poster');
        if (!posterEl) return;
        decorateBadges(posterEl, movie);
    }

    function addStatusBadge(status, cardView) {
        if (cardView.querySelector('.serial-status__status[data-status]')) return;

        var el   = document.createElement('div');
        el.className = 'serial-status__status';

        if (status === 'ended') {
            el.setAttribute('data-status', 'ended');
            el.textContent = 'Завершён';
        } else if (status === 'on hiatus' || status === 'paused') {
            el.setAttribute('data-status', 'paused');
            el.textContent = 'Пауза';
        } else if (status === 'canceled') {
            el.setAttribute('data-status', 'canceled');
            el.textContent = 'Отменен';
        } else if (status === 'returning series' || status === 'airing' || status === 'in production') {
            el.setAttribute('data-status', 'airing');
            el.textContent = 'В эфире';
        } else {
            return;
        }

        cardView.appendChild(el);
        // Маркер для других плагинов: правый верхний угол занят статусом
        // (myshows в варианте 2 опускает счётчик остатка под него)
        cardView.classList.add('view--has-status');
    }

    function fetchSeriesStatus(seriesId, callback) {
        var url = 'tv/' + seriesId + '?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.get('language', 'ru');
        var network = new Lampa.Reguest();
        network.timeout(5000);
        network.silent(Lampa.TMDB.api(url), function (json) {
            callback(json.status || null);
        }, function () {
            callback(null);
        });
    }

    // =========================================================================
    // Инициализация
    // =========================================================================

    function initSettings() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addComponent({
            component: SETTINGS_COMPONENT,
            name:      'Статус сериалов',
            icon:      '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#2196F3"/><rect x="4" y="6" width="16" height="12" rx="1" fill="#fff"/></svg>',
        });

        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name:    BASE_KEY,
                type:    'trigger',
                default: GLOBAL_DEFAULT,
            },
            field: {
                name:        'Показывать статус сериалов',
                description: 'Включить или отключить отображение статуса (в эфире/завершён) и метки TV на всех карточках сериалов.',
            },
            onChange: function (value) {
                setProfileSetting(BASE_KEY, value === true || value === 'true');
                log('Setting changed, profile: ' + getProfileId());
            },
        });

        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name:    STYLE_KEY,
                type:    'select',
                values:  { '1': 'Вариант 1', '2': 'Вариант 2' },
                default: '1',
            },
            field: {
                name:        'Расположение меток',
                description: 'Вариант 2: «Сериал» слева вверху, статус справа вверху, без цвета',
            },
            onChange: function (value) {
                setProfileSetting(STYLE_KEY, value.toString());
                applyStatusStyleAttr();
            },
        });
    }

    function onProfileChanged() {
        loadProfileSettings();

        // Обновляем UI настроек если открыты
        setTimeout(function () {
            var panel = document.querySelector('[data-component="' + SETTINGS_COMPONENT + '"]');
            if (!panel) return;
            var toggle = panel.querySelector('[data-name="' + BASE_KEY + '"]');
            if (toggle) {
                var val = getProfileSetting(BASE_KEY, GLOBAL_DEFAULT);
                toggle.classList.toggle('selector--active', !!val);
            }
            var styleSelect = panel.querySelector('select[data-name="' + STYLE_KEY + '"]');
            if (styleSelect) styleSelect.value = getProfileSetting(STYLE_KEY, '1').toString();
        }, 100);
    }

    function init() {
        var isLampa3 = Lampa.Manifest && Lampa.Manifest.app_digital >= 300;

        loadProfileSettings();
        initSettings();

        // NP-синхронизация настроек между устройствами. __NMSync сам дожидается
        // результата /device/ping (IS_NP), задержка не нужна
        registerNMSync();

        // Смена профиля — как в lm.js / myshows.js
        Lampa.Listener.follow('profile', function (e) {
            if (e.type === 'changed') onProfileChanged();
        });
        // Мгновенная смена нативного профиля Lampa (CUB): profile_select живёт на
        // внутреннем листенере модуля Account и на глобальный Listener не приходит.
        // np_profiles шлёт одноимённое событие на глобальном Listener — ловим оба.
        if (Lampa.Account && Lampa.Account.listener) {
            Lampa.Account.listener.follow('profile_select', function () {
                onProfileChanged();
            });
        }
        Lampa.Listener.follow('profile_select', function () {
            onProfileChanged();
        });
        Lampa.Listener.follow('state:changed', function (e) {
            if (e.target === 'favorite' && e.reason === 'profile') onProfileChanged();
        });

        // Перехватываем Card.onVisible (Lampa 3.0+)
        if (isLampa3 && Lampa.Maker && Lampa.Maker.map) {
            try {
                var cardMap = Lampa.Maker.map('Card');
                if (cardMap && cardMap.Card && cardMap.Card.onVisible) {
                    var originalOnVisible = cardMap.Card.onVisible;
                    cardMap.Card.onVisible = function () {
                        originalOnVisible.call(this);
                        if (isPluginEnabled() && this.html) addStatusToCard(this.html);
                    };
                }
            } catch (e) {
                log('Card.onVisible intercept failed: ' + e);
            }
        }

        // Постер полной карточки — Lampa сам вешает туда нативный
        // <div class="card__type">TV</div> (full/start.js), поэтому без нашей
        // перерисовки там остаётся чужой непереведённый "TV" без статуса.
        Lampa.Listener.follow('full', function (event) {
            if (event.type !== 'complite' || !event.data || !event.data.movie) return;
            decorateFullPoster(event.data.movie);
        });

        log('Initialization complete, profile: ' + getProfileId());
    }

    function boot() {
        init();
        try {
            Lampa.Manifest.plugins = {
                type: 'other',
                version: VERSION,
                name: 'Serial Status',
                description: 'Метки статуса сериалов на карточках (Онгоинг/Завершён/Отменён)'
            };
        } catch (e) {}
        console.log('SerialStatus', 'plugin ready, version', VERSION);
    }

    if (window.appready) {
        boot();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') boot();
        });
    }
})();
