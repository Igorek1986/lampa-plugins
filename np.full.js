 (function () {
    'use strict';

    var VERSION = '1.0.0';

    var DEFAULT_SOURCE_NAME = 'NUMParser';
    var SOURCE_NAME = Lampa.Storage.get('numparser_source_name', DEFAULT_SOURCE_NAME);
    var newName = SOURCE_NAME;
    var BASE_URL = (function() {
    var scriptUrl = (document.currentScript && document.currentScript.src) || '';
    var params = new URLSearchParams(scriptUrl.split('?')[1]);
    return params.get('base_url') || 'https://numparser.igorek1986.ru';
    })();
    var ICON = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"><g><g><path fill="currentColor" d="M482.909,67.2H29.091C13.05,67.2,0,80.25,0,96.291v319.418C0,431.75,13.05,444.8,29.091,444.8h453.818c16.041,0,29.091-13.05,29.091-29.091V96.291C512,80.25,498.95,67.2,482.909,67.2z M477.091,409.891H34.909V102.109h442.182V409.891z"/></g></g><g><g><rect fill="currentColor" x="126.836" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="350.255" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="367.709" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="367.709" y="292.364" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="292.364" width="126.836" height="34.909"/></g></g></svg>';
    // Actor pool — loaded once at startup, used in collections_block shuffle
    var actorPool = [];
    (function() {
        var req = new Lampa.Reguest();
        req.silent(BASE_URL + '/api/categories', function(cats) {
            actorPool = (cats || []).filter(function(c) {
                return c.id && (c.id.indexOf('actor_') === 0 || c.id.indexOf('director_') === 0);
            }).map(function(c) { return { key: c.id, title: c.name }; });
        }, function() {});
    })();

    var GENRE_POOL = [
        { key: 'genre_comedy',      title: 'Комедии' },
        { key: 'genre_action',      title: 'Боевики' },
        { key: 'genre_thriller',    title: 'Триллеры' },
        { key: 'genre_crime',       title: 'Криминал' },
        { key: 'genre_horror',      title: 'Ужасы' },
        { key: 'genre_romance',     title: 'Мелодрамы' },
        { key: 'genre_adventure',   title: 'Приключения' },
        { key: 'genre_scifi',       title: 'Фантастика' },
        { key: 'genre_fantasy',     title: 'Фэнтези' },
        { key: 'genre_detective',   title: 'Детективы' },
        { key: 'genre_history',     title: 'Историческое' },
        { key: 'genre_war',         title: 'Военное' },
        { key: 'genre_documentary', title: 'Документальные' },
        { key: 'genre_western',     title: 'Вестерны' },
        { key: 'genre_random',      title: 'Случайное' },
        { key: 'tracker_new',       title: 'Последние поступления' }
    ];

    function shuffleArray(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

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
            // ── Фиксированные строки ───────────────────────────────────────────
            { key: 'myshows_unwatched',      title: 'Непросмотренные (MyShows)' },
            { key: 'np_popular',             title: 'Популярно в NP' },
            { key: 'movies_ru_new',          title: 'Новые русские фильмы' },
            { key: 'movies_new',             title: 'Новые фильмы' },
            { key: 'tv_shows_ru',            title: 'Русские сериалы' },
            { key: 'tv_shows',               title: 'Сериалы' },
            // ── Подборки (жанровый блок, рандомно перемешивается) ──────────────
            { key: 'collections_block',      title: 'Подборки' },
            // ── Продолжить просмотр ────────────────────────────────────────────
            { key: 'continues',              title: 'Продолжить просмотр NUMParser' },
            { key: 'continues_movie',        title: 'Продолжить просмотр (Фильмы)' },
            { key: 'continues_tv',           title: 'Продолжить просмотр (Сериалы)' },
            { key: 'continues_anime',        title: 'Продолжить просмотр (Аниме)' },
            { key: 'episodes',               title: 'Ближайшие выходы эпизодов' },
            { key: 'recent',                 title: 'Недавние выходы эпизодов' },
            // ── Качество / Легенды ─────────────────────────────────────────────
            { key: 'movies_4k_new',          title: 'В высоком качестве (новые)' },
            { key: 'legends_id',             title: 'Топ фильмы' },
            { key: 'movies_4k',              title: 'В высоком качестве' },
            { key: 'movies',                 title: 'Фильмы' },
            { key: 'movies_ru',              title: 'Русские фильмы' },
            // ── После подборок ─────────────────────────────────────────────────
            { key: 'cartoon_movies',         title: 'Мультфильмы' },
            { key: 'cartoon_series',         title: 'Мультсериалы' },
            { key: 'anime',                  title: 'Аниме' }
        ];

        // Годы в обратном порядке от нового к старому
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
                    if (item.certification_ru) dataItem.certification_ru = item.certification_ru;
                    if (item.certification_us) dataItem.certification_us = item.certification_us;
                    if (item.progress_marker) dataItem.progress_marker = item.progress_marker;
                    if (item.watched_count !== undefined) dataItem.watched_count = item.watched_count;
                    if (item.total_count !== undefined) dataItem.total_count = item.total_count;
                    if (item.released_count !== undefined) dataItem.released_count = item.released_count;
                    if (item.remaining !== undefined) dataItem.remaining = item.remaining;
                    if (item.next_episode) dataItem.next_episode = item.next_episode;
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

            // category может уже содержать '?seed=...' (раскладка genre_*, зафиксированная
            // на первой странице) — тогда параметры добавляем через '&', а не '?'.
            var sep = category.indexOf('?') >= 0 ? '&' : '?';
            var url = BASE_URL + '/' + category + sep + 'page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');
            if (Lampa.Storage.get('numparser_hide_unrated')) {
                url += '&hide_unrated=1';
            }
            var childAge = getChildAge();
            if (childAge > 0) url += '&child_age=' + childAge;
            if (token) {
                url += '&token=' + encodeURIComponent(token);
                var profileId = getProfileId();
                if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
                var minProgress = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
                if (Lampa.Storage.get('numparser_hide_watched')) {
                    url += '&hide_watched=1&percent=' + encodeURIComponent(minProgress);
                }
            }

            self.get(url, params, function (json) {
                var results = json.results || [];
                onComplete({
                    results: results,
                    page: json.page || page,
                    total_pages: json.total_pages || 1,
                    total_results: json.total_results || 0
                });
            }, onError);
        };

        self.full = function (params, onSuccess, onError) {
            var card = params.card;
            var certRu = card && card.certification_ru;
            params.method = !!(card.number_of_seasons || card.seasons || card.last_episode_to_air || card.first_air_date) ? 'tv' : 'movie';
            Lampa.Api.sources.tmdb.full(params, function (data) {
                if (data && data.movie && certRu && !data.movie.restrict) {
                    var match = certRu.match(/^(\d+)/);
                    if (match) data.movie.restrict = match[1];
                }
                onSuccess(data);
            }, onError);
        }

        var KEY_RENAMES = {
            'lampac_movies': 'movies', 'lampac_movies_new': 'movies_new',
            'lampac_movies_ru': 'movies_ru', 'lampac_movies_ru_new': 'movies_ru_new',
            'lampac_movies_4k': 'movies_4k', 'lampac_movies_4k_new': 'movies_4k_new',
            'lampac_legends_id': 'legends_id', 'lampac_np_popular': 'np_popular',
            'lampac_continues': 'continues', 'lampac_continues_movie': 'continues_movie',
            'lampac_continues_tv': 'continues_tv', 'lampac_continues_anime': 'continues_anime',
            'all_tv_shows': 'tv_shows', 'all_tv_shows_ru': 'tv_shows_ru',
            'all_cartoon_movies': 'cartoon_movies', 'all_cartoon_series': 'cartoon_series',
            'all_anime': 'anime', 'anime_id': 'anime'
        };

        function migrateLampacPrefix(settingKey) {
            var arr = getProfileSetting(settingKey, []);
            var changed = false;
            var seen = {};
            var result = [];
            for (var i = 0; i < arr.length; i++) {
                var key = arr[i];
                if (KEY_RENAMES[key]) { key = KEY_RENAMES[key]; changed = true; }
                else if (key.indexOf('lampac_') === 0) { key = key.slice(7); changed = true; }
                if (!seen[key]) { seen[key] = true; result.push(key); }
                else { changed = true; } // дубликат после переименования — отбрасываем
            }
            if (changed) setProfileSetting(settingKey, result);
            return result;
        }

        self.category = function (params, onSuccess, onError) {
            params = params || {};
            var partsData = [];

            var allCategories = getAllCategories();
            var menuOrder = migrateLampacPrefix('numparser_menu_sort');
            var menuHide = migrateLampacPrefix('numparser_menu_hide');

            // Инициализация при первом запуске
            if (!Array.isArray(menuOrder) || menuOrder.length === 0) {
                menuOrder = [];
                for (var i = 0; i < allCategories.length; i++) {
                    menuOrder.push(allCategories[i].key);
                }
                setProfileSetting('numparser_menu_sort', menuOrder);
            }

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

            // Шаг 2: добавляем новые категории в их правильную позицию
            // (вставляем сразу после ближайшего предшественника из allCategories)
            for (var j = 0; j < allCategories.length; j++) {
                var cat = allCategories[j];
                var exists = false;
                for (var i = 0; i < actualOrder.length; i++) {
                    if (actualOrder[i] === cat.key) { exists = true; break; }
                }
                if (exists) continue;

                // Ищем ближайший предшествующий ключ из allCategories, который уже есть в actualOrder
                var insertAfter = -1;
                for (var k = j - 1; k >= 0; k--) {
                    for (var m = 0; m < actualOrder.length; m++) {
                        if (actualOrder[m] === allCategories[k].key) {
                            insertAfter = m;
                            break;
                        }
                    }
                    if (insertAfter >= 0) break;
                }

                if (insertAfter >= 0) {
                    actualOrder.splice(insertAfter + 1, 0, cat.key);
                } else {
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

                // collections_block — жанровые подборки + актёры, всё перемешано
                if (key === 'collections_block') {
                    var combined = shuffleArray(GENRE_POOL.concat(actorPool));
                    for (var gi = 0; gi < combined.length; gi++) {
                        (function(g) {
                            partsData.push(function(callback) {
                                makeRequest(g.key, g.title, callback);
                            });
                        })(combined[gi]);
                    }
                    continue;
                }

                // MyShows — особый случай
                if (key === 'myshows_unwatched') {
                    if (!window.MyShows || !window.MyShows.getUnwatchedShowsWithDetails) continue;

                    // 🔥 Захватываем title СЕЙЧАС
                    var currentTitle = cat.title;

                    partsData.push(function (callback) {
                        window.MyShows.getUnwatchedShowsWithDetails(function(response) {
                            if (response.error || !response.shows || response.shows.length === 0) {
                                callback({skip: true});
                                return;
                            }
                            var PAGE_SIZE = 20;
                            var total_pages = Math.ceil(response.shows.length / PAGE_SIZE) || 1;
                            callback({
                                title: currentTitle,
                                results: response.shows.slice(0, PAGE_SIZE),
                                url: 'myshows://unwatched',
                                total_pages: total_pages
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
                    var results = (type !== undefined ? getFunc(type) : getFunc()).slice(0, 20);
                    results.forEach(function (item) {
                        if (item.first_air_date && !item.release_date) {
                            item.release_date = item.first_air_date;
                        }
                        item.params = {
                            createInstance: function (data) {
                                return Lampa.Maker.make('Card', data, function (m) { return m.only('Card', 'Release', 'Callback'); });
                            },
                            emit: { onlyEnter: function () { Lampa.Router.call('full', item); } }
                        };
                    });
                    callback({ source: 'tmdb', results: results, title: title, nomore: true });
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
                // genre_* — случайная раскладка по индексу: генерим seed на каждый
                // запрос (рандом при каждом заходе) и пробрасываем его в url линии,
                // чтобы доскролл/«на весь экран» использовали ту же раскладку без повторов.
                var seed = '';
                if (category.indexOf('genre_') === 0) {
                    seed = Math.random().toFixed(6);
                    url += '&seed=' + seed;
                }
                if (Lampa.Storage.get('numparser_hide_unrated')) {
                    url += '&hide_unrated=1';
                }
                var childAge = getChildAge();
                if (childAge > 0) url += '&child_age=' + childAge;
                if (token) {
                    url += '&token=' + encodeURIComponent(token);
                    var profileId = getProfileId();
                    if (profileId) url += '&profile_id=' + encodeURIComponent(profileId);
                    var minProgress = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
                    if (!isContinues) {
                        url += '&hide_watched=1&percent=' + encodeURIComponent(minProgress);
                    }
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
                        url: seed ? category + '?seed=' + seed : category,
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

    function getChildAge() {
        try {
            var account = Lampa.Storage.get('account');
            if (account && account.profile && account.profile.child == 1 && account.profile.age > 0) {
                return parseInt(account.profile.age, 10);
            }
        } catch (e) {}
        return 0;
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

    // sync=true (по умолчанию) — сохранить и на сервер. sync=false — только локально.
    // loadNumparserProfileSettings использует sync=false, чтобы дефолты не уходили на сервер.
    // onChange-обработчики настроек вызывают без флага (sync=true) — пользователь явно изменил.
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
        if (sync !== false && !_syncApplying && window.__NMSync) window.__NMSync.patch('np', getProfileKey(key), value);
    }

    // Базовый ключ из профильного: 'numparser_hide_watched_profile_abc' → 'numparser_hide_watched'
    function _baseKey(profileKey) {
        var idx = profileKey.lastIndexOf('_profile_');
        return idx >= 0 ? profileKey.slice(0, idx) : profileKey;
    }

    // Применить настройку пришедшую с сервера (без обратной отправки)
    function _applyNpSetting(profileKey, value) {
        value = storableValue(value);
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
            setProfileSetting('numparser_hide_watched', "true", false);
        }
        if (!hasProfileSetting('numparser_min_progress')) {
            setProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS, false);
        }
        if (!hasProfileSetting('numparser_source_name')) {
            setProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME, false);
        }
        if (!hasProfileSetting('numparser_menu_sort')) {
            setProfileSetting('numparser_menu_sort', [], false);
        }
        if (!hasProfileSetting('numparser_menu_hide')) {
            setProfileSetting('numparser_menu_hide', [], false);
        }
        if (!hasProfileSetting('numparser_quality_mode')) {
            setProfileSetting('numparser_quality_mode', 'simple', false);
        }
        if (!hasProfileSetting('numparser_hide_unrated')) {
            setProfileSetting('numparser_hide_unrated', false, false);
        }
        if (!hasProfileSetting('numparser_show_cert')) {
            setProfileSetting('numparser_show_cert', false, false);
        }

        // Восстанавливаем значения в Lampa.Storage, чтобы UI знал актуальные данные
        Lampa.Storage.set('numparser_hide_watched', storableValue(getProfileSetting('numparser_hide_watched', "true")), "true");
        Lampa.Storage.set('numparser_min_progress', getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS), "true");
        Lampa.Storage.set('numparser_source_name', getProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME), "true");
        Lampa.Storage.set('numparser_menu_sort', getProfileSetting('numparser_menu_sort', []));
        Lampa.Storage.set('numparser_menu_hide', getProfileSetting('numparser_menu_hide', []));
        Lampa.Storage.set('numparser_quality_mode', getProfileSetting('numparser_quality_mode', 'simple'));
        Lampa.Storage.set('numparser_hide_unrated', storableValue(getProfileSetting('numparser_hide_unrated', false)));
        Lampa.Storage.set('numparser_show_cert', storableValue(getProfileSetting('numparser_show_cert', false)));
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
        var btnReset = $('<div class="menu-edit-list__item menu-edit-list__ctrl selector">Сбросить порядок</div>');
        btnEnableAll.on('hover:enter', function () { list.find('.dot').attr('opacity', '1'); });
        btnDisableAll.on('hover:enter', function () { list.find('.dot').attr('opacity', '0'); });
        btnReset.on('hover:enter', function () {
            setProfileSetting('numparser_menu_sort', []);
            setProfileSetting('numparser_menu_hide', []);
            Lampa.Modal.close();
            Lampa.Controller.toggle('settings_component');
            Lampa.Noty.show('Порядок категорий сброшен');
        });
        list.append(btnEnableAll).append(btnDisableAll).append(btnReset);

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

        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_hide_unrated',
                type: 'trigger',
                default: false,
            },
            field: {
                name: 'Скрыть без рейтинга',
                description: 'Скрывать фильмы и сериалы без возрастного рейтинга'
            },
            onChange: function (value) {
                setProfileSetting('numparser_hide_unrated', value === true || value === "true");
                location.reload();
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
                    checkNpConnected();
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

        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_show_cert',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Возрастной рейтинг на карточках',
                description: 'Показывать метку 0+, 6+, 12+, 16+, 18+ в правом нижнем углу карточки'
            },
            onChange: function (value) {
                setProfileSetting('numparser_show_cert', value === true || value === 'true');
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
                            window.IS_NP = true;
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
            '.num-act-box{background:#1e1e2e;border-radius:1.8rem;padding:4rem 6rem;text-align:center;max-width:900px;width:85%;border:2px solid #ffffff15;box-sizing:border-box}',
            '.num-act-title{font-size:2.4rem;font-weight:700;margin-bottom:1.8rem}',
            '.num-act-url{color:#60a5fa;font-size:1.5rem;font-weight:600;margin-bottom:1.2rem;word-break:break-all}',
            '.num-act-hint{color:#aaa;font-size:1.3rem;margin-bottom:.6rem}',
            '.num-act-code{font-size:5rem;font-weight:800;letter-spacing:1rem;color:#4ade80;font-family:monospace;border:3px solid #4ade80;border-radius:1rem;padding:.8rem 2.5rem;display:inline-block;margin:1.5rem 0;max-width:100%;box-sizing:border-box}',
            '.num-act-timer{color:#888;font-size:1.1rem;margin-bottom:1rem}',
            '.num-act-status{font-size:1.3rem;min-height:2rem}',
            '.num-act-close{color:#555;font-size:1rem;margin-top:1.8rem}',
            '@media(max-width:600px){.num-act-box{padding:2.5rem 1.5rem;width:92%}.num-act-code{font-size:3rem;letter-spacing:.5rem;padding:.6rem 1.2rem}}',
        ].join('');
        document.head.appendChild(s);
    })();

    // ── End Device Activation Flow ──────────────────────────────────────────────

    var _timecodeInterceptorActive = false;
    var _lastSentTimecodes = {};  // { "cardId::hash": { percent, sentAt } }
    var SYNC_THROTTLE_MS = 15000; // не чаще раза в 15 сек на одну (card+hash) пару
    var _viewSent = {};           // { "cardId:YYYY-MM-DD": true } — дедуп play-событий на день

    // Play-событие для «Популярного» на сервере. Шлётся независимо от активации/токена
    // (по uid профиля или lampa_uid). Дедуп — один раз на карточку в сутки.
    function recordView(cardId, percent) {
        if (percent < 30 || !BASE_URL) return;
        var today = new Date().toISOString().slice(0, 10);
        var key = cardId + ':' + today;
        if (_viewSent[key]) return;
        _viewSent[key] = true;
        var uid = getProfileId() || Lampa.Storage.field('lampa_uid');
        if (!uid) return;
        fetch(BASE_URL + '/api/view?card_id=' + encodeURIComponent(cardId) +
              '&percent=' + percent +
              '&uid=' + encodeURIComponent(uid), { method: 'POST' })
            .catch(function () {});
    }

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

        // Play-событие для «Популярного» — шлём независимо от активации/токена/соединения
        // (IS_NP=true только после активации, а просмотры нужно учитывать и без неё).
        recordView(cardId, percent);

        // Синхронизация таймкодов — только при активном NP-соединении и токене.
        if (!window.IS_NP) {
            Log.info('Timecode sync: skip — no connection');
            return;
        }
        var token = Lampa.Storage.get('numparser_api_key', '');
        if (!token) {
            Log.info('Timecode sync: skip — no token');
            return;
        }

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

                var hideUnrated = settingsPanel.querySelector('select[data-name="numparser_hide_unrated"]');
                if (hideUnrated) hideUnrated.value = getProfileSetting('numparser_hide_unrated', false);

                var showCert = settingsPanel.querySelector('select[data-name="numparser_show_cert"]');
                if (showCert) showCert.value = getProfileSetting('numparser_show_cert', false);

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

        // Мгновенная смена нативного профиля Lampa (CUB): profile_select живёт на
        // внутреннем листенере модуля Account и на глобальный Listener не приходит.
        // np_profiles шлёт одноимённое событие на глобальном Listener — ловим оба.
        if (Lampa.Account && Lampa.Account.listener) {
            Lampa.Account.listener.follow('profile_select', function() {
                refreshProfileSettings();
            });
        }
        Lampa.Listener.follow('profile_select', function() {
            refreshProfileSettings();
        });

        // Слушаем изменения профиля для обновления меню Lampa
        Lampa.Listener.follow('state:changed', function(e) {
            if (e.target === 'favorite' && e.reason === 'profile') {
                refreshProfileSettings();
            }
        });

        setupTimecodeSync();
    }

    function checkNpConnected() {
        var token = Lampa.Storage.get('numparser_api_key', '');
        var baseUrl = BASE_URL;
        if (!token || !baseUrl) {
            window.IS_NP = false;
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', baseUrl + '/device/ping?token=' + encodeURIComponent(token), true);
        xhr.timeout = 5000;
        xhr.onload = function () { window.IS_NP = xhr.status === 200; };
        xhr.onerror = function () { window.IS_NP = false; };
        xhr.ontimeout = function () { window.IS_NP = false; };
        xhr.send();
    }

    function initNUMPlugin() {
        checkNpConnected();
        startPlugin();

        NUMPARSER_HIDE_WATCHED = Lampa.Storage.get('numparser_hide_watched');

        setTimeout(function() {
            initSettings();
            loadNumparserProfileSettings();
            if (window.__NMSync) {
                var NP_SYNC_KEYS = ['numparser_hide_watched', 'numparser_min_progress',
                    'numparser_source_name', 'numparser_menu_sort', 'numparser_menu_hide',
                    'numparser_quality_mode', 'numparser_hide_unrated'];
                window.__NMSync.register('np', [], _applyNpSetting, function (serverKeys) {
                    // Досылаем на сервер ключи которые есть локально но отсутствуют на сервере
                    NP_SYNC_KEYS.forEach(function (key) {
                        var profileKey = getProfileKey(key);
                        if (serverKeys.indexOf(profileKey) < 0 && hasProfileSetting(key)) {
                            setProfileSetting(key, getProfileSetting(key));
                        }
                    });
                });
            }
        }, 50);
    }

    function boot() {
        initNUMPlugin();
        try {
            Lampa.Manifest.plugins = {
                type: 'other',
                version: VERSION,
                name: 'NUMParser',
                description: 'Источник NUMParser: каталог, подборки, скрытие просмотренного'
            };
        } catch (e) {}
        console.log('NUMParser', 'plugin ready, version', VERSION);
    }

    if (window.appready) {
        boot();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                boot();
            }
        });
    }
})();

// ─── Метки возрастного рейтинга на карточках ──────────────────────────────────
(function () {
    'use strict';

    var US_TO_RU = {
        'G': '0+', 'TV-G': '0+', 'TV-Y': '0+',
        'NR': '0+', 'UR': '0+', 'TV-NR': '0+',
        'PG': '6+', 'TV-Y7': '6+', 'TV-PG': '6+',
        'PG-13': '12+', 'TV-14': '12+',
        'R': '16+',
        'NC-17': '18+', 'TV-MA': '18+'
    };

    var CERT_COLORS = {
        '0+': '#4caf50',
        '6+': '#8bc34a',
        '12+': '#ff9800',
        '16+': '#f44336',
        '18+': '#b71c1c'
    };

    var style = document.createElement('style');
    style.textContent = [
        '.np-cert-badge {',
        '    position: absolute; right: 0.4em; bottom: 3em;',
        '    padding: 0.4em 0.4em;',
        '    font-size: 0.8em; font-weight: bold;',
        '    border-radius: 0.3em;',
        '    z-index: 2; color: #fff;',
        '    line-height: 1.2;',
        '    text-transform: uppercase;',
        '    text-shadow: 0 1px 2px rgba(0,0,0,0.4);',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    function getCert(data) {
        if (!data) return '';
        var ru = data.certification_ru || '';
        if (ru) return ru;
        var us = data.certification_us || '';
        return US_TO_RU[us] || '';
    }

    function addCertToCard(card, data) {
        var _v = Lampa.Storage.get('numparser_show_cert');
        if (_v !== true && _v !== 'true') return;
        var el = card && card.get ? card.get(0) : (card && card[0] ? card[0] : card);
        var cardView = el && el.querySelector && el.querySelector('.card__view');
        var cert = getCert(data);
        if (!el) return;
        if (!cardView) return;
        if (cardView.querySelector('.np-cert-badge')) return;
        if (!cert) return;

        var badge = document.createElement('div');
        badge.className = 'np-cert-badge';
        badge.textContent = cert;
        badge.style.background = CERT_COLORS[cert] || '#555';
        cardView.appendChild(badge);
    }

    function init() {
        try {
            var cardMap = Lampa.Maker && Lampa.Maker.map('Card');
            if (cardMap && cardMap.Card) {
                var origVisible = cardMap.Card.onVisible;
                cardMap.Card.onVisible = function () {
                    if (origVisible) origVisible.call(this);
                    addCertToCard(this.html, this.data);
                };
                var origUpdate = cardMap.Card.onUpdate;
                cardMap.Card.onUpdate = function () {
                    if (origUpdate) origUpdate.call(this);
                    addCertToCard(this.html, this.data);
                };
            }
        } catch (e) { console.log('[np-cert] hook error', e); }
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();