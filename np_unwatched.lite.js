(function() {
    "use strict";
    var VERSION = "1.11.1";
    window.np_unwatched_plugin = true;
    var DEBUG = false;
    function log(message, data) {
        if (DEBUG) console.log("[NPUnwatched] " + message, data !== void 0 ? data : "");
    }
    function dispatchProgressEvent(cardId, progress) {
        var detail = {
            card_id: cardId,
            found: !!progress
        };
        if (progress) {
            var marker = String(progress.progress_marker || "");
            var parts = marker.split("/");
            detail.watched = parseInt(parts[0], 10) || 0;
            detail.aired = parseInt(parts[1], 10) || 0;
            detail.remaining = progress.unwatched_count || 0;
            detail.next_episode = progress.next_episode || null;
        }
        try {
            document.dispatchEvent(new CustomEvent("np-unwatched-progress", {
                detail: detail
            }));
        } catch (e) {}
    }
    var style = document.createElement("style");
    style.textContent = [ ".np-unwatched-progress {", "    position: absolute; left: 0em; bottom: 0em;", "    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 0.5em;", "    font-weight: bold; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.15);", "    background: #4CAF50; color: #fff;", "    transition: all 0.3s ease, transform 0.15s ease !important;", "}", ".np-unwatched-remaining {", "    position: absolute; right: 0em; top: 0em;", "    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 1em 0 0 1em;", "    font-weight: bold; z-index: 2;", "    background: rgba(0,0,0,0.5); color: #fff; transition: all 0.3s ease;", "}", 'body[data-status-badge-style="2"] .card .view--has-status .np-unwatched-remaining {', "    top: 1.6em;", "}", 'body[data-status-badge-style="2"] .full-start-new__poster.view--has-status .np-unwatched-remaining {', "    top: 0.95em;", "}", ".np-unwatched-next {", "    position: absolute; left: 0em; bottom: 1.5em;", "    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 0.5em;", "    font-weight: bold; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.15);", "    letter-spacing: 0.04em; line-height: 1.1;", "    background: #2196F3; color: #fff; transition: all 0.3s ease;", "}", ".np-unwatched-explorer-next {", "    margin: 0 0 1em;", "    font-size: 1.15em; font-weight: 300;", "}", ".full-episode__img, .season-episode__img, .online-prestige__img, .np-unwatched-check-anchor { position: relative; }", ".np-unwatched-episode-checked {", "    position: absolute; right: 0.4em; bottom: 0.4em;", "    width: 1.6em; height: 1.6em; border-radius: 50%;", "    background: #4CAF50; color: #fff; z-index: 3;", "    display: flex; align-items: center; justify-content: center;", "    box-shadow: 0 2px 6px rgba(0,0,0,0.4);", "    animation: npCheckPop 0.25s ease;", "}", '.np-unwatched-episode-checked::after { content: "\\2713"; font-size: 1em; font-weight: bold; line-height: 1; }', "@keyframes npCheckPop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }", "@keyframes npUnwatchedFlip {", "    0%   { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }", "    50%  { transform: scale(1); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }", "    100% { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }", "}", ".np-unwatched-flip { animation: npUnwatchedFlip 0.4s ease; }", ".np-status-btn { transition: color 0.5s ease, border-color 0.5s ease; }", ".full-start-new__poster { position: relative; }", ".full-start-new__poster .np-unwatched-progress,", ".full-start-new__poster .np-unwatched-next {", "    position: absolute; left: 0.5em; z-index: 3;", "}", ".full-start-new__poster .np-unwatched-progress,", ".full-start-new__poster .np-unwatched-remaining,", ".full-start-new__poster .np-unwatched-next {", "    transition: all 0.3s ease !important;", "}", ".full-start-new__poster .np-unwatched-progress { bottom: 0.5em; }", ".full-start-new__poster .np-unwatched-next     { bottom: 2em; }", ".full-start-new__poster .np-unwatched-remaining { top: 1em; }", "body:not([data-status-enabled]) .card .np-unwatched-remaining,", "body:not([data-status-enabled]) .full-start-new__poster .np-unwatched-remaining {", "    border-radius: 0 0.83em 0 1em;", "}", "body:not([data-status-enabled]) .full-start-new__poster .np-unwatched-remaining {", "    top: 0;", "}", "body.true--mobile.orientation--portrait .full-start-new__poster .np-unwatched-progress  { bottom: 15em; }", "body.true--mobile.orientation--portrait .full-start-new__poster .np-unwatched-next       { bottom: 17em; }", "body.true--mobile.orientation--landscape .full-start-new__poster .np-unwatched-progress  { bottom: 2.5em; }", "body.true--mobile.orientation--landscape .full-start-new__poster .np-unwatched-next       { bottom: 4em; }", "@media screen and (min-width: 580px) and (max-width: 1024px) {", "    body.true--mobile .full-start-new__poster .np-unwatched-progress  { bottom: 2.5em; font-size: 1.1em; }", "    body.true--mobile .full-start-new__poster .np-unwatched-next      { bottom: 4em;   font-size: 1.1em; }", "}", "body.glass--style.platform--browser .card .np-unwatched-progress,", "body.glass--style.platform--nw .card .np-unwatched-progress,", "body.glass--style.platform--apple .card .np-unwatched-progress {", "    background-color: rgba(76,175,80,0.8);", "    -webkit-backdrop-filter: blur(1em); backdrop-filter: blur(1em);", "}", "body.glass--style.platform--browser .card .np-unwatched-next,", "body.glass--style.platform--nw .card .np-unwatched-next,", "body.glass--style.platform--apple .card .np-unwatched-next {", "    background-color: rgba(33,150,243,0.8);", "    -webkit-backdrop-filter: blur(1em); backdrop-filter: blur(1em);", "}", 'body[data-np-unwatched-badge-style="2"] .card .np-unwatched-next,', 'body[data-np-unwatched-badge-style="2"] .full-start-new__poster .np-unwatched-next {', "    left: 0; bottom: 0; border-radius: 0 0.83em;", "    background: rgba(0,0,0,0.5); box-shadow: none;", "}", 'body[data-np-unwatched-badge-style="2"] .card .np-unwatched-progress,', 'body[data-np-unwatched-badge-style="2"] .full-start-new__poster .np-unwatched-progress {', "    left: auto; right: 0; bottom: 0; border-radius: 0.83em 0;", "    background: rgba(0,0,0,0.5); box-shadow: none;", "}", 'body[data-np-unwatched-badge-style="2"].glass--style .card .np-unwatched-progress,', 'body[data-np-unwatched-badge-style="2"].glass--style .card .np-unwatched-next {', "    background-color: rgba(0,0,0,0.5);", "    -webkit-backdrop-filter: none; backdrop-filter: none;", "}", 'body[data-np-unwatched-badge-style="2"][data-status-badge-style="2"] .card .view--has-status .np-unwatched-remaining {', "    top: 1.25em;", "}", 'body[data-np-unwatched-badge-style="2"][data-status-badge-style="2"] .full-start-new__poster.view--has-status .np-unwatched-remaining {', "    top: 0.95em;", "}" ].join("\n");
    document.head.appendChild(style);
    function getNpToken() {
        return Lampa.Storage.get("numparser_api_key", "");
    }
    function getNpBaseUrl() {
        return Lampa.Storage.get("base_url_numparser", "");
    }
    function getProfileId() {
        if (window._np_profiles_started || window.profiles_plugin) {
            var lampacId = Lampa.Storage.get("lampac_profile_id", "");
            if (lampacId) return String(lampacId);
        }
        try {
            if (Lampa.Account.Permit.account && Lampa.Account.Permit.account.profile && Lampa.Account.Permit.account.profile.id) return String(Lampa.Account.Permit.account.profile.id);
        } catch (e) {}
        return "";
    }
    function getProfileKey(baseKey) {
        var profileId = getProfileId();
        if (profileId && profileId.charAt(0) === "_") profileId = profileId.slice(1);
        return profileId ? baseKey + "_profile_" + profileId : baseKey;
    }
    function getProfileSetting(key, defaultValue) {
        return Lampa.Storage.get(getProfileKey(key), defaultValue);
    }
    function isTrue(v) {
        return v === true || v === "true";
    }
    var SETTINGS_COMPONENT = "numparser_settings";
    var BADGES_COMPONENT = "np_unwatched_badges";
    var PROGRESS_KEY = "np_unwatched_badge_progress";
    var REMAINING_KEY = "np_unwatched_badge_remaining";
    var NEXT_KEY = "np_unwatched_badge_next";
    var BADGE_STYLE_KEY = "np_unwatched_badge_style";
    var SORT_KEY = "np_unwatched_sort_order";
    var DEFAULT_SORT = "progress";
    var STATUS_BUTTONS_KEY = "np_unwatched_status_buttons";
    var VIEW_IN_MAIN_KEY = "np_unwatched_view_in_main";
    var TIMETABLE_CALENDAR_KEY = "np_unwatched_calendar";
    var DEFAULT_MIN_PROGRESS = 90;
    var WATCHING_THRESHOLD_KEY = "np_unwatched_watching_threshold";
    var DEFAULT_WATCHING_THRESHOLD = "0";
    var SYNC_PLUGIN = "np_unwatched";
    var SYNC_KEYS = [ PROGRESS_KEY, REMAINING_KEY, NEXT_KEY, BADGE_STYLE_KEY, SORT_KEY, STATUS_BUTTONS_KEY, VIEW_IN_MAIN_KEY, TIMETABLE_CALENDAR_KEY, WATCHING_THRESHOLD_KEY ];
    function storableValue(v) {
        if (v === true) return "true";
        if (v === false) return "false";
        return v;
    }
    var _syncApplying = false;
    function setProfileSetting(key, value, sync) {
        value = storableValue(value);
        Lampa.Storage.set(getProfileKey(key), value);
        if (sync !== false && !_syncApplying && window.__NMSync) window.__NMSync.patch(SYNC_PLUGIN, getProfileKey(key), value);
    }
    function hasProfileSetting(key) {
        return window.localStorage.getItem(getProfileKey(key)) !== null;
    }
    function _applySetting(profileKey, value) {
        if (profileKey.indexOf("_profile_") < 0) return;
        value = storableValue(value);
        _syncApplying = true;
        Lampa.Storage.set(profileKey, value);
        _syncApplying = false;
    }
    function registerNMSync() {
        if (!window.__NMSync) return;
        window.__NMSync.register(SYNC_PLUGIN, [], _applySetting, function(serverKeys) {
            SYNC_KEYS.forEach(function(key) {
                var profileKey = getProfileKey(key);
                if (serverKeys.indexOf(profileKey) < 0 && hasProfileSetting(key)) setProfileSetting(key, getProfileSetting(key));
            });
        });
    }
    function loadProfileSettings() {
        if (!hasProfileSetting(PROGRESS_KEY)) setProfileSetting(PROGRESS_KEY, true, false);
        if (!hasProfileSetting(REMAINING_KEY)) setProfileSetting(REMAINING_KEY, true, false);
        if (!hasProfileSetting(NEXT_KEY)) setProfileSetting(NEXT_KEY, true, false);
        if (!hasProfileSetting(BADGE_STYLE_KEY)) setProfileSetting(BADGE_STYLE_KEY, "1", false);
        if (!hasProfileSetting(SORT_KEY)) setProfileSetting(SORT_KEY, DEFAULT_SORT, false);
        if (!hasProfileSetting(STATUS_BUTTONS_KEY)) setProfileSetting(STATUS_BUTTONS_KEY, true, false);
        if (!hasProfileSetting(VIEW_IN_MAIN_KEY)) setProfileSetting(VIEW_IN_MAIN_KEY, true, false);
        if (!hasProfileSetting(TIMETABLE_CALENDAR_KEY)) setProfileSetting(TIMETABLE_CALENDAR_KEY, true, false);
        if (!hasProfileSetting(WATCHING_THRESHOLD_KEY)) setProfileSetting(WATCHING_THRESHOLD_KEY, DEFAULT_WATCHING_THRESHOLD, false);
        Lampa.Storage.set(PROGRESS_KEY, storableValue(getProfileSetting(PROGRESS_KEY, true)), true);
        Lampa.Storage.set(REMAINING_KEY, storableValue(getProfileSetting(REMAINING_KEY, true)), true);
        Lampa.Storage.set(NEXT_KEY, storableValue(getProfileSetting(NEXT_KEY, true)), true);
        Lampa.Storage.set(BADGE_STYLE_KEY, getProfileSetting(BADGE_STYLE_KEY, "1"), true);
        Lampa.Storage.set(SORT_KEY, getProfileSetting(SORT_KEY, DEFAULT_SORT), true);
        Lampa.Storage.set(STATUS_BUTTONS_KEY, storableValue(getProfileSetting(STATUS_BUTTONS_KEY, true)), true);
        Lampa.Storage.set(VIEW_IN_MAIN_KEY, storableValue(getProfileSetting(VIEW_IN_MAIN_KEY, true)), true);
        Lampa.Storage.set(TIMETABLE_CALENDAR_KEY, storableValue(getProfileSetting(TIMETABLE_CALENDAR_KEY, true)), true);
        Lampa.Storage.set(WATCHING_THRESHOLD_KEY, getProfileSetting(WATCHING_THRESHOLD_KEY, DEFAULT_WATCHING_THRESHOLD).toString(), true);
        applyBadgeStyleAttr();
    }
    function applyBadgeStyleAttr() {
        var v = getProfileSetting(BADGE_STYLE_KEY, "1").toString();
        if (v === "2") document.body.setAttribute("data-np-unwatched-badge-style", v); else document.body.removeAttribute("data-np-unwatched-badge-style");
    }
    function isPluginEnabled() {
        return isTrue(getProfileSetting(PROGRESS_KEY, true)) || isTrue(getProfileSetting(REMAINING_KEY, true)) || isTrue(getProfileSetting(NEXT_KEY, true));
    }
    var BADGES_BUTTON_NAME = "Непросмотренные — значки на карточках";
    var _badgesComponentRegistered = false;
    function registerBadgesComponent() {
        if (_badgesComponentRegistered) return;
        _badgesComponentRegistered = true;
        Lampa.Template.add("settings_" + BADGES_COMPONENT, "<div></div>");
        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: PROGRESS_KEY,
                type: "trigger",
                default: true
            },
            field: {
                name: "Прогресс эпизодов",
                description: "Просмотрено/вышло, например 5/12"
            },
            onChange: function(value) {
                setProfileSetting(PROGRESS_KEY, value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: REMAINING_KEY,
                type: "trigger",
                default: true
            },
            field: {
                name: "Осталось серий",
                description: "Количество непросмотренных серий"
            },
            onChange: function(value) {
                setProfileSetting(REMAINING_KEY, value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: NEXT_KEY,
                type: "trigger",
                default: true
            },
            field: {
                name: "Следующий эпизод",
                description: "Номер следующего эпизода для просмотра, например S01E05"
            },
            onChange: function(value) {
                setProfileSetting(NEXT_KEY, value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: BADGE_STYLE_KEY,
                type: "select",
                values: {
                    1: "Вариант 1",
                    2: "Вариант 2"
                },
                default: "1"
            },
            field: {
                name: "Расположение значков",
                description: "Вариант 2: следующий эпизод слева внизу, прогресс справа внизу, остаток серий справа вверху, скругления как у карточки"
            },
            onChange: function(value) {
                setProfileSetting(BADGE_STYLE_KEY, value.toString());
                applyBadgeStyleAttr();
            }
        });
        Lampa.SettingsApi.addParam({
            component: BADGES_COMPONENT,
            param: {
                name: SORT_KEY,
                type: "select",
                values: {
                    progress: "По прогрессу",
                    unwatched_count: "По количеству непросмотренных",
                    air_date: "По дате последнего эпизода ↓",
                    air_date_asc: "По дате последнего эпизода ↑",
                    first_unwatched_date: "По дате первого непросмотренного ↓",
                    first_unwatched_date_asc: "По дате первого непросмотренного ↑",
                    alphabet: "По алфавиту"
                },
                default: DEFAULT_SORT
            },
            field: {
                name: "Сортировка «Непросмотренные»",
                description: "Порядок показа сериалов в категории"
            },
            onChange: function(value) {
                setProfileSetting(SORT_KEY, value.toString());
            }
        });
    }
    function initSettings() {
        if (!Lampa.SettingsApi) return;
        registerBadgesComponent();
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                type: "button"
            },
            field: {
                name: BADGES_BUTTON_NAME,
                description: "Прогресс, остаток серий, следующий эпизод. Если пользуетесь myshows — отключите его значки (myshows → Значки на карточках → «Отключить все значки»), иначе будут задвоены."
            },
            onChange: function() {
                Lampa.Settings.create(BADGES_COMPONENT, {
                    onBack: function() {
                        Lampa.Settings.create(SETTINGS_COMPONENT);
                    }
                });
            }
        });
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: STATUS_BUTTONS_KEY,
                type: "trigger",
                default: true
            },
            field: {
                name: "Кнопки статуса на карточке",
                description: "Смотрю/Буду смотреть/Брошено/Не смотрю на полной карточке (пишут в личный статус, опционально дублируют в MyShows)"
            },
            onChange: function(value) {
                setProfileSetting(STATUS_BUTTONS_KEY, value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: VIEW_IN_MAIN_KEY,
                type: "trigger",
                default: true
            },
            field: {
                name: "Непросмотренные на Главной",
                description: "Строка «Непросмотренные» на главном экране (источники TMDB/CUB)"
            },
            onChange: function(value) {
                setProfileSetting(VIEW_IN_MAIN_KEY, value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: TIMETABLE_CALENDAR_KEY,
                type: "trigger",
                default: true
            },
            field: {
                name: "Смотрю в Расписании",
                description: "Дописывать сериалы со статусом «Смотрю» в нативное Расписание Lampa (даты берутся из нашего календаря)"
            },
            onChange: function(value) {
                setProfileSetting(TIMETABLE_CALENDAR_KEY, value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: WATCHING_THRESHOLD_KEY,
                type: "select",
                values: {
                    0: "Сразу при запуске",
                    5: "После 5% просмотра",
                    10: "После 10% просмотра",
                    15: "После 15% просмотра",
                    20: "После 20% просмотра",
                    25: "После 25% просмотра",
                    30: "После 30% просмотра",
                    35: "После 35% просмотра",
                    40: "После 40% просмотра",
                    45: "После 45% просмотра",
                    50: "После 50% просмотра"
                },
                default: DEFAULT_WATCHING_THRESHOLD
            },
            field: {
                name: "Порог добавления в «Смотрю»",
                description: "Когда сериал получает наш локальный статус «Смотрю» (не MyShows — свой отдельный порог у него в настройках MyShows)"
            },
            onChange: function(value) {
                setProfileSetting(WATCHING_THRESHOLD_KEY, value.toString());
            }
        });
    }
    function settingsStillRegistered() {
        if (!Lampa.SettingsApi.getParam) return true;
        var list = Lampa.SettingsApi.getParam(SETTINGS_COMPONENT) || [];
        for (var i = 0; i < list.length; i++) if (list[i].field && list[i].field.name === BADGES_BUTTON_NAME) return true;
        return false;
    }
    function waitForNumparser(callback, attemptsLeft) {
        if (attemptsLeft === void 0) attemptsLeft = 20;
        if (window.numparser_plugin || attemptsLeft <= 0) {
            callback();
            return;
        }
        setTimeout(function() {
            waitForNumparser(callback, attemptsLeft - 1);
        }, 500);
    }
    function registerSettingsSafely() {
        waitForNumparser(function() {
            initSettings();
            setTimeout(function() {
                if (!settingsStillRegistered()) initSettings();
            }, 5e3);
        });
    }
    function isTvShow(card) {
        if (!card) return false;
        return !!(card.number_of_seasons || card.seasons || card.first_air_date || card.original_name);
    }
    function cardIdOf(card) {
        if (!card || !card.id) return "";
        return card.id + "_tv";
    }
    function fetchProgress(cardId, callback) {
        var token = getNpToken();
        var base = getNpBaseUrl();
        if (!token || !base || !cardId) {
            callback(null);
            return;
        }
        var minProgress = getProfileSetting("numparser_min_progress", DEFAULT_MIN_PROGRESS);
        var url = base + "/unwatched/progress?token=" + encodeURIComponent(token) + "&card_id=" + encodeURIComponent(cardId) + "&percent=" + encodeURIComponent(minProgress);
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        var network = new Lampa.Reguest;
        network.timeout(8e3);
        network.silent(url, function(json) {
            callback(json && json.found ? json : null);
        }, function(err) {
            callback(null);
        });
    }
    function padTwo(n) {
        n = parseInt(n, 10) || 0;
        return n < 10 ? "0" + n : "" + n;
    }
    var processedRowCards = [];
    var knownProgress = {};
    function addBadgesToRowCard(cardHtml) {
        if (!isPluginEnabled()) return;
        var cardElement = cardHtml && cardHtml.get ? cardHtml.get(0) : cardHtml && cardHtml[0] ? cardHtml[0] : cardHtml;
        if (!cardElement) return;
        if (processedRowCards.indexOf(cardElement) !== -1) return;
        var data = cardElement.card_data || cardElement.data || {};
        var cardId = cardIdOf(data);
        var progress;
        if (data.unwatched_count !== void 0 && data.unwatched_count !== null) {
            progress = data;
            if (cardId) knownProgress[cardId] = {
                unwatched_count: data.unwatched_count,
                progress_marker: data.progress_marker,
                next_episode: data.next_episode
            };
        } else if (cardId && knownProgress[cardId]) progress = knownProgress[cardId]; else return;
        var cardView = cardElement.querySelector(".card__view");
        if (!cardView) return;
        processedRowCards.push(cardElement);
        renderBadges(cardView, progress);
    }
    function renderBadges(container, data) {
        var old = container.querySelectorAll(".np-unwatched-progress, .np-unwatched-remaining, .np-unwatched-next");
        for (var i = 0; i < old.length; i++) old[i].remove();
        if (isTrue(getProfileSetting(REMAINING_KEY, true)) && data.unwatched_count) {
            var r = document.createElement("div");
            r.className = "np-unwatched-remaining";
            r.textContent = data.unwatched_count;
            container.appendChild(r);
        }
        if (isTrue(getProfileSetting(PROGRESS_KEY, true)) && data.progress_marker) {
            var p = document.createElement("div");
            p.className = "np-unwatched-progress";
            p.textContent = data.progress_marker;
            container.appendChild(p);
        }
        if (isTrue(getProfileSetting(NEXT_KEY, true)) && data.next_episode) {
            var n = document.createElement("div");
            n.className = "np-unwatched-next";
            n.textContent = data.next_episode;
            container.appendChild(n);
        }
    }
    function removeBadges(container) {
        var old = container.querySelectorAll(".np-unwatched-progress, .np-unwatched-remaining, .np-unwatched-next");
        for (var i = 0; i < old.length; i++) (function(el) {
            el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
            el.style.opacity = "0";
            el.style.transform = "translateY(10px)";
            setTimeout(function() {
                if (el.parentNode) el.remove();
            }, 400);
        })(old[i]);
    }
    function removeCompletedRowCard(cardEl) {
        var parent = cardEl.parentNode;
        if (!parent) return;
        var wasFocused = cardEl.classList.contains("focus");
        var siblings = [].slice.call(parent.querySelectorAll(".card"));
        var idx = siblings.indexOf(cardEl);
        var nextFocus = null;
        if (wasFocused) nextFocus = idx > 0 ? siblings[idx - 1] : siblings[idx + 1];
        cardEl.style.transition = "opacity 0.5s ease";
        cardEl.style.opacity = "0";
        setTimeout(function() {
            if (!cardEl.parentNode) return;
            cardEl.remove();
            if (wasFocused && window.Lampa && Lampa.Controller) setTimeout(function() {
                Lampa.Controller.collectionSet(parent);
                if (nextFocus) Lampa.Controller.collectionFocus(nextFocus, parent);
            }, 50);
        }, 500);
    }
    function isSameFullCardOpen(card) {
        if (!card || !card.id) return true;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (!active || active.component !== "full") return false;
        var openCard = active.card_data || active.card || active.movie;
        if (!openCard || !openCard.id) return true;
        return String(openCard.id) === String(card.id);
    }
    function renderFullCardBadges(posterEl, progress) {
        var old = posterEl.querySelectorAll(".np-unwatched-progress, .np-unwatched-remaining, .np-unwatched-next");
        for (var i = 0; i < old.length; i++) old[i].remove();
        renderBadges(posterEl, {
            unwatched_count: progress.unwatched_count,
            progress_marker: progress.progress_marker,
            next_episode: progress.next_episode
        });
    }
    function refreshFullCardPoster(movie) {
        if (!isPluginEnabled() || !isTvShow(movie)) return;
        var cardId = cardIdOf(movie);
        fetchProgress(cardId, function(progress) {
            if (!isSameFullCardOpen(movie)) return;
            if (progress && cardId) knownProgress[cardId] = progress;
            var posterEl = document.querySelector(".full-start-new__poster");
            if (!posterEl) return;
            if (progress) renderFullCardBadges(posterEl, progress); else removeBadges(posterEl);
            dispatchProgressEvent(cardId, progress);
        });
        scheduleEpisodeBadgeDecorate();
    }
    Lampa.Listener.follow("full", function(event) {
        if (event.type !== "complite" || !event.data || !event.data.movie) return;
        refreshFullCardPoster(event.data.movie);
        renderStatusButtons(event);
    });
    function refreshFullCardPosterAnimated(movie) {
        if (!isPluginEnabled() || !isTvShow(movie)) return;
        var cardId = cardIdOf(movie);
        setTimeout(function() {
            fetchProgress(cardId, function(progress) {
                if (!isSameFullCardOpen(movie)) return;
                if (progress) knownProgress[cardId] = progress;
                var posterEl = document.querySelector(".full-start-new__poster");
                if (!posterEl) return;
                if (progress) animateBadgeUpdate(posterEl, progress); else removeBadges(posterEl);
                dispatchProgressEvent(cardId, progress);
            });
        }, 1500);
        scheduleEpisodeBadgeDecorate();
    }
    var ICON_EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>';
    var ICON_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var ICON_MINUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    var ICON_CROSS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    var TV_STATUS_OPTIONS = [ {
        status: "watching",
        title: "Смотрю",
        color: "#4CAF50",
        icon: ICON_EYE,
        myshows: "watching"
    }, {
        status: "planned",
        title: "Буду смотреть",
        color: "#2196F3",
        icon: ICON_CHECK,
        myshows: "later"
    }, {
        status: "stopped",
        title: "Перестал смотреть",
        color: "#FF9800",
        icon: ICON_MINUS,
        myshows: "cancelled"
    }, {
        status: "not_watching",
        title: "Не смотрю",
        color: "#F44336",
        icon: ICON_CROSS,
        myshows: "remove"
    } ];
    var MOVIE_STATUS_OPTIONS = [ {
        status: "watched",
        title: "Просмотрел",
        color: "#4CAF50",
        icon: ICON_EYE,
        myshows: "finished"
    }, {
        status: "planned",
        title: "Буду смотреть",
        color: "#2196F3",
        icon: ICON_CHECK,
        myshows: "later"
    }, {
        status: "not_watching",
        title: "Не смотрю",
        color: "#F44336",
        icon: ICON_CROSS,
        myshows: "remove"
    } ];
    function isMovieFullCard(movie) {
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active && active.method === "movie") return true;
        if (active && active.method === "tv") return false;
        if (!movie) return false;
        return !(movie.number_of_seasons || movie.seasons || movie.first_air_date || movie.original_name || movie.name);
    }
    function statusCardId(movie, isMovie) {
        if (!movie || !movie.id) return "";
        return movie.id + (isMovie ? "_movie" : "_tv");
    }
    function statusUrl(cardId) {
        var url = getNpBaseUrl() + "/timecode/status?token=" + encodeURIComponent(getNpToken()) + "&card_id=" + encodeURIComponent(cardId);
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        return url;
    }
    function fetchSubjectiveStatus(cardId, callback) {
        if (!getNpToken() || !cardId) {
            callback("");
            return;
        }
        fetch(statusUrl(cardId)).then(function(r) {
            return r.json();
        }).then(function(data) {
            callback(data && data.status || "");
        }).catch(function() {
            callback("");
        });
    }
    function setSubjectiveStatus(cardId, status, callback) {
        if (!getNpToken() || !cardId) {
            callback(false);
            return;
        }
        fetch(statusUrl(cardId), {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: status
            })
        }).then(function(r) {
            callback(r.ok);
        }).catch(function() {
            callback(false);
        });
    }
    function myShowsAvailable() {
        return !!(window.MyShows && window.MyShows.isLoggedIn && window.MyShows.isLoggedIn() && window.MyShows.setStatus);
    }
    function pushToMyShows(movie, myshowsStatus, isMovie) {
        if (!myShowsAvailable()) return;
        window.MyShows.setStatus(movie, myshowsStatus, isMovie, function() {});
    }
    function markMovieWatchedTimecode(movie, cardId) {
        var token = getNpToken();
        if (!token || !movie) return;
        var duration = movie.runtime ? movie.runtime * 60 : 7200;
        var percent = 90;
        var hash = Lampa.Utils.hash([ movie.original_title || movie.title || "" ].join(""));
        var url = getNpBaseUrl() + "/timecode?token=" + encodeURIComponent(token);
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                card_id: cardId,
                item: hash.toString(),
                data: JSON.stringify({
                    time: duration * percent / 100,
                    duration: duration,
                    percent: percent
                })
            })
        }).catch(function() {});
    }
    function renderStatusButtons(event) {
        if (!getNpToken()) return;
        if (!isTrue(getProfileSetting(STATUS_BUTTONS_KEY, true))) return;
        if (!event.object || !event.object.activity) return;
        var container = event.object.activity.render().find(".full-start-new__buttons");
        if (!container.length || container.data("np-status-initialized")) return;
        container.data("np-status-initialized", true);
        var movie = event.data.movie;
        var isMovie = isMovieFullCard(movie);
        var cardId = statusCardId(movie, isMovie);
        if (!cardId) return;
        var options = isMovie ? MOVIE_STATUS_OPTIONS : TV_STATUS_OPTIONS;
        var buttons = {};
        function applyActive(activeStatus) {
            options.forEach(function(opt) {
                if (opt.status === activeStatus) buttons[opt.status].css({
                    color: opt.color,
                    borderColor: opt.color
                }).addClass("np-status-active"); else buttons[opt.status].css({
                    color: "",
                    borderColor: ""
                }).removeClass("np-status-active");
            });
        }
        options.forEach(function(opt) {
            var btn = $('<div class="full-start__button selector np-status-btn" data-np-status="' + opt.status + '">' + opt.icon + "<span>" + opt.title + "</span></div>");
            btn.on("hover:enter", function() {
                if (!isSameFullCardOpen(movie)) return;
                applyActive(opt.status);
                setSubjectiveStatus(cardId, opt.status, function(ok) {
                    if (!ok) {
                        Lampa.Noty.show("Ошибка установки статуса");
                        return;
                    }
                    onStatusChanged(cardId, opt.status);
                });
                pushToMyShows(movie, opt.myshows, isMovie);
                if (isMovie && opt.status === "watched") markMovieWatchedTimecode(movie, cardId);
                refreshFullCardPosterAnimated(movie);
            });
            buttons[opt.status] = btn;
            container.append(btn);
        });
        fetchSubjectiveStatus(cardId, function(status) {
            if (!isSameFullCardOpen(movie)) return;
            applyActive(status || "not_watching");
        });
        if (window.Lampa && window.Lampa.Controller) {
            var allButtons = container.find("> *").filter(function() {
                return $(this).is(":visible");
            });
            Lampa.Controller.collectionSet(container);
            if (allButtons.length > 0) Lampa.Controller.collectionFocus(allButtons.eq(0)[0], container);
        }
    }
    function refreshStatusButtonsSmooth(movie) {
        if (!getNpToken() || !isTrue(getProfileSetting(STATUS_BUTTONS_KEY, true))) return;
        var scopeEl = document;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active && active.activity && typeof active.activity.render === "function") {
            var slide = active.activity.render(true);
            if (slide && slide[0]) scopeEl = slide[0];
        }
        var btnEls = scopeEl.querySelectorAll(".np-status-btn");
        if (!btnEls.length) return;
        var isMovie = isMovieFullCard(movie);
        var cardId = statusCardId(movie, isMovie);
        if (!cardId) return;
        var options = isMovie ? MOVIE_STATUS_OPTIONS : TV_STATUS_OPTIONS;
        fetchSubjectiveStatus(cardId, function(status) {
            if (!isSameFullCardOpen(movie)) return;
            var activeStatus = status || "not_watching";
            for (var i = 0; i < btnEls.length; i++) {
                var el = btnEls[i];
                var st = el.getAttribute("data-np-status");
                var opt = null;
                for (var j = 0; j < options.length; j++) if (options[j].status === st) {
                    opt = options[j];
                    break;
                }
                if (!opt) continue;
                var wasActive = el.classList.contains("np-status-active");
                if (st === activeStatus) {
                    el.style.color = opt.color;
                    el.style.borderColor = opt.color;
                    el.classList.add("np-status-active");
                    if (!wasActive) flash(el);
                } else {
                    el.style.color = "";
                    el.style.borderColor = "";
                    el.classList.remove("np-status-active");
                }
            }
        });
    }
    function addNextEpisodeToExplorer(movie) {
        if (!movie || !movie.id) return;
        if (!isTrue(getProfileSetting(NEXT_KEY, true))) return;
        if (!isTvShow(movie)) return;
        var cardId = cardIdOf(movie);
        fetchProgress(cardId, function(progress) {
            if (cardId) knownProgress[cardId] = progress || knownProgress[cardId];
            var attempts = 0;
            (function tryInsert() {
                var act = Lampa.Activity.active && Lampa.Activity.active();
                var actOk = act && act.movie && String(act.movie.id) === String(movie.id);
                var cardEl = actOk ? document.querySelector(".activity--active .explorer-card") : null;
                if (!actOk || !cardEl) {
                    if (++attempts < 12) setTimeout(tryInsert, 300);
                    return;
                }
                var old = cardEl.querySelector(".np-unwatched-explorer-next");
                if (!progress || !progress.next_episode) {
                    if (old) old.remove();
                    return;
                }
                if (old) old.remove();
                var el = document.createElement("div");
                el.className = "np-unwatched-explorer-next";
                el.textContent = "Следующая серия: " + progress.next_episode;
                var body = cardEl.querySelector(".explorer-card__body");
                if (body) cardEl.insertBefore(el, body); else cardEl.appendChild(el);
            })();
        });
    }
    function refreshVisibleRowCards() {
        if (!isPluginEnabled()) return;
        setTimeout(function() {
            var cards = document.querySelectorAll(".card");
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
                var cardView = cardElement.querySelector(".card__view");
                if (cardView) animateBadgeUpdate(cardView, progress);
            }
        }, 1500);
    }
    Lampa.Listener.follow("activity", function(event) {
        if (event.type === "start" && event.component !== "full" && event.object && event.object.movie) {
            addNextEpisodeToExplorer(event.object.movie);
            scheduleEpisodeBadgeDecorate();
        }
        if (event.type === "archive" && event.component === "full" && event.object && event.object.card) {
            refreshFullCardPosterAnimated(event.object.card);
            setTimeout(function() {
                refreshStatusButtonsSmooth(event.object.card);
            }, 1500);
        }
        if (event.type === "archive" && (event.component === "main" || event.component === "category")) refreshVisibleRowCards();
    });
    var episodeWatchedCache = {};
    function fetchWatchedEpisodes(cardId, callback) {
        var token = getNpToken();
        var base = getNpBaseUrl();
        if (!token || !base || !cardId) {
            callback(null);
            return;
        }
        var minProgress = getProfileSetting("numparser_min_progress", DEFAULT_MIN_PROGRESS);
        var url = base + "/unwatched/episodes?token=" + encodeURIComponent(token) + "&card_id=" + encodeURIComponent(cardId) + "&percent=" + encodeURIComponent(minProgress);
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        var network = new Lampa.Reguest;
        network.timeout(8e3);
        network.silent(url, function(json) {
            var byHash = {}, bySeasonEp = {};
            var list = json && json.episodes || [];
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                if (e.hash) byHash[e.hash] = true;
                if (e.season !== void 0 && e.episode !== void 0) bySeasonEp[e.season + "_" + e.episode] = true;
            }
            callback({
                byHash: byHash,
                bySeasonEp: bySeasonEp
            });
        }, function() {
            callback(null);
        });
    }
    function episodeLineSeason(cardEl) {
        var line = cardEl.parentNode;
        while (line && line.classList && !line.classList.contains("items-line")) line = line.parentNode;
        if (line && line.querySelector) {
            var t = line.querySelector(".items-line__title");
            if (t) {
                var m = (t.textContent || "").match(/(\d+)/);
                if (m) return parseInt(m[1], 10);
            }
        }
        var act = Lampa.Activity.active && Lampa.Activity.active();
        if (act && act.season) return parseInt(act.season, 10);
        return null;
    }
    function nearestCardAnchor(tlEl) {
        var n = tlEl, depth = 0;
        while (n && depth < 8) {
            if (n.classList) {
                if (n.classList.contains("card-watched")) return null;
                if (n.classList.contains("full-episode") || n.classList.contains("season-episode") || n.classList.contains("online-prestige")) return n;
                if (n.classList.contains("selector")) return n.classList.contains("card") ? null : n;
            }
            n = n.parentNode;
            depth++;
        }
        return null;
    }
    function collectEpisodeCards() {
        var set = [], seen = [];
        function add(el) {
            if (el && seen.indexOf(el) === -1) {
                seen.push(el);
                set.push(el);
            }
        }
        var direct = document.querySelectorAll(".full-episode, .season-episode, .online-prestige");
        for (var i = 0; i < direct.length; i++) add(direct[i]);
        var tls = document.querySelectorAll(".time-line[data-hash]");
        for (var j = 0; j < tls.length; j++) add(nearestCardAnchor(tls[j]));
        return set;
    }
    function decorateOneEpisodeCard(cardEl, watched, fallbackSeason) {
        var isWatched = false;
        var tl = cardEl.querySelector(".time-line[data-hash]");
        if (tl) {
            var hash = tl.getAttribute("data-hash");
            isWatched = !!watched.byHash[hash];
        } else {
            var numEl = cardEl.querySelector(".full-episode__num, .season-episode__episode-number");
            var num = numEl ? parseInt((numEl.textContent || "").replace(/\D/g, ""), 10) : NaN;
            var season = fallbackSeason;
            if (!isNaN(num) && season) isWatched = !!watched.bySeasonEp[season + "_" + num];
        }
        var imgBox = cardEl.querySelector(".full-episode__img, .season-episode__img, .online-prestige__img");
        if (!imgBox) {
            var img = cardEl.querySelector("img");
            if (img && img.parentNode && img.parentNode !== cardEl) imgBox = img.parentNode;
        }
        if (!imgBox) imgBox = cardEl;
        imgBox.classList.add("np-unwatched-check-anchor");
        var existing = imgBox.querySelector(".np-unwatched-episode-checked");
        if (isWatched) {
            if (!existing) {
                var badge = document.createElement("div");
                badge.className = "np-unwatched-episode-checked";
                imgBox.appendChild(badge);
                if (imgBox === cardEl) {
                    var thumb = cardEl.querySelector("img");
                    if (thumb && thumb.offsetWidth && thumb.offsetWidth < cardEl.offsetWidth * .6) badge.style.right = cardEl.offsetWidth - thumb.offsetLeft - thumb.offsetWidth + 6 + "px";
                }
            }
        } else if (existing) existing.remove();
    }
    function removeAllEpisodeBadges() {
        var b = document.querySelectorAll(".np-unwatched-episode-checked");
        for (var i = 0; i < b.length; i++) b[i].remove();
    }
    function decorateEpisodeCards() {
        if (!isTrue(getProfileSetting(REMAINING_KEY, true)) && !isTrue(getProfileSetting(PROGRESS_KEY, true)) && !isTrue(getProfileSetting(NEXT_KEY, true))) return;
        var card = getCurrentCard();
        if (!card || !isTvShow(card)) {
            removeAllEpisodeBadges();
            return;
        }
        var cards = collectEpisodeCards();
        if (!cards.length) return;
        var cardId = cardIdOf(card);
        var cached = episodeWatchedCache[cardId];
        if (!cached) {
            fetchWatchedEpisodes(cardId, function(watched) {
                if (!watched) return;
                episodeWatchedCache[cardId] = watched;
                if (cardIdOf(getCurrentCard() || {}) === cardId) decorateEpisodeCards();
            });
            return;
        }
        for (var i = 0; i < cards.length; i++) decorateOneEpisodeCard(cards[i], cached, episodeLineSeason(cards[i]));
    }
    var episodeBadgeTimer = null;
    function scheduleEpisodeBadgeDecorate() {
        if (episodeBadgeTimer) clearTimeout(episodeBadgeTimer);
        episodeBadgeTimer = setTimeout(function() {
            episodeBadgeTimer = null;
            try {
                decorateEpisodeCards();
            } catch (e) {}
        }, 150);
    }
    if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) Lampa.Timeline.listener.follow("view", scheduleEpisodeBadgeDecorate);
    function getCurrentCard() {
        var active = Lampa.Activity.active && Lampa.Activity.active();
        return active && (active.card_data || active.card || active.movie) || null;
    }
    var lastOptimisticKey = "";
    function processTimelineUpdate(e) {
        if (window.__npRemoteTimelineUpdate) return;
        if (!isPluginEnabled()) return;
        if (!e || !e.data || !e.data.hash || !e.data.road) return;
        var percent = e.data.road.percent;
        var minProgress = parseInt(getProfileSetting("numparser_min_progress", DEFAULT_MIN_PROGRESS), 10);
        if (percent < minProgress) return;
        var card = getCurrentCard();
        if (!card || !isTvShow(card)) return;
        var cardId = cardIdOf(card);
        var key = cardId + ":" + e.data.hash;
        if (key === lastOptimisticKey) return;
        lastOptimisticKey = key;
        if (episodeWatchedCache[cardId]) {
            episodeWatchedCache[cardId].byHash[e.data.hash] = true;
            scheduleEpisodeBadgeDecorate();
        }
    }
    var lastConfirmedKey = "";
    function onTimecodeSaved(e) {
        if (!isPluginEnabled() || !e || !e.card_id || !e.hash) return;
        if (e.card_id.slice(-3) !== "_tv") return;
        var minProgress = parseInt(getProfileSetting("numparser_min_progress", DEFAULT_MIN_PROGRESS), 10);
        var percent = e.percent || 0;
        if (percent > 0 && percent < minProgress) return;
        var key = e.card_id + ":" + e.hash + ":" + percent;
        if (key === lastConfirmedKey) return;
        lastConfirmedKey = key;
        var cardId = e.card_id;
        fetchProgress(cardId, function(progress) {
            if (progress) updateBadgesEverywhere(cardId, progress);
        });
        delete episodeWatchedCache[cardId];
        scheduleEpisodeBadgeDecorate();
    }
    var _ws = null;
    var _wsReconnectTimer = null;
    function connectWS() {
        var token = getNpToken();
        var base = getNpBaseUrl();
        if (!token || !base) return;
        if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;
        clearTimeout(_wsReconnectTimer);
        var wsUrl = base.replace(/^http/, "ws") + "/timecode/ws?token=" + encodeURIComponent(token) + "&client_id=" + encodeURIComponent(window.__npClientId || "");
        try {
            _ws = new WebSocket(wsUrl);
            _ws.onmessage = function(event) {
                try {
                    var msg = JSON.parse(event.data);
                    if (msg.type === "timecode") onWsTimecode(msg); else if (msg.type === "unwatched_stale") onUnwatchedStale(); else if (msg.type === "status") onWsStatus(msg);
                } catch (e) {}
            };
            _ws.onclose = function() {
                _ws = null;
                _wsReconnectTimer = setTimeout(connectWS, 5e3);
            };
        } catch (e) {
            _wsReconnectTimer = setTimeout(connectWS, 5e3);
        }
    }
    function onWsTimecode(msg) {
        var myProfile = getProfileId();
        if (String(msg.profile_id || "") !== String(myProfile || "")) return;
        if (!msg.card_id || !msg.item) return;
        var data = msg.data;
        try {
            if (typeof data === "string") data = JSON.parse(data);
        } catch (e) {
            return;
        }
        if (!data) return;
        onTimecodeSaved({
            card_id: msg.card_id,
            hash: msg.item,
            percent: data.percent || 0
        });
    }
    function onWsStatus(msg) {
        var myProfile = getProfileId();
        if (String(msg.profile_id || "") !== String(myProfile || "")) return;
        if (!msg.card_id) return;
        onStatusChanged(msg.card_id, msg.status || "");
    }
    function onUnwatchedStale() {
        if (!isPluginEnabled()) return;
        var ids = {};
        var cards = document.querySelectorAll(".card");
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
            (function(id) {
                fetchProgress(id, function(progress) {
                    if (progress) updateBadgesEverywhere(id, progress);
                });
            })(cardId);
        }
    }
    function removeCardEverywhere(cardId) {
        delete knownProgress[cardId];
        var cards = document.querySelectorAll(".card");
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var data = cardElement.card_data || cardElement.data;
            if (!data || cardIdOf(data) !== cardId) continue;
            var cardView = cardElement.querySelector(".card__view");
            if (cardView) removeBadges(cardView);
            if (data.unwatched_count !== void 0) removeCompletedRowCard(cardElement);
        }
    }
    function onStatusChanged(cardId, status) {
        if (status === "watching") fetchProgress(cardId, function(progress) {
            if (progress) updateBadgesEverywhere(cardId, progress);
        }); else removeCardEverywhere(cardId);
    }
    function updateBadgesEverywhere(cardId, progress) {
        if (cardId) knownProgress[cardId] = progress;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (active && active.component === "full") {
            var openCard = active.card_data || active.card || active.movie;
            if (openCard && cardIdOf(openCard) === cardId) {
                var posterEl = document.querySelector(".full-start-new__poster");
                if (posterEl) animateBadgeUpdate(posterEl, progress);
            }
        } else if (active && active.movie && cardIdOf(active.movie) === cardId) addNextEpisodeToExplorer(active.movie);
        var cards = document.querySelectorAll(".card");
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var data = cardElement.card_data || cardElement.data;
            if (!data || cardIdOf(data) !== cardId) continue;
            data.unwatched_count = progress.unwatched_count;
            data.progress_marker = progress.progress_marker;
            data.next_episode = progress.next_episode;
            var cardView = cardElement.querySelector(".card__view");
            if (cardView) animateBadgeUpdate(cardView, progress);
        }
    }
    function animateBadgeUpdate(container, progress) {
        var remainingEl = container.querySelector(".np-unwatched-remaining");
        var progressEl = container.querySelector(".np-unwatched-progress");
        var nextEl = container.querySelector(".np-unwatched-next");
        if (progress.unwatched_count <= 0) {
            removeBadges(container);
            var cardEl = container.closest ? container.closest(".card") : null;
            if (cardEl && cardEl.card_data && cardEl.card_data.unwatched_count !== void 0) removeCompletedRowCard(cardEl);
            return;
        }
        if (isTrue(getProfileSetting(REMAINING_KEY, true))) if (remainingEl) animateCounter(remainingEl, parseInt(remainingEl.textContent, 10) || 0, progress.unwatched_count); else {
            var r = document.createElement("div");
            r.className = "np-unwatched-remaining";
            r.textContent = progress.unwatched_count;
            container.appendChild(r);
        }
        if (isTrue(getProfileSetting(PROGRESS_KEY, true)) && progress.progress_marker) {
            var newProgressText = progress.progress_marker;
            var totalEpisodes = newProgressText.split("/")[1];
            if (progressEl) animateDigitByDigit(progressEl, progressEl.textContent, newProgressText, totalEpisodes); else {
                var p = document.createElement("div");
                p.className = "np-unwatched-progress";
                p.textContent = newProgressText;
                container.appendChild(p);
            }
        }
        if (isTrue(getProfileSetting(NEXT_KEY, true)) && progress.next_episode) {
            var newNextText = progress.next_episode;
            if (nextEl) animateNextEpisode(nextEl, nextEl.textContent, newNextText); else {
                var n = document.createElement("div");
                n.className = "np-unwatched-next";
                n.textContent = newNextText;
                container.appendChild(n);
            }
        }
    }
    function flash(el) {
        el.classList.remove("np-unwatched-flip");
        el.offsetWidth;
        el.classList.add("np-unwatched-flip");
        setTimeout(function() {
            el.classList.remove("np-unwatched-flip");
        }, 400);
    }
    function animateCounter(container, startNum, endNum) {
        if (startNum === endNum) {
            flash(container);
            return;
        }
        var direction = startNum < endNum ? "up" : "down";
        var current = startNum;
        var speed = 200;
        function step() {
            container.textContent = current;
            setTimeout(function() {
                if (direction === "up" && current < endNum) {
                    current++;
                    setTimeout(step, speed);
                } else if (direction === "down" && current > endNum) {
                    current--;
                    setTimeout(step, speed);
                }
            }, 60);
        }
        step();
    }
    function animateDigitByDigit(container, oldText, newText, totalEpisodes) {
        var oldParts = (oldText || "").split("/");
        var newParts = (newText || "").split("/");
        if (oldParts.length !== 2 || newParts.length !== 2) {
            container.textContent = newText;
            flash(container);
            return;
        }
        var oldWatched = parseInt(oldParts[0], 10);
        var newWatched = parseInt(newParts[0], 10);
        if (isNaN(oldWatched) || isNaN(newWatched) || oldWatched === newWatched) {
            container.textContent = newText;
            flash(container);
            return;
        }
        var direction = oldWatched < newWatched ? "up" : "down";
        var current = oldWatched;
        var speed = 200;
        var neutralBg = document.body.getAttribute("data-np-unwatched-badge-style") === "2";
        function step() {
            container.textContent = current + "/" + totalEpisodes;
            if (neutralBg) container.style.color = direction === "up" ? "#4CAF50" : "#FF9800"; else container.style.backgroundColor = direction === "up" ? "#2E7D32" : "#EF6C00";
            setTimeout(function() {
                if (direction === "up" && current < newWatched) {
                    current++;
                    setTimeout(step, speed);
                } else if (direction === "down" && current > newWatched) {
                    current--;
                    setTimeout(step, speed);
                } else setTimeout(function() {
                    container.style.color = "";
                    container.style.backgroundColor = "";
                }, 200);
            }, 60);
        }
        step();
    }
    function animateNextEpisode(container, oldText, newText) {
        oldText = (oldText || "").trim();
        newText = (newText || "").trim();
        if (oldText === newText) return;
        var oldMatch = oldText.match(/^S(\d+)\/E(\d+)$/);
        var newMatch = newText.match(/^S(\d+)\/E(\d+)$/);
        if (!oldMatch || !newMatch) {
            container.textContent = newText;
            flash(container);
            return;
        }
        var oldSeason = parseInt(oldMatch[1], 10), oldEp = parseInt(oldMatch[2], 10);
        var newSeason = parseInt(newMatch[1], 10), newEp = parseInt(newMatch[2], 10);
        if (newSeason < oldSeason) {
            countDownEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp);
            return;
        }
        if (newSeason > oldSeason) {
            countUpEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp);
            return;
        }
        if (oldEp !== newEp) {
            countSameSeasonEpisode(container, oldSeason, oldEp, newEp);
            return;
        }
        container.textContent = newText;
        flash(container);
    }
    function countSameSeasonEpisode(container, season, startEp, endEp) {
        var direction = startEp < endEp ? "up" : "down";
        var current = startEp;
        var speed = 200;
        function step() {
            container.textContent = "S" + padTwo(season) + "/E" + padTwo(current);
            setTimeout(function() {
                if (direction === "up" && current < endEp) {
                    current++;
                    setTimeout(step, speed);
                } else if (direction === "down" && current > endEp) {
                    current--;
                    setTimeout(step, speed);
                }
            }, 60);
        }
        step();
    }
    function countDownEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp) {
        var season = oldSeason, ep = oldEp, speed = 200;
        function step() {
            container.textContent = "S" + padTwo(season) + "/E" + padTwo(ep);
            setTimeout(function() {
                if (season === oldSeason && ep > 1) {
                    ep--;
                    setTimeout(step, speed);
                } else if (season === oldSeason && ep === 1 && newSeason < oldSeason) {
                    season--;
                    ep = 1;
                    setTimeout(step, speed);
                } else if (season === newSeason && ep < newEp) {
                    ep++;
                    setTimeout(step, speed);
                } else if (season === newSeason && ep > newEp) {
                    ep--;
                    setTimeout(step, speed);
                }
            }, 60);
        }
        step();
    }
    function countUpEpisodeSeason(container, oldSeason, oldEp, newSeason, newEp) {
        var season = oldSeason, ep = oldEp, speed = 200;
        function step() {
            container.textContent = "S" + padTwo(season) + "/E" + padTwo(ep);
            setTimeout(function() {
                if (season < newSeason) {
                    season++;
                    ep = 1;
                    setTimeout(step, speed);
                } else if (season === newSeason && ep < newEp) {
                    ep++;
                    setTimeout(step, speed);
                }
            }, 60);
        }
        step();
    }
    var MINE_COMPONENT = "np_mine";
    var MINE_CATEGORY_COMPONENT = "np_mine_category";
    var MINE_TITLE = "Моё NP";
    var MINE_ROWS = [ {
        status: "favorite",
        title: "Избранное"
    }, {
        status: "watching",
        title: "Смотрю"
    }, {
        status: "planned",
        title: "Буду смотреть"
    }, {
        status: "completed",
        title: "Просмотрел"
    }, {
        status: "stopped",
        title: "Брошено"
    } ];
    var MINE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' + '<path fill="currentColor" d="M6 2c-1.1 0-2 .9-2 2v18l8-5.333L20 22V4c0-1.1-.9-2-2-2H6z"/></svg>';
    function mediaLibraryUrl(status, page, perPage) {
        var url = getNpBaseUrl() + "/media-library?token=" + encodeURIComponent(getNpToken()) + "&status=" + encodeURIComponent(status) + "&page=" + (page || 1) + "&per_page=" + (perPage || 20);
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        return url;
    }
    function fetchMediaLibrary(status, page, perPage, onSuccess, onError) {
        fetch(mediaLibraryUrl(status, page, perPage)).then(function(r) {
            return r.json();
        }).then(onSuccess).catch(onError || function() {});
    }
    function openMineCard(data) {
        Lampa.Activity.push({
            url: "",
            component: "full",
            id: data.id,
            method: data.media_type === "tv" ? "tv" : "movie",
            card: data
        });
    }
    function addMineComponents() {
        Lampa.Component.add(MINE_COMPONENT, function(object) {
            var comp = Lampa.Maker.make("Main", object);
            comp.use({
                onCreate: function() {
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
                        for (var i = 0; i < lines.length; i++) if (lines[i]) built.push(lines[i]);
                        if (built.length) self.build(built); else self.empty();
                        self.activity.loader(false);
                    }
                    MINE_ROWS.forEach(function(row, index) {
                        fetchMediaLibrary(row.status, 1, 20, function(data) {
                            var results = data && data.results || [];
                            if (results.length) lines[index] = {
                                title: row.title,
                                results: results,
                                total_pages: data && data.total_pages || 1,
                                params: {
                                    module: Lampa.Maker.module("Line").only("Items", "Create", "More", "Event"),
                                    emit: {
                                        onMore: function() {
                                            Lampa.Activity.push({
                                                url: "",
                                                title: row.title,
                                                component: MINE_CATEGORY_COMPONENT,
                                                status: row.status,
                                                page: 1
                                            });
                                        }
                                    }
                                }
                            };
                            pending--;
                            if (pending === 0) finish();
                        }, function() {
                            pending--;
                            if (pending === 0) finish();
                        });
                    });
                },
                onInstance: function(item, data) {
                    item.use({
                        onInstance: function(card, data) {
                            card.use({
                                onEnter: function() {
                                    openMineCard(data);
                                },
                                onFocus: function() {
                                    Lampa.Background.change(Lampa.Utils.cardImgBackground(data));
                                }
                            });
                        }
                    });
                }
            });
            return comp;
        });
        Lampa.Component.add(MINE_CATEGORY_COMPONENT, function(object) {
            var comp = Lampa.Maker.make("Category", object, function(module) {
                return module.toggle(module.MASK.base, "Pagination");
            });
            comp.use({
                onCreate: function() {
                    this.activity.loader(true);
                    var self = this;
                    fetchMediaLibrary(object.status, object.page || 1, 20, function(data) {
                        self.build({
                            results: data && data.results || [],
                            total_pages: data && data.total_pages || 1
                        });
                        self.activity.loader(false);
                    }, function() {
                        self.empty();
                        self.activity.loader(false);
                    });
                },
                onNext: function(resolve, reject) {
                    fetchMediaLibrary(object.status, object.page, 20, function(data) {
                        resolve({
                            results: data && data.results || [],
                            total_pages: data && data.total_pages || 1
                        });
                    }, reject);
                },
                onInstance: function(item, data) {
                    item.use({
                        onEnter: function() {
                            openMineCard(data);
                        },
                        onFocus: function() {
                            Lampa.Background.change(Lampa.Utils.cardImgBackground(data));
                        }
                    });
                }
            });
            return comp;
        });
    }
    var UNWATCHED_MAIN_COMPONENT = "np_unwatched_full";
    var UNWATCHED_MAIN_PAGE_SIZE = 20;
    function unwatchedMainUrl(page, perPage) {
        var url = getNpBaseUrl() + "/unwatched?token=" + encodeURIComponent(getNpToken()) + "&page=" + (page || 1) + "&per_page=" + (perPage || UNWATCHED_MAIN_PAGE_SIZE) + "&sort=" + encodeURIComponent(getProfileSetting(SORT_KEY, DEFAULT_SORT));
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        return url;
    }
    function fetchUnwatchedMain(page, perPage, onSuccess, onError) {
        fetch(unwatchedMainUrl(page, perPage)).then(function(r) {
            return r.json();
        }).then(onSuccess).catch(onError || function() {});
    }
    function addNpUnwatchedData(data, oncomplite) {
        if (getNpToken() && isTrue(getProfileSetting(VIEW_IN_MAIN_KEY, true))) {
            var startProfile = getProfileId();
            fetchUnwatchedMain(1, UNWATCHED_MAIN_PAGE_SIZE, function(json) {
                if (getProfileId() === startProfile && json && json.results && json.results.length) data.unshift({
                    title: "Непросмотренные",
                    results: json.results,
                    source: "tmdb",
                    url: "np://unwatched",
                    total_pages: json.total_pages || 1
                });
                oncomplite(data);
            }, function() {
                oncomplite(data);
            });
            return true;
        }
        oncomplite(data);
        return false;
    }
    function patchActivityForNpUnwatched() {
        if (window._np_unwatched_activity_patched) return;
        window._np_unwatched_activity_patched = true;
        var originalPush = Lampa.Activity.push;
        Lampa.Activity.push = function(params) {
            if (params && params.url === "np://unwatched") return originalPush.call(this, {
                component: UNWATCHED_MAIN_COMPONENT,
                title: params.title || "Непросмотренные",
                page: params.page || 1
            });
            return originalPush.call(this, params);
        };
    }
    function addNpUnwatchedToTMDB() {
        if (window._np_unwatched_tmdb_patched) return;
        if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;
        window._np_unwatched_tmdb_patched = true;
        var originalTMDBMain = Lampa.Api.sources.tmdb.main;
        Lampa.Api.sources.tmdb.main = function(params, oncomplite, onerror) {
            return originalTMDBMain.call(this, params, function(data) {
                addNpUnwatchedData(data, oncomplite);
            }, onerror);
        };
    }
    function addNpUnwatchedToCUB() {
        if (window._np_unwatched_cub_patched) return;
        if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.cub) return;
        window._np_unwatched_cub_patched = true;
        var originalCUBMain = Lampa.Api.sources.cub.main;
        Lampa.Api.sources.cub.main = function(params, oncomplite, onerror) {
            return originalCUBMain.call(this, params, function(data) {
                addNpUnwatchedData(data, oncomplite);
            }, onerror);
        };
    }
    function addUnwatchedMainComponent() {
        Lampa.Component.add(UNWATCHED_MAIN_COMPONENT, function(object) {
            var comp = Lampa.Maker.make("Category", object, function(module) {
                return module.toggle(module.MASK.base, "Pagination");
            });
            comp.use({
                onCreate: function() {
                    this.activity.loader(true);
                    var self = this;
                    fetchUnwatchedMain(object.page || 1, 20, function(data) {
                        self.build({
                            results: data && data.results || [],
                            total_pages: data && data.total_pages || 1
                        });
                        self.activity.loader(false);
                    }, function() {
                        self.empty();
                        self.activity.loader(false);
                    });
                },
                onNext: function(resolve, reject) {
                    fetchUnwatchedMain(object.page, 20, function(data) {
                        resolve({
                            results: data && data.results || [],
                            total_pages: data && data.total_pages || 1
                        });
                    }, reject);
                },
                onInstance: function(item, data) {
                    item.use({
                        onEnter: function() {
                            openMineCard(data);
                        },
                        onFocus: function() {
                            Lampa.Background.change(Lampa.Utils.cardImgBackground(data));
                        }
                    });
                }
            });
            return comp;
        });
    }
    function npTimetableEnabled() {
        return isTrue(getProfileSetting(TIMETABLE_CALENDAR_KEY, true)) && !!getNpToken();
    }
    function calendarMonthUrl(year, month) {
        var url = getNpBaseUrl() + "/calendar?token=" + encodeURIComponent(getNpToken()) + "&year=" + year + "&month=" + month;
        var profileId = getProfileId();
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        return url;
    }
    function fetchCalendarMonth(year, month, callback) {
        fetch(calendarMonthUrl(year, month)).then(function(r) {
            return r.json();
        }).then(function(data) {
            callback(data && data.episodes || []);
        }).catch(function() {
            callback([]);
        });
    }
    function fetchCalendarWindow(callback) {
        var now = new Date;
        var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        var results = [];
        var pending = 2;
        function done() {
            if (--pending === 0) callback(results);
        }
        fetchCalendarMonth(now.getFullYear(), now.getMonth() + 1, function(eps) {
            results = results.concat(eps);
            done();
        });
        fetchCalendarMonth(next.getFullYear(), next.getMonth() + 1, function(eps) {
            results = results.concat(eps);
            done();
        });
    }
    function toRelativePosterPath(url) {
        if (!url) return null;
        var m = /\/t\/p\/\w+(\/.+)$/.exec(url);
        return m ? m[1] : url;
    }
    function mergeNpCalendarIntoTimetable(table, cardsMap, done) {
        if (!npTimetableEnabled()) {
            done();
            return;
        }
        var existingIds = {};
        table.forEach(function(e) {
            if (e && e.id != null) existingIds[e.id] = true;
        });
        fetchCalendarWindow(function(episodes) {
            var byShow = {};
            episodes.forEach(function(ep) {
                if (!ep || !ep.tmdb_id || !ep.air_date || existingIds[ep.tmdb_id]) return;
                if (!byShow[ep.tmdb_id]) byShow[ep.tmdb_id] = {
                    episodes: [],
                    card: {
                        id: ep.tmdb_id,
                        name: ep.title || "",
                        original_name: ep.title || "",
                        poster_path: toRelativePosterPath(ep.poster_path),
                        source: "tmdb"
                    }
                };
                byShow[ep.tmdb_id].episodes.push({
                    air_date: ep.air_date,
                    season_number: ep.season,
                    episode_number: ep.episode,
                    name: ep.episode_name || ""
                });
            });
            Object.keys(byShow).forEach(function(sid) {
                var id = parseInt(sid, 10);
                cardsMap[id] = byShow[sid].card;
                table.push({
                    id: id,
                    episodes: byShow[sid].episodes,
                    next: null
                });
            });
            done();
        });
    }
    function wrapTimetableFactory(originalFactory) {
        if (!originalFactory || originalFactory._npCalendarWrapped) return originalFactory;
        function WrappedTimetable(object) {
            originalFactory.call(this, object);
            var self = this;
            var realFill = this._fill;
            if (typeof realFill === "function") this._fill = function(table, cardsMap) {
                mergeNpCalendarIntoTimetable(table, cardsMap, function() {
                    realFill.call(self, table, cardsMap);
                });
            };
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
        Lampa.Component.add = function(name, factory) {
            if (name === "timetable") factory = wrapTimetableFactory(factory);
            return originalAdd.call(this, name, factory);
        };
        if (Lampa.Component.get) {
            var existing = Lampa.Component.get("timetable");
            if (existing) Lampa.Component.add("timetable", existing);
        }
    }
    function updateMineMenuItem() {
        var token = getNpToken();
        var menuItem = $('.menu__item.selector .menu__text:contains("' + MINE_TITLE + '")').closest(".menu__item");
        if (token) {
            if (menuItem.length === 0) {
                var btn = $('<li class="menu__item selector"><div class="menu__ico">' + MINE_ICON + '</div><div class="menu__text">' + MINE_TITLE + "</div></li>");
                btn.on("hover:enter", function() {
                    Lampa.Activity.push({
                        url: "",
                        title: MINE_TITLE,
                        component: MINE_COMPONENT
                    });
                });
                $(".menu .menu__list").eq(0).append(btn);
            }
        } else if (menuItem.length > 0) menuItem.remove();
    }
    var _sursMineBtn = {
        id: "np_mine",
        title: MINE_TITLE,
        icon: MINE_ICON,
        action: function() {
            Lampa.Activity.push({
                url: "",
                title: MINE_TITLE,
                component: MINE_COMPONENT
            });
        }
    };
    function sursAddMineBtn() {
        if (typeof window.surs_addExternalButton !== "function") return;
        if (!getNpToken()) {
            if (typeof window.surs_removeExternalButton === "function") window.surs_removeExternalButton(_sursMineBtn.id);
            return;
        }
        var existing = window.surs_external_buttons && window.surs_external_buttons.some(function(b) {
            return b.id === _sursMineBtn.id;
        });
        if (!existing) window.surs_addExternalButton(_sursMineBtn);
    }
    function registerSursMineBtn() {
        if (window.plugin_custom_buttons_ready) sursAddMineBtn(); else Lampa.Listener.follow("custom_buttons", function(e) {
            if (e.type === "ready") sursAddMineBtn();
        });
    }
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
        Lampa.Listener.follow("profile", function(e) {
            if (e.type === "changed") onProfileChanged();
        });
        if (Lampa.Account && Lampa.Account.listener) Lampa.Account.listener.follow("profile_select", function() {
            onProfileChanged();
        });
        Lampa.Listener.follow("profile_select", function() {
            onProfileChanged();
        });
        Lampa.Listener.follow("state:changed", function(e) {
            if (e.target === "favorite" && e.reason === "profile") onProfileChanged();
        });
        if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) Lampa.Timeline.listener.follow("update", processTimelineUpdate);
        Lampa.Listener.follow("np_timecode_saved", onTimecodeSaved);
        if (isLampa3 && Lampa.Maker && Lampa.Maker.map) try {
            var cardMap = Lampa.Maker.map("Card");
            if (cardMap && cardMap.Card && cardMap.Card.onVisible) {
                var originalOnVisible = cardMap.Card.onVisible;
                cardMap.Card.onVisible = function() {
                    originalOnVisible.call(this);
                    if (isPluginEnabled() && this.html) addBadgesToRowCard(this.html);
                };
            }
        } catch (e) {}
        getProfileId();
    }
    function boot() {
        init();
        try {
            Lampa.Manifest.plugins = {
                type: "other",
                version: VERSION,
                name: "NP Unwatched",
                description: "Бейджи прогресса просмотра на карточках «Непросмотренные» (локальные данные, без MyShows)"
            };
        } catch (e) {}
        console.log("NPUnwatched", "plugin ready, version", VERSION);
    }
    if (window.appready) boot(); else Lampa.Listener.follow("app", function(e) {
        if (e.type === "ready") boot();
    });
})();