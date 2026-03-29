(function () {
    'use strict';

    var DEBUG = false;

    function log(message, data) {
        if (DEBUG) console.log('[SerialStatus] ' + message, data !== undefined ? data : '');
    }

    var style = document.createElement('style');
    style.textContent = [
        '.card__type {',
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
        '.card__status {',
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
        '.card__status[data-status="ended"]   { background: #4CAF50; color: #fff; }',
        '.card__status[data-status="airing"]  { background: #2196F3; color: #fff; }',
        '.card__status[data-status="paused"]  { background: #FFC107; color: #222; }',
        '.card__status[data-status="canceled"]{ background: #FFC107; color: #222; }',
    ].join('\n');
    document.head.appendChild(style);

    var SETTINGS_COMPONENT = 'serial_status_settings';
    var BASE_KEY           = 'serial_status_enabled';
    var GLOBAL_DEFAULT     = true;

    // =========================================================================
    // Профиль — как в np.js / myshows.js
    // =========================================================================

    function getProfileId() {
        if (window._np_profiles_started) {
            var npId = Lampa.Storage.get('np_profile_id', '');
            if (npId) return String(npId);
        }
        if (window.profiles_plugin) {
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

    function setProfileSetting(key, value) {
        Lampa.Storage.set(getProfileKey(key), value);
    }

    function hasProfileSetting(key) {
        return window.localStorage.getItem(getProfileKey(key)) !== null;
    }

    function loadProfileSettings() {
        if (!hasProfileSetting(BASE_KEY)) {
            setProfileSetting(BASE_KEY, GLOBAL_DEFAULT);
        }
        // Восстанавливаем в Lampa.Storage — триггер UI читает именно оттуда
        Lampa.Storage.set(BASE_KEY, getProfileSetting(BASE_KEY, GLOBAL_DEFAULT), true);
    }

    function isPluginEnabled() {
        return getProfileSetting(BASE_KEY, GLOBAL_DEFAULT);
    }

    // =========================================================================
    // Карточки
    // =========================================================================

    var processedCards = [];

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
        var isTv = data.type === 'tv' || data.first_air_date || data.number_of_seasons;
        if (!isTv || !data.id) return;

        // Удаляем старые метки
        var old = cardView.querySelectorAll('.card__type, .card__status');
        for (var i = 0; i < old.length; i++) old[i].remove();

        // Метка «Сериал»
        var typeElem = document.createElement('div');
        typeElem.className = 'card__type';
        typeElem.textContent = 'Сериал';
        cardView.appendChild(typeElem);

        processedCards.push(cardElement);

        // Статус
        var existingStatus = (data.status || '').toLowerCase();
        if (existingStatus) {
            addStatusBadge(existingStatus, cardView);
        } else {
            fetchSeriesStatus(data.id, function (status) {
                if (status) addStatusBadge(status.toLowerCase(), cardView);
            });
        }
    }

    function addStatusBadge(status, cardView) {
        if (cardView.querySelector('.card__status[data-status]')) return;

        var el   = document.createElement('div');
        el.className = 'card__status';

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
    }

    function onProfileChanged() {
        loadProfileSettings();

        // Обновляем UI настроек если открыты
        setTimeout(function () {
            var panel = document.querySelector('[data-component="' + SETTINGS_COMPONENT + '"]');
            if (!panel) return;
            var toggle = panel.querySelector('[data-name="' + BASE_KEY + '"]');
            if (!toggle) return;
            var val = getProfileSetting(BASE_KEY, GLOBAL_DEFAULT);
            toggle.classList.toggle('selector--active', !!val);
        }, 100);
    }

    function init() {
        var isLampa3 = Lampa.Manifest && Lampa.Manifest.app_digital >= 300;

        loadProfileSettings();
        initSettings();

        // Смена профиля — как в np.js / myshows.js
        Lampa.Listener.follow('profile', function (e) {
            if (e.type === 'changed') onProfileChanged();
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

        log('Initialization complete, profile: ' + getProfileId());
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
