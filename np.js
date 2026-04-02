 (function () {
    'use strict';

    var DEFAULT_SOURCE_NAME = 'NUMParser';
    var SOURCE_NAME = Lampa.Storage.get('numparser_source_name', DEFAULT_SOURCE_NAME);
    var newName = SOURCE_NAME;
    var BASE_URL = (function() {
    var scriptUrl = (document.currentScript && document.currentScript.src) || '';
    var params = new URLSearchParams(scriptUrl.split('?')[1]);
    return params.get('base_url') || 'https://numparser.igorek1986.ru';
    })();
    var ICON = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"><g><g><path fill="currentColor" d="M482.909,67.2H29.091C13.05,67.2,0,80.25,0,96.291v319.418C0,431.75,13.05,444.8,29.091,444.8h453.818c16.041,0,29.091-13.05,29.091-29.091V96.291C512,80.25,498.95,67.2,482.909,67.2z M477.091,409.891H34.909V102.109h442.182V409.891z"/></g></g><g><g><rect fill="currentColor" x="126.836" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="350.255" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="367.709" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="367.709" y="292.364" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="292.364" width="126.836" height="34.909"/></g></g></svg>';
    var DEFAULT_MIN_PROGRESS = 90;
    var MIN_PROGRESS = Lampa.Storage.get('numparser_min_progress', DEFAULT_MIN_PROGRESS);
    var newProgress = MIN_PROGRESS;
    Lampa.Storage.set('base_url_numparser', BASE_URL);
    var NUMPARSER_HIDE_WATCHED = null;


    function createLogMethod(emoji, consoleMethod) {
        var DEBUG = Lampa.Storage.get('numparser_debug_mode', false);
        if (!DEBUG) {
            return function() {};
        }

        return function() {
            var args = Array.prototype.slice.call(arguments);
            if (emoji) {
                args.unshift(emoji);
            }
            args.unshift('Numparser');
            consoleMethod.apply(console, args);
        };
    }

    var Log = {
        info: createLogMethod('ℹ️', console.log),
        error: createLogMethod('❌', console.error),
        warn: createLogMethod('⚠️', console.warn),
        debug: createLogMethod('🐛', console.debug)
    };

    function getAllCategories() {
        var currentYear = new Date().getFullYear();
        var list = [
            { key: 'np_popular',             title: 'Популярно в NP' },
            { key: 'myshows_unwatched', title: 'Непросмотренные (MyShows)' },
            { key: 'lampac_movies_ru_new',      title: 'Новые русские фильмы' },
            { key: 'lampac_movies_new',         title: 'Новые фильмы' },
            { key: 'lampac_all_tv_shows',       title: 'Сериалы' },
            { key: 'lampac_all_tv_shows_ru',    title: 'Русские сериалы' },
            { key: 'continues', title: "Продолжить просмотр NUMParser"},
            { key: 'continues_movie', title: "Продолжить просмотр (Фильмы)"},
            { key: 'continues_tv', title: "Продолжить просмотр (Сериалы)"},
            { key: 'continues_anime', title: "Продолжить просмотр (Аниме)"},
            { key: 'episodes',           title: 'Ближайшие выходы эпизодов' },
            { key: 'recent',             title: "Недавние выходы эпизодов"},
            { key: 'lampac_movies_4k_new',      title: 'В высоком качестве (новые)' },
            { key: 'legends_id',         title: 'Топ фильмы' },
            { key: 'lampac_movies_4k',          title: 'В высоком качестве' },
            { key: 'lampac_movies',             title: 'Фильмы' },
            { key: 'lampac_movies_ru',          title: 'Русские фильмы' },
            { key: 'lampac_all_cartoon_movies', title: 'Мультфильмы' },
            { key: 'lampac_all_cartoon_series', title: 'Мультсериалы' },
            { key: 'lampac_all_anime',           title: 'Аниме' },
            { key: 'anime_id',           title: 'Аниме' }
        ];

        // Добавляем годы в ОБРАТНОМ порядке: от нового к старому
        for (var y = currentYear; y >= 1980; y--) {
            list.push({ key: 'year_' + y, title: 'Фильмы ' + y + ' года' });
        }

        return list;
    }

    function NumparserApiService() {
        var self = this;
        self.network = new Lampa.Reguest();
        self.discovery = false;

        function normalizeData(json, callback) {
            var normalized = {
                results: (json.results || []).map(function (item) {

                    var poster_path = item.poster_path || item.poster || '';
                    // Если это полный URL — извлекаем только путь после домена
                    if (poster_path && poster_path.indexOf('http') === 0) {
                        var match = poster_path.match(/\/t\/p\/[^\/]+\/(.+)$/);
                        if (match) {
                            poster_path = '/' + match[1];
                        } else {
                            poster_path = '';
                        }
                    }

                    var dataItem = {
                        id: item.id,
                        poster_path: poster_path,
                        img: item.img,
                        overview: item.overview || item.description || '',
                        vote_average: item.vote_average || 0,
                        backdrop_path: item.backdrop_path || item.backdrop || '',
                        background_image: item.background_image,
                        source: Lampa.Storage.get('numparser_source_name') || SOURCE_NAME,
                        media_type: item.media_type || ((item.first_air_date || item.number_of_seasons) ? 'tv' : 'movie'),
                        original_title: item.original_title || item.original_name || '',
                        title: item.title || item.name || '',
                        original_language: item.original_language || 'en',
                        first_air_date: item.first_air_date,
                        number_of_seasons: item.number_of_seasons,
                        status: item.status || '',
                    };

                    if (item.release_quality) {
                        var mode = getProfileSetting('numparser_quality_mode', 'simple');
                        dataItem.release_quality = mode === 'simple'
                            ? getQuality(item.release_quality)
                            : item.release_quality;
                    }
                    if (item.release_date) dataItem.release_date = item.release_date;
                    if (item.last_air_date) dataItem.last_air_date = item.last_air_date;
                    if (item.last_episode_to_air) dataItem.last_episode_to_air = item.last_episode_to_air;
                    if (item.seasons) dataItem.seasons = item.seasons;
                    if (item.progress_marker) dataItem.progress_marker = item.progress_marker;
                    if (item.watched_count !== undefined) dataItem.watched_count = item.watched_count;
                    if (item.total_count !== undefined) dataItem.total_count = item.total_count;
                    if (item.released_count !== undefined) dataItem.released_count = item.released_count;
                    if (item.last_episode_to_myshows !== undefined) dataItem.last_episode_to_myshows = item.last_episode_to_myshows;

                    dataItem.promo_title = dataItem.title || dataItem.name || dataItem.original_title || dataItem.original_name;
                    dataItem.promo = dataItem.overview;

                    return dataItem;
                }),
                page: json.page || 1,
                total_pages: json.total_pages || json.pagesCount || 1,
                total_results: json.total_results || json.total || 0
            };

            callback(normalized);
        }

        self.get = function (url, params, onComplete, onError) {
            self.network.silent(url, function (json) {
                if (!json) {
                    onError(new Error('Empty response from server'));
                    return;
                }

                normalizeData(json, function(normalizedJson) {
                    onComplete(normalizedJson);
                });
            }, function (error) {
                onError(error);
            });
        };

        self.list = function (params, onComplete, onError) {
            params = params || {};
            onComplete = onComplete || function () {};
            onError = onError || function () {};

            var category = params.url;
            var page = params.page || 1;
            var isContinues = category === 'continues' || category.indexOf('continues_') === 0;
            var token = '';
            if (Lampa.Storage.get('numparser_hide_watched') || isContinues) {
                token = Lampa.Storage.get('numparser_api_key', '');
            }

            var url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');
            if (token) {
                url += '&token=' + encodeURIComponent(token);
                var profileId = getProfileId();
                if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
                var minProgress = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
                url += '&min_progress=' + encodeURIComponent(minProgress);
            }

            self.get(url, params, function (json) {
                onComplete({
                    results: json.results || [],
                    page: json.page || page,
                    total_pages: json.total_pages || 1,
                    total_results: json.total_results || 0
                });
            }, onError);
        };

        self.full = function (params, onSuccess, onError) {
            var card = params.card;
            params.method = !!(card.number_of_seasons || card.seasons || card.last_episode_to_air || card.first_air_date) ? 'tv' : 'movie';
            Lampa.Api.sources.tmdb.full(params, onSuccess, onError);
        }

        self.category = function (params, onSuccess, onError) {
            params = params || {};
            var partsData = [];

            var allCategories = getAllCategories();
            var menuOrder = getProfileSetting('numparser_menu_sort', []);

            // Инициализация при первом запуске
            if (!Array.isArray(menuOrder) || menuOrder.length === 0) {
                menuOrder = [];
                for (var i = 0; i < allCategories.length; i++) {
                    menuOrder.push(allCategories[i].key);
                }
                setProfileSetting('numparser_menu_sort', menuOrder);
            }

            var menuHide = getProfileSetting('numparser_menu_hide', []);

            // Формируем actualOrder: сначала то, что в menuOrder и существует, потом новые
            var actualOrder = [];

            // Шаг 1: добавляем существующие из menuOrder
            for (var i = 0; i < menuOrder.length; i++) {
                var key = menuOrder[i];
                var found = false;
                for (var j = 0; j < allCategories.length; j++) {
                    if (allCategories[j].key === key) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    actualOrder.push(key);
                }
            }

            // Шаг 2: добавляем новые категории, которых нет в actualOrder
            for (var j = 0; j < allCategories.length; j++) {
                var cat = allCategories[j];
                var exists = false;
                for (var i = 0; i < actualOrder.length; i++) {
                    if (actualOrder[i] === cat.key) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    actualOrder.push(cat.key);
                }
            }

            // Теперь перебираем actualOrder
            for (var idx = 0; idx < actualOrder.length; idx++) {
                var key = actualOrder[idx];

                // Проверка скрытия через indexOf вместо includes
                var isHidden = false;
                for (var h = 0; h < menuHide.length; h++) {
                    if (menuHide[h] === key) {
                        isHidden = true;
                        break;
                    }
                }
                if (isHidden) continue;

                // Поиск категории по ключу (вместо find)
                var cat = null;
                for (var j = 0; j < allCategories.length; j++) {
                    if (allCategories[j].key === key) {
                        cat = allCategories[j];
                        break;
                    }
                }
                if (!cat) continue;

                // MyShows — особый случай
                if (key === 'myshows_unwatched') {
                    var hasCreds = Lampa.Storage.get('myshows_login') && Lampa.Storage.get('myshows_password');
                    if (!hasCreds) continue;
                    if (!window.MyShows || !window.MyShows.getUnwatchedShowsWithDetails) continue;

                    // 🔥 Захватываем title СЕЙЧАС
                    var currentTitle = cat.title;

                    partsData.push(function (callback) {
                        window.MyShows.getUnwatchedShowsWithDetails(function(response) {
                            if (response.error || !response.shows || response.shows.length === 0) {
                                callback({skip: true});
                                return;
                            }
                            callback({
                                title: currentTitle, // ← Используем захваченное значение
                                results: response.shows,
                                nomore: true
                            });
                        });
                    });
                    continue;
                }

                // Эпизоды
                if (key === 'episodes') {
                    var addEpisodes = Lampa.Manifest.app_digital >= 300 ? addEpisodesV3 : addEpisodesV2;
                    addEpisodes(partsData, cat.title, Lampa.TimeTable.lately);
                    continue;
                }

                if (key === 'recent') {
                    if (Lampa.Manifest.app_digital >= 300) {
                        addEpisodesV3(partsData, cat.title, Lampa.TimeTable.recently);
                    }
                    continue;
                }

                if (key === 'continues_movie') {
                    if (Lampa.Manifest.app_digital >= 300) {
                        addContinues(partsData, cat.title, Lampa.Favorite.continues, 'movie');
                    }
                    continue;
                }

                if (key === 'continues_tv') {
                    if (Lampa.Manifest.app_digital >= 300) {
                        addContinues(partsData, cat.title, Lampa.Favorite.continues, 'tv');
                    }
                    continue;
                }

                if (key === 'continues_anime') {
                    if (Lampa.Manifest.app_digital >= 300) {
                        addContinues(partsData, cat.title, Lampa.Favorite.continues, 'anime');
                    }
                    continue;
                }

                // Все остальные — включая годы
                var urlPart = key.startsWith('year_')
                    ? 'movies_id_' + key.replace('year_', '')
                    : key;
                // Создаём замыкание, чтобы сохранить title
                (function (url, title) {
                    partsData.push(function (callback) {
                        makeRequest(url, title, callback);
                    });
                })(urlPart, cat.title);
            }


            function addEpisodesV2(partsData, title) {
                partsData.push(function (callback) {
                    callback({
                        source: 'tmdb',
                        results: Lampa.TimeTable.lately().slice(0, 20),
                        title: title,
                        nomore: true,
                        cardClass: function (elem, params) {
                            return new Episode(elem, params);
                        }
                    });
                });
            }

            function addEpisodesV3(partsData, title, getFunc) {
                partsData.push(function (callback) {
                    var results = getFunc().slice(0, 20);

                    results.forEach(function(item) {
                        item.params = {
                            createInstance: function(data) {
                                return Lampa.Maker.make('Episode', data, function(module) {
                                    return module.only('Card', 'Callback');
                                });
                            },
                            emit: {
                                onlyEnter: function() {
                                    Lampa.Router.call('full', item.card);
                                },
                                onlyFocus: function() {
                                    Lampa.Background.change(Lampa.Utils.cardImgBackgroundBlur(item.card));
                                }
                            }
                        };

                        Lampa.Arrays.extend(item, item.episode);
                    });

                    callback({
                        source: 'tmdb',
                        results: results,
                        title: title,
                        nomore: true
                    });
                });
            }

            function addContinues(partsData, title, getFunc, type) {
                partsData.push(function (callback) {
                    var results = getFunc(type).slice(0, 20);

                    results.forEach(function(item) {
                        Log.info('addContinues', item);
                        item.params = {
                            createInstance: function(data) {
                                return Lampa.Maker.make('Card', data, function(module) {
                                    return module.only('Card', 'Callback');
                                });
                            },
                            emit: {
                                onlyEnter: function() {
                                    Lampa.Router.call('full', item);
                                },
                            }
                        };

                    });

                    callback({
                        source: 'tmdb',
                        results: results,
                        title: title,
                        nomore: true
                    });
                });
            }

            function makeRequest(category, title, callback) {
                var page = 1;
                var isContinues = category === 'continues' || category.indexOf('continues_') === 0;
                var token = '';
                if (Lampa.Storage.get('numparser_hide_watched') || isContinues) {
                    token = Lampa.Storage.get('numparser_api_key', '');
                }
                var url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');
                if (token) {
                    url += '&token=' + encodeURIComponent(token);
                    var profileId = getProfileId();
                    if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
                    var minProgress = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
                    url += '&min_progress=' + encodeURIComponent(minProgress);
                }

                self.get(url, params, function (json) {
                    var results = json.results || [];
                    var totalResults = json.total_results || 0;
                    var totalPages = json.total_pages || 1;

                    if (window.MyShows && window.MyShows.prepareProgressMarkers) {
                        var preparedData = window.MyShows.prepareProgressMarkers({results: results});
                        results = preparedData.results || preparedData.shows || results;
                    }

                    var result = {
                        url: category,
                        title: title,
                        page: page,
                        total_results: totalResults,
                        total_pages: totalPages,
                        more: totalPages > page,
                        results: results,
                        source: Lampa.Storage.get('numparser_source_name') || SOURCE_NAME,
                        _original_total_results: json.total_results || 0,
                        _original_total_pages: json.total_pages || 1,
                        _original_results: json.results || []
                    };

                    callback(result);
                }, function (error) {
                    callback({error: error});
                });
            }

            function loadPart(partLoaded, partEmpty) {
                Lampa.Api.partNext(partsData, 5, function (result) {
                    partLoaded(result);
                }, function (error) {
                    partEmpty(error);
                });
            }

            loadPart(onSuccess, onError);
            return loadPart;
        };
    }

    function Episode(data) {
        var self = this;
        var card = data.card || data;
        var episode = data.next_episode_to_air || data.episode || {};
        if (card.source === undefined) {
            card.source = SOURCE_NAME;
        }
        Lampa.Arrays.extend(card, {
            title: card.name,
            original_title: card.original_name,
            release_date: card.first_air_date
        });
        card.release_year = ((card.release_date || '0000') + '').slice(0, 4);

        function remove(elem) {
            if (elem) {
                elem.remove();
            }
        }

        self.build = function () {
            self.card = Lampa.Template.js('card_episode');
            if (!self.card) {
                Lampa.Noty.show('Error: card_episode template not found');
                return;
            }
            self.img_poster = self.card.querySelector('.card__img') || {};
            self.img_episode = self.card.querySelector('.full-episode__img img') || {};
            self.card.querySelector('.card__title').innerText = card.title || 'No title';
            self.card.querySelector('.full-episode__num').innerText = card.unwatched || '';
            if (episode && episode.air_date) {
                self.card.querySelector('.full-episode__name').innerText = 's' + (episode.season_number || '?') + 'e' + (episode.episode_number || '?') + '. ' + (episode.name || Lampa.Lang.translate('noname'));
                self.card.querySelector('.full-episode__date').innerText = episode.air_date ? Lampa.Utils.parseTime(episode.air_date).full : '----';
            }

            if (card.release_year === '0000') {
                remove(self.card.querySelector('.card__age'));
            } else {
                self.card.querySelector('.card__age').innerText = card.release_year;
            }

            self.card.addEventListener('visible', self.visible);
        };

        self.image = function () {
            self.img_poster.onload = function () { };
            self.img_poster.onerror = function () {
                self.img_poster.src = './img/img_broken.svg';
            };
            self.img_episode.onload = function () {
                self.card.querySelector('.full-episode__img').classList.add('full-episode__img--loaded');
            };
            self.img_episode.onerror = function () {
                self.img_episode.src = './img/img_broken.svg';
            };
        };

        self.visible = function () {
            if (card.poster_path) {
                self.img_poster.src = Lampa.Api.img(card.poster_path);
            } else if (card.profile_path) {
                self.img_poster.src = Lampa.Api.img(card.profile_path);
            } else if (card.poster) {
                self.img_poster.src = card.poster;
            } else if (card.img) {
                self.img_poster.src = card.img;
            } else {
                self.img_poster.src = './img/img_broken.svg';
            }
            if (card.still_path) {
                self.img_episode.src = Lampa.Api.img(episode.still_path, 'w300');
            } else if (card.backdrop_path) {
                self.img_episode.src = Lampa.Api.img(card.backdrop_path, 'w300');
            } else if (episode.img) {
                self.img_episode.src = episode.img;
            } else if (card.img) {
                self.img_episode.src = card.img;
            } else {
                self.img_episode.src = './img/img_broken.svg';
            }

            if (self.onVisible) {
                self.onVisible(self.card, card);
            }
        };

        self.create = function () {
            self.build();
            self.card.addEventListener('hover:focus', function () {
                if (self.onFocus) {
                    self.onFocus(self.card, card);
                }
            });
            self.card.addEventListener('hover:hover', function () {
                if (self.onHover) {
                    self.onHover(self.card, card);
                }
            });
            self.card.addEventListener('hover:enter', function () {
                if (self.onEnter) {
                    self.onEnter(self.card, card);
                }
            });
            self.image();
        };

        self.destroy = function () {
            self.img_poster.onerror = function () { };
            self.img_poster.onload = function () { };
            self.img_episode.onerror = function () { };
            self.img_episode.onload = function () { };
            self.img_poster.src = '';
            self.img_episode.src = '';
            remove(self.card);
            self.card = null;
            self.img_poster = null;
            self.img_episode = null;
        };

        self.render = function (js) {
            return js ? self.card : $(self.card);
        };
    }

    // === Поддержка профилей ===
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

    function getProfileName() {

        var npName = Lampa.Storage.get('np_profile_name', '');
        if (npName) return String(npName);

        try {
            if (Lampa.Account.Permit.account && Lampa.Account.Permit.account.profile && Lampa.Account.Permit.account.profile.name) {
                return String(Lampa.Account.Permit.account.profile.name);
            }
        } catch (e) {}

        return '';
    }

    function getProfileSetting(key, defaultValue) {
        return Lampa.Storage.get(getProfileKey(key), defaultValue);
    }

    var _syncApplying = false;

    function setProfileSetting(key, value) {
        Lampa.Storage.set(getProfileKey(key), value);
        if (!_syncApplying && window.__NMSync) window.__NMSync.patch('np', getProfileKey(key), value);
    }

    // Базовый ключ из профильного: 'numparser_hide_watched_profile_abc' → 'numparser_hide_watched'
    function _baseKey(profileKey) {
        var idx = profileKey.lastIndexOf('_profile_');
        return idx >= 0 ? profileKey.slice(0, idx) : profileKey;
    }

    // Применить настройку пришедшую с сервера (без обратной отправки)
    function _applyNpSetting(profileKey, value) {
        _syncApplying = true;
        // Всегда обновляем профильный ключ в хранилище
        Lampa.Storage.set(profileKey, value);
        // Базовый ключ обновляем только если этот профиль сейчас активен
        var base = _baseKey(profileKey);
        if (getProfileKey(base) === profileKey) {
            Lampa.Storage.set(base, value);
        }
        _syncApplying = false;
    }

    function hasProfileSetting(key) {
        var profileKey = getProfileKey(key);
        return window.localStorage.getItem(profileKey) !== null;
    }

    // Загружаем профильные настройки
    function loadNumparserProfileSettings() {
        if (!hasProfileSetting('numparser_hide_watched')) {
            setProfileSetting('numparser_hide_watched', "true");
        }
        if (!hasProfileSetting('numparser_min_progress')) {
            setProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
        }
        if (!hasProfileSetting('numparser_source_name')) {
            setProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME);
        }
        if (!hasProfileSetting('numparser_menu_sort')) {
            setProfileSetting('numparser_menu_sort', []);
        }
        if (!hasProfileSetting('numparser_menu_hide')) {
            setProfileSetting('numparser_menu_hide', []);
        }
        if (!hasProfileSetting('numparser_quality_mode')) {
            setProfileSetting('numparser_quality_mode', 'simple');
        }

        // Восстанавливаем значения в Lampa.Storage, чтобы UI знал актуальные данные
        Lampa.Storage.set('numparser_hide_watched', getProfileSetting('numparser_hide_watched', "true"), "true");
        Lampa.Storage.set('numparser_min_progress', getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS), "true");
        Lampa.Storage.set('numparser_source_name', getProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME), "true");
        Lampa.Storage.set('numparser_menu_sort', getProfileSetting('numparser_menu_sort', []));
        Lampa.Storage.set('numparser_menu_hide', getProfileSetting('numparser_menu_hide', []));
        Lampa.Storage.set('numparser_quality_mode', getProfileSetting('numparser_quality_mode', 'simple'));
    }

    function openNumparserMenuEditor() {
        var allCategories = getAllCategories();
        var savedOrder = getProfileSetting('numparser_menu_sort');

        // Если настройка ещё не создана — инициализируем её
        if (!Array.isArray(savedOrder) || savedOrder.length === 0) {
            savedOrder = allCategories.map(c => c.key);
            setProfileSetting('numparser_menu_sort', savedOrder);
        }

        var savedHide = getProfileSetting('numparser_menu_hide', []);

        var ordered = [];

        // Восстанавливаем порядок из savedOrder
        for (var i = 0; i < savedOrder.length; i++) {
            var key = savedOrder[i];
            var cat = null;
            for (var j = 0; j < allCategories.length; j++) {
                if (allCategories[j].key === key) {
                    cat = allCategories[j];
                    break;
                }
            }
            if (cat) ordered.push(cat);
        }

        // Добавляем новые категории
        for (var j = 0; j < allCategories.length; j++) {
            var cat = allCategories[j];
            var exists = false;
            for (var i = 0; i < ordered.length; i++) {
                if (ordered[i].key === cat.key) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                ordered.push(cat);
        }
        }

        // Создаём DOM

        // CSS для фокуса на кнопках управления (однократно)
        if (!document.getElementById('np-ctrl-style')) {
            $('<style id="np-ctrl-style">').text(
                '.menu-edit-list__ctrl{justify-content:center;opacity:.7;transition:opacity .15s;}' +
                '.menu-edit-list__ctrl.focus{opacity:1;background:rgba(255,255,255,.12);border-radius:.3em;}'
            ).appendTo('head');
        }

        // Скролл к элементу по центру — Lampa двигает scroll__body через CSS transform
        function scrollItemCenter(el) {
            var body = el.parentNode;
            while (body && (body.className || '').indexOf('scroll__body') < 0) {
                body = body.parentNode;
            }
            if (!body) { return; }
            var content = body.parentNode;
            var viewH = content.clientHeight;
            var bodyH = body.offsetHeight;
            var elR = el.getBoundingClientRect();
            var bodyR = body.getBoundingClientRect();
            var elOffset = elR.top - bodyR.top;
            var elH = elR.bottom - elR.top;
            var targetY = -elOffset + (viewH - elH) / 2;
            if (targetY > 0) targetY = 0;
            // Отступ 50px снизу: последний элемент не прячется за край контейнера
            if (targetY < viewH - 50 - bodyH) targetY = viewH - 50 - bodyH;
            body.style.transform = 'translateY(' + targetY + 'px)';
        }

        var list = $('<div class="menu-edit-list"></div>');

        // Кнопки "Включить все / Отключить все" — внутри list чтобы не ломать навигацию Lampa
        var btnEnableAll = $('<div class="menu-edit-list__item menu-edit-list__ctrl selector">Включить все</div>');
        var btnDisableAll = $('<div class="menu-edit-list__item menu-edit-list__ctrl selector">Отключить все</div>');
        btnEnableAll.on('hover:enter', function () { list.find('.dot').attr('opacity', '1'); });
        btnDisableAll.on('hover:enter', function () { list.find('.dot').attr('opacity', '0'); });
        list.append(btnEnableAll).append(btnDisableAll);

        // Единый таймер дебаунса для всех строк списка
        var npScrollTimer;

        ordered.forEach(function (cat) {
            var isVisible = savedHide.indexOf(cat.key) === -1;
            var item = $(`
                <div class="menu-edit-list__item">
                    <div class="menu-edit-list__icon">${ICON}</div>
                    <div class="menu-edit-list__title">${cat.title}</div>
                    <div class="menu-edit-list__move move-up selector">
                        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 12L11 3L20 12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="menu-edit-list__move move-down selector">
                        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 2L11 11L20 2" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="menu-edit-list__toggle toggle selector">
                        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1.89111" y="1.78369" width="21.793" height="21.793" rx="3.5" stroke="currentColor" stroke-width="3"/>
                            <path d="M7.44873 12.9658L10.8179 16.3349L18.1269 9.02588" stroke="currentColor" stroke-width="3" class="dot" opacity="${isVisible ? 1 : 0}" stroke-linecap="round"/>
                        </svg>
                    </div>
                </div>
            `).data('key', cat.key);

            // При навигации: clearTimeout отменяет предыдущий если пришёл новый hover:focus,
            // setTimeout(0) запускается до следующего кадра — Lampa и мы рисуемся за один рендер
            item.find('.selector').on('hover:focus', function () {
                clearTimeout(npScrollTimer);
                npScrollTimer = setTimeout(function () { scrollItemCenter(item[0]); }, 0);
            });

            item.find('.move-up').on('hover:enter', function () {
                var prev = item.prev(':not(.menu-edit-list__ctrl)');
                if (prev.length) {
                    item.insertBefore(prev);
                    Lampa.Controller.toggle('modal');
                    scrollItemCenter(item[0]); // синхронно — выигрываем у Lampa
                };
            });

            item.find('.move-down').on('hover:enter', function () {
                var next = item.next(':not(.menu-edit-list__ctrl)');
                if (next.length) {
                    item.insertAfter(next);
                    Lampa.Controller.toggle('modal');
                    scrollItemCenter(item[0]); // синхронно — выигрываем у Lampa
                };
            });

            item.find('.toggle').on('hover:enter', function () {
                var dot = item.find('.dot');
                var wasVisible = dot.attr('opacity') === '1';
                dot.attr('opacity', wasVisible ? '0' : '1');
            });

            list.append(item);
        });

        Lampa.Modal.open({
            title: 'Порядок категорий',
            html: list,
            size: 'small',
                        onBack: function () {
                var newOrder = [];
                var newHide = [];

                list.find('.menu-edit-list__item').each(function () {
                    var key = $(this).data('key');
                    if (!key) return; // кнопки "Включить все / Отключить все" не имеют key
                    var isVisible = $(this).find('.dot').attr('opacity') === '1';
                    newOrder.push(key);
                    if (!isVisible) newHide.push(key);
                });

                setProfileSetting('numparser_menu_sort', newOrder);
                setProfileSetting('numparser_menu_hide', newHide);
                Lampa.Modal.close();
                    Lampa.Controller.toggle('settings_component');
                }
            });
        }

    function initSettings() {

        try {
            if (Lampa.SettingsApi.removeComponent) {
                Lampa.SettingsApi.removeComponent('numparser_settings');
            }
        } catch (e) {}

        Lampa.SettingsApi.addComponent({
            component: 'numparser_settings',
            name: SOURCE_NAME,
            icon: ICON
        });

        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_edit_menu_order',
                type: 'button',
                title: 'Изменить порядок категорий'
            },
            field: {
                name: 'Порядок категорий',
                description: 'Перетаскивайте категории, чтобы изменить их порядок и видимость'
            },
            onChange: function () {
                openNumparserMenuEditor();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_hide_watched',
                type: 'trigger',
                default: getProfileSetting('numparser_hide_watched', "true"),
            },
            field: {
                name: 'Скрыть просмотренные',
                description: 'Скрывать просмотренные фильмы и сериалы'
            },

            onChange: function (value) {
                setProfileSetting('numparser_hide_watched', value === true || value === "true");

                var active = Lampa.Activity.active();
                if (active && active.activity_line && active.activity_line.listener && typeof active.activity_line.listener.send === 'function') {
                    active.activity_line.listener.send({
                        type: 'append',
                        data: active.activity_line.card_data,
                        line: active.activity_line
                    });
                } else {
                    location.reload();
                }
            }
        });

        if (NUMPARSER_HIDE_WATCHED) {

            // Добавляем настройку прогресса
            Lampa.SettingsApi.addParam({
                component: 'numparser_settings',
                param: {
                    name: 'numparser_min_progress',
                    type: 'select',
                    values: {
                        '50': '50%',
                        '55': '55%',
                        '60': '60%',
                        '65': '65%',
                        '70': '70%',
                        '75': '75%',
                        '80': '80%',
                        '85': '85%',
                        '90': '90%',
                        '95': '95%',
                        '100': '100%'
                    },
                    default: getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS).toString(),
                },
                field: {
                    name: 'Порог просмотра',
                    description: 'Минимальный процент просмотра для скрытия контента'
                },
                onChange: function (value) {
                    newProgress = parseInt(value);
                    setProfileSetting('numparser_min_progress', newProgress);
                    MIN_PROGRESS = newProgress;
                }
            });

            // Токен устройства (ввод вручную)
            Lampa.SettingsApi.addParam({
                component: 'numparser_settings',
                param: {
                    name: 'numparser_api_key',
                    type: 'input',
                    placeholder: 'Вставьте токен',
                    values: '',
                    default: Lampa.Storage.get('numparser_api_key', ''),
                },
                field: {
                    name: 'Токен устройства',
                    description: 'Токен для идентификации устройства. Получите на сайте или привяжите кнопкой ниже.'
                },
                onChange: function (value) {
                    Lampa.Storage.set('numparser_api_key', value);
                }
            });

            // Привязка через код (без ручного ввода токена)
            Lampa.SettingsApi.addParam({
                component: 'numparser_settings',
                param: {
                    name: 'numparser_activate_device',
                    type: 'button',
                    title: 'Привязать устройство'
                },
                field: {
                    name: 'Привязать устройство',
                    description: 'Показать код для ввода на сайте — без ручного набора токена'
                },
                onChange: function () {
                    startDeviceActivation();
                }
            });
        }

        // Настройка для изменения названия источника
        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_source_name',
                type: 'input',
                placeholder: 'Введите название',
                values: '',
                default: getProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME),
            },
            field: {
                name: 'Название источника',
                description: 'Изменение названия источника в меню'
            },
            onChange: function (value) {
                newName = value;
                setProfileSetting('numparser_source_name', value);
                $('.num_text').text(value);
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_quality_mode',
                type: 'select',
                values: {
                    'full': 'Полное (WEBDL 1080p, BDRip и т.д.)',
                    'simple': 'Упрощённое (SD, 720p, 1080p, 4K)'
                },
                default: getProfileSetting('numparser_quality_mode', 'simple')
            },
            field: {
                name: 'Формат качества',
                description: 'Как отображать качество видео'
            },
            onChange: function (value) {
                setProfileSetting('numparser_quality_mode', value);
            }
        });
    }

    function getQuality(qualityStr) {
        if (!qualityStr || typeof qualityStr !== 'string') {
            return qualityStr;
        }

        // Приводим к нижнему регистру для надёжности
        var q = qualityStr.toLowerCase();

        if (q.indexOf('2160p') !== -1 || q.indexOf('4k') !== -1) {
            return '4K';
        } else if (q.indexOf('1080p') !== -1) {
            return '1080p';
        } else if (q.indexOf('720p') !== -1) {
            return '720p';
        } else if (q === 'sd' || q.indexOf('sd') !== -1) {
            return 'SD';
        }

        return qualityStr;
    }

    // ── Device Activation Flow ──────────────────────────────────────────────────

    function startDeviceActivation() {
        var overlay = null;
        var pollTimer = null;

        function removeOverlay() {
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            if (overlay)   { overlay.remove(); overlay = null; }
        }

        function setStatus(text, color) {
            if (overlay) overlay.find('.num-act-status').css('color', color || '').text(text);
        }

        function showOverlay(code, expiresIn) {
            var remaining = expiresIn;

            overlay = $([
                '<div class="num-act-overlay">',
                  '<div class="num-act-box">',
                    '<div class="num-act-title">Привязка устройства</div>',
                    '<div class="num-act-url">' + BASE_URL + '</div>',
                    '<div class="num-act-hint">Мои устройства → Привязать устройство</div>',
                    '<div class="num-act-hint">Введите этот код:</div>',
                    '<div class="num-act-code">' + code.replace(/(.{3})(.{3})/, '$1 $2') + '</div>',
                    '<div class="num-act-timer">Действует ' + remaining + ' сек.</div>',
                    '<div class="num-act-status">Ожидаю привязки…</div>',
                    '<div class="num-act-close">Нажмите Назад для отмены</div>',
                  '</div>',
                '</div>'
            ].join('')).appendTo('body');

            // Обратный отсчёт
            var countdown = setInterval(function () {
                remaining--;
                if (!overlay) { clearInterval(countdown); return; }
                overlay.find('.num-act-timer').text('Действует ' + remaining + ' сек.');
                if (remaining <= 0) {
                    clearInterval(countdown);
                    setStatus('Код истёк. Закройте и попробуйте снова.', '#f87171');
                    removeOverlay();
                }
            }, 1000);

            // Закрытие по клику на фон или кнопке Back
            overlay.on('click', function (e) {
                if ($(e.target).hasClass('num-act-overlay')) removeOverlay();
            });

            // Перехватываем Back (keydown Escape / Lampa back)
            function onBack() {
                removeOverlay();
                Lampa.Controller.toggle('settings_component');
            }
            Lampa.Controller.add('num_act', { back: onBack, toggle: function () {} });
            Lampa.Controller.toggle('num_act');
        }

        function startPolling(code, interval) {
            pollTimer = setInterval(function () {
                fetch(BASE_URL + '/device/status?code=' + encodeURIComponent(code))
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.linked && data.token) {
                            Lampa.Storage.set('numparser_api_key', data.token);
                            setStatus('Устройство привязано!', '#4ade80');
                            Lampa.Noty.show('NUMParser: устройство привязано');
                            setTimeout(function () {
                                removeOverlay();
                                Lampa.Settings.update();

                                setTimeout(function () {
                                    location.reload();
                                }, 1000);
                            }, 2000);
                        }
                    })
                    .catch(function () { /* сеть временно недоступна — продолжаем */ });
            }, interval * 1000);
        }

        // Запрос кода у сервера
        fetch(BASE_URL + '/device/code', { method: 'POST' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                showOverlay(data.code, data.expires_in);
                startPolling(data.code, data.poll_interval || 3);
            })
            .catch(function () {
                Lampa.Noty.show('NUMParser: не удалось получить код активации');
            });
    }

    // CSS для оверлея активации (инжектируем один раз)
    (function injectActivationStyles() {
        if (document.getElementById('num-act-styles')) return;
        var s = document.createElement('style');
        s.id = 'num-act-styles';
        s.textContent = [
            '.num-act-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);z-index:9999;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center}',
            '.num-act-box{background:#1e1e2e;border-radius:1.8rem;padding:4rem 6rem;text-align:center;max-width:900px;width:85%;border:2px solid #ffffff15}',
            '.num-act-title{font-size:2.4rem;font-weight:700;margin-bottom:1.8rem}',
            '.num-act-url{color:#60a5fa;font-size:1.5rem;font-weight:600;margin-bottom:1.2rem;word-break:break-all}',
            '.num-act-hint{color:#aaa;font-size:1.3rem;margin-bottom:.6rem}',
            '.num-act-code{font-size:5rem;font-weight:800;letter-spacing:1rem;color:#4ade80;font-family:monospace;border:3px solid #4ade80;border-radius:1rem;padding:.8rem 2.5rem;display:inline-block;margin:1.5rem 0}',
            '.num-act-timer{color:#888;font-size:1.1rem;margin-bottom:1rem}',
            '.num-act-status{font-size:1.3rem;min-height:2rem}',
            '.num-act-close{color:#555;font-size:1rem;margin-top:1.8rem}',
        ].join('');
        document.head.appendChild(s);
    })();

    // ── End Device Activation Flow ──────────────────────────────────────────────

    var _timecodeInterceptorActive = false;
    var _lastSentTimecodes = {};  // { "cardId::hash": { percent, sentAt } }
    var SYNC_THROTTLE_MS = 15000; // не чаще раза в 15 сек на одну (card+hash) пару

    function getCurrentCard() {
        var card = (Lampa.Activity && Lampa.Activity.active && Lampa.Activity.active() && (
            Lampa.Activity.active().card_data ||
            Lampa.Activity.active().card ||
            Lampa.Activity.active().movie
        )) || null;

        if (card) {
            card.isMovie = isMovieContent(card);
        }
        Log.info('Current card', card);
        return card;
    }

    function isMovieContent(card) {
        // Проверяем наличие явных признаков фильма
        if (card && (
            (card.number_of_seasons === undefined || card.number_of_seasons === null) &&
            (card.media_type === 'movie') ||
            (Lampa.Activity.active() && Lampa.Activity.active().method === 'movie')
        )) {
            return true;
        }

        // Проверяем наличие явных признаков сериала
        if (card && (
            (card.number_of_seasons > 0) ||
            (card.media_type === 'tv') ||
            (Lampa.Activity.active() && Lampa.Activity.active().method === 'tv') ||
            (card.name !== undefined)
        )) {
            return false;
        }

        // Дополнительные проверки
        return Boolean(!card.original_name && (card.original_title || card.title));
    }

    function setupTimecodeSync() {
        if (_timecodeInterceptorActive) return;
        _timecodeInterceptorActive = true;

        function tryAttach() {
            if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) {
                Lampa.Timeline.listener.follow('update', onTimelineUpdate);
                Log.info('Timecode sync: Timeline attached');
            } else {
                setTimeout(tryAttach, 1000);
            }
        }
        tryAttach();
    }

    function onTimelineUpdate(data) {
        if (!data || !data.data || !data.data.hash || !data.data.road) return;

        var token = Lampa.Storage.get('numparser_api_key', '');
        if (!token) {
            Log.info('Timecode sync: skip — no token');
            return;
        }

        var card = getCurrentCard();
        if (!card || !card.id) {
            Log.info('Timecode sync: skip — no card');
            return;
        }

        var hash    = String(data.data.hash);
        var road    = data.data.road;
        var percent = Math.round(road.percent  || 0);
        var time    = Math.round(road.time     || 0);
        var duration = Math.round(road.duration || 0);

        var mt     = card.media_type || (card.isMovie ? 'movie' : 'tv');
        var cardId = String(card.id) + '_' + mt;
        var key    = cardId + '::' + hash;
        var now    = Date.now();
        var last   = _lastSentTimecodes[key];

        // Пропускаем если процент не изменился или не прошло время дросселя
        if (last && (now - last.sentAt < SYNC_THROTTLE_MS) && last.percent === percent) return;

        _lastSentTimecodes[key] = { percent: percent, sentAt: now };

        Log.info('Timecode sync: sending', cardId, hash, percent + '%');

        var timecodeUrl = BASE_URL + '/timecode?token=' + encodeURIComponent(token);
        var profileId = getProfileId();
        var profileName = getProfileName();
        if (profileId) timecodeUrl += '&profile_id=' + encodeURIComponent(profileId);
        if (profileName) {timecodeUrl += '&profile_name=' + encodeURIComponent(profileName);}

        fetch(timecodeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                card_id: cardId,
                item: hash,
                data: JSON.stringify({ time: time, duration: duration, percent: percent })
            })
        }).then(function() {
            Log.info('Timecode saved:', cardId, hash, percent + '%');
        }).catch(function(err) {
            Log.error('Timecode save error:', err);
        });
    }

    function startPlugin() {

        if (window.numparser_plugin) return;
        window.numparser_plugin = true;

        var originalCategoryFull = Lampa.Component.get('category_full');
        if (originalCategoryFull) {
            Lampa.Component.add('category_full', function(object) {
                var comp = originalCategoryFull(object);
                var originalBuild = comp.build;

                comp.build = function(data) {
                    // Если результатов нет, но есть еще страницы - пробуем загрузить следующую
                    if (!data.results.length && object.source === SOURCE_NAME && data.total_pages > 1) {
                        object.page = 2;
                        Lampa.Api.list(object, this.build.bind(this), this.empty.bind(this));
                        return;
                    }

                    originalBuild.call(this, data);
                };

                return comp;
            });
        }

        var numparserApi = new NumparserApiService();
        Lampa.Api.sources.numparser = numparserApi;
        Object.defineProperty(Lampa.Api.sources, SOURCE_NAME, {
            get: function () {
                return numparserApi;
            }
        });

        newName = Lampa.Storage.get('numparser_settings', SOURCE_NAME);
        if (Lampa.Storage.field('start_page') === SOURCE_NAME) {
            window.start_deep_link = {
                component: 'category',
                page: 1,
                url: '',
                source: SOURCE_NAME,
                title: SOURCE_NAME
            };
        }

        var values = Lampa.Params.values.start_page;
        values[SOURCE_NAME] = SOURCE_NAME;

        var menuItem = $('<li data-action="numparser" class="menu__item selector"><div class="menu__ico">' + ICON + '</div><div class="menu__text num_text">' + SOURCE_NAME + '</div></li>');
        $('.menu .menu__list').eq(0).append(menuItem);

        menuItem.on('hover:enter', function () {
            Lampa.Activity.push({
                title: SOURCE_NAME,
                component: 'category',
                source: SOURCE_NAME,
                page: 1
            });
        });

        // === Общая функция обновления настроек при смене профиля ===
        function refreshProfileSettings() {
            loadNumparserProfileSettings();

            // Если панель настроек открыта — обновим значения в UI
            setTimeout(function() {
                var settingsPanel = document.querySelector('[data-component="numparser_settings"]');
                if (!settingsPanel) return;

                var hideWatched = settingsPanel.querySelector('select[data-name="numparser_hide_watched"]');
                if (hideWatched) hideWatched.value = getProfileSetting('numparser_hide_watched', "true");

                var minProgress = settingsPanel.querySelector('select[data-name="numparser_min_progress"]');
                if (minProgress) minProgress.value = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS).toString();

                var sourceName = settingsPanel.querySelector('input[data-name="numparser_source_name"]');
                if (sourceName) sourceName.value = getProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME);

                var qualityMode = settingsPanel.querySelector('select[data-name="numparser_quality_mode"]');
                if (qualityMode) qualityMode.value = getProfileSetting('numparser_quality_mode', 'simple');
            }, 100);
        }


        // === Обновляем настройки при смене профиля ===
        Lampa.Listener.follow('profile', function(e) {
            if (e.type === 'changed') {
                refreshProfileSettings();
            }
        });

        // Слушаем изменения профиля для обновления меню Lampa
        Lampa.Listener.follow('state:changed', function(e) {
            if (e.target === 'favorite' && e.reason === 'profile') {
                refreshProfileSettings();
            }
        });

        setupTimecodeSync();
    }

    function initNUMPlugin() {
        startPlugin();

        NUMPARSER_HIDE_WATCHED = Lampa.Storage.get('numparser_hide_watched');

        setTimeout(function() {
            initSettings();
            loadNumparserProfileSettings();
            if (window.__NMSync) {
                window.__NMSync.register('np', [], _applyNpSetting);
            }
        }, 50);
    }

    if (window.appready) {
        initNUMPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                initNUMPlugin();
            }
        });
    }
})();