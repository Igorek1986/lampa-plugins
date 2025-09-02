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

    // Базовая фильтрация без догрузки (синхронная)
    function basicFilterWatchedContent(results) {
        if (!Lampa.Storage.get('numparser_hide_watched', true)) {
            return results;
        }

        var favorite = Lampa.Storage.get('favorite', '{}');
        var timeTable = Lampa.Storage.cache('timetable', 300, []);

        return results.filter(function (item) {
            if (!item) return false;

            var mediaType = (item.first_air_date || item.number_of_seasons) ? 'tv' : 'movie';
            var checkItem = {
                id: item.id,
                media_type: mediaType,
                original_title: item.original_title || item.original_name || '',
                title: item.title || item.name || '',
                original_language: item.original_language || 'en',
                poster_path: item.poster_path || '',
                backdrop_path: item.backdrop_path || ''
            };

            var favoriteItem = Lampa.Favorite.check(checkItem);
            var watched = !!favoriteItem && !!favoriteItem.history;
            var thrown = !!favoriteItem && favoriteItem.thrown;

            if (thrown) return false;
            if (!watched) return true;
            if (watched && mediaType === 'movie') {
                // Проверяем прогресс
                var hashes = [];
                if (item.id) hashes.push(Lampa.Utils.hash(String(item.id)));
                if (item.original_title) hashes.push(Lampa.Utils.hash(item.original_title));
                var hasProgress = false;
                for (var i = 0; i < hashes.length; i++) {
                    var view = Lampa.Storage.cache('file_view', 300, [])[hashes[i]];
                    if (view) {
                        hasProgress = true;
                        if (!view.percent || view.percent >= MIN_PROGRESS) {
                            return false;
                        }
                    }
                }
                // Если в истории, но прогресса нет вообще — скрыть
                if (!hasProgress) return false;
                // Если есть прогресс, но он меньше порога — показываем
                return true;
            }

            if (mediaType === 'tv') {
                var historyEpisodes = getEpisodesFromHistory(item.id, favorite);
                var timeTableEpisodes = getEpisodesFromTimeTable(item.id, timeTable);
                var releasedEpisodes = mergeEpisodes(historyEpisodes, timeTableEpisodes);

                return !allEpisodesWatched(
                    item.original_title || item.original_name || item.title || item.name,
                    releasedEpisodes
                );
            }

            return true;
        });
    }
    var isLoadingMore = {};

    // Асинхронная функция для догрузки страниц
    function loadMoreUntilFullAsync(currentResults, category, currentPage, source, totalPages, callback) {
        var results = currentResults.slice();
        var page = currentPage;
        var maxPages = 10;

        console.log('[Numparser] Loading more - current:', results.length, 'needed:', 20 - results.length, 
                    'page:', page, 'totalPages:', totalPages, 'maxPages:', maxPages, 'category:', category);

        function loadNextPage() {
            console.log('[Numparser] Loading page', page, 'current results:', results.length, 'totalPages:', totalPages);
            
            if (results.length >= 20 || page >= totalPages || page >= maxPages) {
                console.log('[Numparser] Stopping loading - reached limit. Results:', results.length, 
                            'Page:', page, 'TotalPages:', totalPages, 'MaxPages:', maxPages);
                callback(results.slice(0, 20));
                return;
            }

            page++;

            isLoadingMore[category + '_' + page] = true;
            
            var params = {
                url: category,
                page: page,
                source: source
            };

            console.log('[Numparser] Requesting page', page, 'of category', category);
            Lampa.Api.sources[source].list(params, function(response) {
                delete isLoadingMore[category + '_' + page];
                if (response && response.results && Array.isArray(response.results)) {
                    console.log('[Numparser] Received page', page, 'with', response.results.length, 
                            'items. Response total_pages:', response.total_pages);
                    
                    var filtered = basicFilterWatchedContent(response.results);
                    console.log('[Numparser] After filtering new page:', filtered.length, 'items remain');

                    // var currentActivity = Lampa.Activity.active();  
                    // var isCategoryFull = currentActivity && currentActivity.component === 'category_full'; 
                    
                    results = results.concat(filtered);
                    console.log('[Numparser] Total results after concatenation:', results.length);
                    
                    if ( results.length < 20 && page < totalPages && page < maxPages) {
                        console.log('[Numparser] Need more items. Current:', results.length, 'Loading next page...');
                        loadNextPage();
                    } else {
                        console.log('[Numparser] Loading complete. Final result:', results.length, 'items');
                        callback(results.slice(0, 20));
                    }
                } else {
                    console.log('[Numparser] No valid response received for page', page);
                    callback(results.slice(0, 20));
                }
            });
        }

        loadNextPage();
    }

    // Основная функция фильтрации
    function filterWatchedContent(results, category, page, source, totalPages, callback) {
        console.log('[Numparser] Filtering content - initial:', results.length, 'items, category:', category, 'page:', page, 'source:', source, 'totalPages:', totalPages);
        
        if (!Lampa.Storage.get('numparser_hide_watched', true)) {
            console.log('[Numparser] Filtering disabled, returning all results');
            callback(results);
            return;
        }

        var filtered = basicFilterWatchedContent(results);
        console.log('[Numparser] After basic filtering:', filtered.length, 'items remaining');
        
        // Если после фильтрации осталось меньше 20 элементов и есть еще страницы - догружаем
        if (filtered.length < 20 && category && source && page < totalPages) {
            console.log('[Numparser] Need to load more. Current:', filtered.length, 'items, loading additional pages...');
            loadMoreUntilFullAsync(filtered, category, page, source, totalPages, callback);
        } else {
            console.log('[Numparser] No need to load more or cannot load. Returning:', filtered.length, 'items');
            callback(filtered);
        }
    }

    function getEpisodesFromHistory(id, favorite) {
        var historyCard = favorite.card.filter(function (card) {
            return card.id === id && Array.isArray(card.seasons) && card.seasons.length > 0;
        })[0];

        if (!historyCard) {
            return [];
        }

        var realSeasons = historyCard.seasons.filter(function (season) {
            return season.season_number > 0
                && season.episode_count > 0
                && season.air_date
                && new Date(season.air_date) < new Date();
        });

        if (realSeasons.length === 0) {
            return [];
        }

        var seasonEpisodes = [];
        for (var seasonIndex = 0; seasonIndex < realSeasons.length; seasonIndex++) {
            var season = realSeasons[seasonIndex];

            for (var episodeIndex = 1; episodeIndex <= season.episode_count; episodeIndex++) {
                seasonEpisodes.push({
                    season_number: season.season_number,
                    episode_number: episodeIndex
                });
            }
        }

        return seasonEpisodes;
    }

    function getEpisodesFromTimeTable(id, timeTable) {
        if (!Array.isArray(timeTable)) return [];

        var serial = timeTable.find(function (item) {
            return item.id === id && Array.isArray(item.episodes);
        });

        return serial ? serial.episodes.filter(function (episode) {
            return episode.season_number > 0 &&
                episode.air_date &&
                new Date(episode.air_date) < new Date();
        }) : [];
    }

    function mergeEpisodes(arr1, arr2) {
        var merged = arr1.concat(arr2);
        var unique = [];

        merged.forEach(function (episode) {
            if (!unique.some(function (e) {
                return e.season_number === episode.season_number &&
                    e.episode_number === episode.episode_number;
            })) {
                unique.push(episode);
            }
        });

        return unique;
    }

    function allEpisodesWatched(title, episodes) {
        if (!episodes || !episodes.length) return false;

        return episodes.every(function (episode) {
            var hash = Lampa.Utils.hash([
                episode.season_number,
                episode.season_number > 10 ? ':' : '',
                episode.episode_number,
                title
            ].join(''));

            var view = Lampa.Timeline.view(hash);
            return view.percent > MIN_PROGRESS;
        });
    }

    // Настройки видимости групп годов
    var currentYear = new Date().getFullYear();

    function isYearVisible(year) {
        if (year >= 1980 && year <= 1989) return CATEGORY_VISIBILITY.year_1980_1989.visible;
        if (year >= 1990 && year <= 1999) return CATEGORY_VISIBILITY.year_1990_1999.visible;
        if (year >= 2000 && year <= 2009) return CATEGORY_VISIBILITY.year_2000_2009.visible;
        if (year >= 2010 && year <= 2019) return CATEGORY_VISIBILITY.year_2010_2019.visible;
        if (year >= 2020 && year <= currentYear) return CATEGORY_VISIBILITY.year_2020_current.visible;
        return false;
    }

    // Настройки видимости категорий
    var CATEGORY_VISIBILITY = {
        // myshows_unwatched: {
        //     title: 'Непросмотренные (MyShows)',
        //     visible: Lampa.Storage.get('numparser_category_myshows_unwatched', true)
        // },
        myshows_unwatched: {  
            title: 'Непросмотренные (MyShows)',  
            visible: function() {  
                return Lampa.Storage.get('numparser_category_myshows_unwatched', true) &&   
                    !Lampa.Storage.get('numparser_myshows_fastapi', false);  
            }  
        },  
        unwatched_serials: {  
            title: 'Непросмотренные (MyShows) FastAPI',  
            visible: function() {  
                return Lampa.Storage.get('numparser_category_myshows_unwatched', true) &&   
                    Lampa.Storage.get('numparser_myshows_fastapi', false);  
            }  
        }, 
        legends: {
            title: 'Топ фильмы',
            visible: Lampa.Storage.get('numparser_category_legends', true)
        },
        episodes: {
            title: 'Ближайшие выходы эпизодов',
            visible: true
        },
        k4_new: {
            title: 'В высоком качестве (новые)',
            visible: Lampa.Storage.get('numparser_category_k4_new', true)
        },
        movies_new: {
            title: 'Новые фильмы',
            visible: Lampa.Storage.get('numparser_category_movies_new', true)
        },
        russian_new_movies: {
            title: 'Новые русские фильмы',
            visible: Lampa.Storage.get('numparser_category_russian_new_movies', true)
        },
        all_tv: {
            title: 'Сериалы',
            visible: Lampa.Storage.get('numparser_category_all_tv', true)
        },
        russian_tv: {
            title: 'Русские сериалы',
            visible: Lampa.Storage.get('numparser_category_russian_tv', true)
        },
        anime: {
            title: 'Аниме',
            visible: Lampa.Storage.get('numparser_category_anime', true)
        },
        k4: {
            title: 'В высоком качестве',
            visible: Lampa.Storage.get('numparser_category_k4', true)
        },
        movies: {
            title: 'Фильмы',
            visible: Lampa.Storage.get('numparser_category_movies', true)
        },
        russian_movies: {
            title: 'Русские фильмы',
            visible: Lampa.Storage.get('numparser_category_russian_movies', true)
        },
        cartoons: {
            title: 'Мультфильмы',
            visible: Lampa.Storage.get('numparser_category_cartoons', true)
        },
        cartoons_tv: {
            title: 'Мультсериалы',
            visible: Lampa.Storage.get('numparser_category_cartoons_tv', true)
        },
        // Группы годов
        year_1980_1989: {
            title: 'Фильмы 1980-1989',
            visible: Lampa.Storage.get('numparser_year_1980_1989', false)
        },
        year_1990_1999: {
            title: 'Фильмы 1990-1999',
            visible: Lampa.Storage.get('numparser_year_1990_1999', false)
        },
        year_2000_2009: {
            title: 'Фильмы 2000-2009',
            visible: Lampa.Storage.get('numparser_year_2000_2009', false)
        },
        year_2010_2019: {
            title: 'Фильмы 2010-2019',
            visible: Lampa.Storage.get('numparser_year_2010_2019', true)
        },
        year_2020_current: {
            title: 'Фильмы 2020-' + currentYear,
            visible: Lampa.Storage.get('numparser_year_2020_current', true)
        }
    };

    var CATEGORIES = {
        k4: 'lampac_movies_4k',
        k4_new: 'lampac_movies_4k_new',
        movies_new: "lampac_movies_new",
        movies: 'lampac_movies',
        russian_new_movies: 'lampac_movies_ru_new',
        russian_movies: 'lampac_movies_ru',
        cartoons: 'lampac_all_cartoon_movies',
        cartoons_tv: 'lampac_all_cartoon_series',
        all_tv: 'lampac_all_tv_shows',
        russian_tv: 'lampac_all_tv_shows_ru',
        legends: 'legends_id',
        anime: 'anime_id',
        unwatched_serials: 'unwatched_serials',
    };

    // Динамически добавляем категории для годов
    for (var year = 1980; year <= currentYear; year++) {
        CATEGORIES['movies_id_' + year] = 'movies_id_' + year;
    }

    function NumparserApiService() {
        var self = this;
        self.network = new Lampa.Reguest();
        self.discovery = false;

        function normalizeData(json, category, page, source, callback) {  
            console.log('[Numparser] Normalize data called for:', category, 'page:', page, 'initial results:', json.results ? json.results.length : 0);
            var isInternal = isLoadingMore[category + '_' + page];

            var currentActivity = Lampa.Activity.active();  
            var isCategoryFull = currentActivity && currentActivity.component === 'category_full';
            
            var normalized = {  
                results: (json.results || []).map(function (item) {  
                    var dataItem = {  
                        id: item.id,  
                        poster_path: item.poster_path || item.poster || '',  
                        img: item.img,  
                        overview: item.overview || item.description || '',  
                        vote_average: item.vote_average || 0,  
                        backdrop_path: item.backdrop_path || item.backdrop || '',  
                        background_image: item.background_image,  
                        source: Lampa.Storage.get('numparser_source_name') || SOURCE_NAME,  
                        type: (item.first_air_date || item.number_of_seasons) ? 'tv' : 'movie',  
                        original_title: item.original_title || item.original_name || '',  
                        title: item.title || item.name || '',  
                        original_language: item.original_language || 'en',  
                        first_air_date: item.first_air_date,  
                        number_of_seasons: item.number_of_seasons,  
                        status: item.status || '',  
                    };  

                    if (item.release_quality) dataItem.release_quality = item.release_quality;  
                    if (item.release_date) dataItem.release_date = item.release_date;  
                    if (item.last_air_date) dataItem.last_air_date = item.last_air_date;  
                    if (item.last_episode_to_air) dataItem.last_episode_to_air = item.last_episode_to_air;  
                    if (item.progress_marker) dataItem.progress_marker = item.progress_marker;  
                    if (item.watched_count !== undefined) dataItem.watched_count = item.watched_count;  
                    if (item.total_count !== undefined) dataItem.total_count = item.total_count;  
                    if (item.released_count !== undefined) dataItem.released_count = item.released_count;  

                    dataItem.promo_title = dataItem.title || dataItem.name || dataItem.original_title || dataItem.original_name;  
                    dataItem.promo = dataItem.overview;  

                    return dataItem;  
                }),  
                page: json.page || 1,  
                total_pages: json.total_pages || json.pagesCount || 1,  
                total_results: json.total_results || json.total || 0  
            };  

            console.log('[Numparser] Before filtering in normalizeData:', normalized.results.length, 'items');
            
            if (Lampa.Storage.get('numparser_hide_watched', true)) {  
                var filtered = basicFilterWatchedContent(normalized.results);  
                
                // Догружаем только если это НЕ внутренний запрос  
                if (!isInternal && !isCategoryFull && filtered.length < 20 && normalized.total_pages > 1) {  
                    loadMoreUntilFullAsync(filtered, category, page, source, normalized.total_pages, function(results) {  
                        normalized.results = results;  
                        callback(normalized);  
                    });  
                } else {  
                    normalized.results = filtered;  
                    callback(normalized);  
                }  
            } else {  
                callback(normalized);  
            } 
        }

        self.get = function (url, params, onComplete, onError) {
            self.network.silent(url, function (json) {
                if (!json) {
                    onError(new Error('Empty response from server'));
                    return;
                }
                
                var urlParts = url.split('/');
                var category = urlParts[urlParts.length - 1].split('?')[0];
                var page = 1;
                var urlParams = new URLSearchParams(url.split('?')[1] || '');
                if (urlParams.has('page')) {
                    page = parseInt(urlParams.get('page'));
                }
                
                // Используем асинхронную версию normalizeData с callback
                normalizeData(json, category, page, SOURCE_NAME, function(normalizedJson) {
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

            var category = params.url || CATEGORIES.movies_new;
            var page = params.page || 1;
            
            // Формирование URL
            var url;
            if (category === 'unwatched_serials') {  
                var login = Lampa.Storage.get('myshows_login', '');  
                var unicId = Lampa.Storage.get('lampac_unic_id', '');  
                var profileId = Lampa.Storage.get('lampac_profile_id', '');  
                
                if (!login || !unicId) {  
                    onComplete({results: [], page: page, total_pages: 1, total_results: 0});
                    return;  
                }  
                
                var hashedLogin = Lampa.Utils.hash(login);  
                var pathHash = Lampa.Utils.hash(unicId + profileId);
                url = BASE_URL + '/myshows/' + category + '/' + hashedLogin + '/' + pathHash +   
                    '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
            } else {  
                url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
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
            params.method = !!(card.number_of_seasons || card.seasons || card.first_air_date) ? 'tv' : 'movie';
            Lampa.Api.sources.tmdb.full(params, onSuccess, onError);
        }

        self.category = function (params, onSuccess, onError) {
            params = params || {};

            var partsData = [];

            // Основные категории с проверкой видимости
            if (CATEGORY_VISIBILITY.myshows_unwatched.visible) {
                partsData.push(function (callback) {
                    if (!window.MyShows || !window.MyShows.getUnwatchedShowsWithDetails) {
                        callback({skip: true});
                        return;
                    }
                    
                    window.MyShows.getUnwatchedShowsWithDetails(function(response) {
                        if (response.error || !response.shows || response.shows.length === 0) {
                            callback({skip: true});
                            return;
                        }
                        
                        callback({
                            title: CATEGORY_VISIBILITY.myshows_unwatched.title,
                            results: response.shows,
                            cardClass: window.MyShows.createMyShowsCard,
                            nomore: true
                        });
                    });
                });
            }

            if (CATEGORY_VISIBILITY.unwatched_serials.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.unwatched_serials, CATEGORY_VISIBILITY.unwatched_serials.title, callback);
            });

            if (CATEGORY_VISIBILITY.legends.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.legends, CATEGORY_VISIBILITY.legends.title, callback);
            });
            if (CATEGORY_VISIBILITY.episodes.visible) {
                partsData.push(function (callback) {
                    callback({
                        source: 'tmdb',
                        results: Lampa.TimeTable.lately().slice(0, 20),
                        title: CATEGORY_VISIBILITY.episodes.title,
                        nomore: true,
                        cardClass: function (elem, params) {
                            return new Episode(elem, params);
                        }
                    });
                });
            }
            if (CATEGORY_VISIBILITY.k4_new.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.k4_new, CATEGORY_VISIBILITY.k4_new.title, callback);
            });
            if (CATEGORY_VISIBILITY.movies_new.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.movies_new, CATEGORY_VISIBILITY.movies_new.title, callback);
            });
            if (CATEGORY_VISIBILITY.russian_new_movies.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.russian_new_movies, CATEGORY_VISIBILITY.russian_new_movies.title, callback);
            });
            if (CATEGORY_VISIBILITY.all_tv.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.all_tv, CATEGORY_VISIBILITY.all_tv.title, callback);
            });
            if (CATEGORY_VISIBILITY.russian_tv.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.russian_tv, CATEGORY_VISIBILITY.russian_tv.title, callback);
            });
            if (CATEGORY_VISIBILITY.cartoons.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.cartoons, CATEGORY_VISIBILITY.cartoons.title, callback);
            });
            if (CATEGORY_VISIBILITY.k4.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.k4, CATEGORY_VISIBILITY.k4.title, callback);
            });
            if (CATEGORY_VISIBILITY.movies.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.movies, CATEGORY_VISIBILITY.movies.title, callback);
            });
            if (CATEGORY_VISIBILITY.russian_movies.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.russian_movies, CATEGORY_VISIBILITY.russian_movies.title, callback);
            });
            if (CATEGORY_VISIBILITY.cartoons_tv.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.cartoons_tv, CATEGORY_VISIBILITY.cartoons_tv.title, callback);
            });
            if (CATEGORY_VISIBILITY.anime.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.anime, CATEGORY_VISIBILITY.anime.title, callback);
            });

            // Добавляем категории по годам в обратном порядке (от новых к старым)
            for (var year = 2025; year >= 1980; year--) {
                if (isYearVisible(year)) {
                    (function (y) {
                        partsData.push(function (callback) {
                            makeRequest(CATEGORIES['movies_id_' + y], 'Фильмы ' + y + ' года', callback);
                        });
                    })(year);
                }
            }

            function makeRequest(category, title, callback) {
                var page = params.page || 1;
                var url;
                
                if (category === 'unwatched_serials') {  
                    var login = Lampa.Storage.get('myshows_login', '');  
                    var unicId = Lampa.Storage.get('lampac_unic_id', '');  
                    var profileId = Lampa.Storage.get('lampac_profile_id', '');  
                    
                    if (!login || !unicId) {  
                        callback({error: 'MyShows login or unic_id not found'});  
                        return;  
                    }  
                    
                    var hashedLogin = Lampa.Utils.hash(login);  
                    var pathHash = Lampa.Utils.hash(unicId + profileId);
                    url = BASE_URL + '/myshows/' + category + '/' + hashedLogin + '/' + pathHash +   
                        '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                } else {  
                    url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                }

                self.get(url, params, function (json) {
                    var filteredResults = json.results || [];
                    var totalResults = json.total_results || 0;
                    var totalPages = json.total_pages || 1;

                    // Корректируем общее количество результатов с учетом фильтрации
                    if (filteredResults.length < (json.results || []).length) {
                        totalResults = totalResults - ((json.results || []).length - filteredResults.length);
                        totalPages = Math.ceil(totalResults / 20); // ПЕРЕСЧИТЫВАЕМ totalPages
                    }

                    if (window.MyShows && window.MyShows.prepareProgressMarkers) {    
                        var preparedData = window.MyShows.prepareProgressMarkers({results: filteredResults});    
                        filteredResults = preparedData.results || preparedData.shows || filteredResults;    
                    }

                    var result = {
                        url: category,
                        title: title,
                        page: page,
                        total_results: totalResults,
                        total_pages: totalPages, // Используем пересчитанное значение
                        more: totalPages > page,
                        results: filteredResults,
                        source: Lampa.Storage.get('numparser_source_name') || SOURCE_NAME,
                        _original_total_results: json.total_results || 0,
                        _original_total_pages: json.total_pages || 1,
                        _original_results: json.results || []
                    };

                    if (category === 'unwatched_serials' && window.MyShows && window.MyShows.createMyShowsCard) {  
                        result.cardClass = window.MyShows.createMyShowsCard;  
                    }  

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
            self.img_poster.onload = function () {
            };
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
            self.img_poster.onerror = function () {
            };
            self.img_poster.onload = function () {
            };
            self.img_episode.onerror = function () {
            };
            self.img_episode.onload = function () {
            };
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

        // Добавляем раздел настроек
        Lampa.SettingsApi.addComponent({
            component: 'numparser_settings',
            name: SOURCE_NAME,
            icon: ICON
        });

        // Добавляем переключатель фильтрации
        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_hide_watched',
                type: 'trigger',
                //   default: Lampa.Storage.get('numparser_hide_watched', true)
                default: Lampa.Storage.get('numparser_hide_watched', "true") === "true"
            },
            field: {
                name: 'Скрыть просмотренные',
                description: 'Скрывать просмотренные фильмы и сериалы'
            },

            onChange: function (value) {
                Lampa.Storage.set('numparser_hide_watched', value === true || value === "true");

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
                default: DEFAULT_MIN_PROGRESS.toString()
            },
            field: {
                name: 'Порог просмотра',
                description: 'Минимальный процент просмотра для скрытия контента'
            },
            onChange: function (value) {
                newProgress = parseInt(value);
                Lampa.Storage.set('numparser_min_progress', newProgress);
                MIN_PROGRESS = newProgress;
            }
        });

        // Настройка для изменения названия источника
        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_source_name',
                type: 'input',
                placeholder: 'Введите название',
                values: '',
                default: DEFAULT_SOURCE_NAME
            },
            field: {
                name: 'Название источника',
                description: 'Изменение названия источника в меню'
            },
            onChange: function (value) {
                newName = value;
                $('.num_text').text(value);
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({    
            component: 'numparser_settings',    
            param: {    
                name: 'numparser_myshows_fastapi',    
                type: 'trigger',    
                default: false    
            },    
            field: {    
                name: 'Использовать FastAPI для MyShows',    
                description: 'Загружать данные MyShows через FastAPI вместо локального кеша'    
            },    
            onChange: function (value) {      
                var useFastAPI = value === true || value === "true";    
                
                if (useFastAPI) {    
                    if (window.MyShows && window.MyShows.getUnwatchedShowsWithDetails && window.MyShows.saveToFastAPI) {    
                        Lampa.Loading.start();    
                        
                        window.MyShows.getUnwatchedShowsWithDetails(function(localData) {    
                            console.log('[NUMParser] Получены локальные данные:', localData);  
                            
                            if (localData && localData.shows && localData.shows.length > 0) {    
                                console.log('[NUMParser] Сохраняем', localData.shows.length, 'сериалов в FastAPI');  
                                
                                window.MyShows.saveToFastAPI(localData, 'unwatched_serials', function() {    
                                    console.log('[NUMParser] Сохранение завершено, переключаемся на FastAPI');  
                                    Lampa.Storage.set('numparser_myshows_fastapi', true);    
                                    Lampa.Loading.stop();    
                                    location.reload();    
                                });     
                            } else {    
                                console.log('[NUMParser] Нет локальных данных для копирования');  
                                Lampa.Storage.set('numparser_myshows_fastapi', true);    
                                Lampa.Loading.stop();    
                                location.reload();    
                            }    
                        });    
                    } else {    
                        console.log('[NUMParser] MyShows плагин недоступен');  
                        Lampa.Storage.set('numparser_myshows_fastapi', true);    
                        location.reload();    
                    }    
                } else {    
                    Lampa.Storage.set('numparser_myshows_fastapi', false);    
                    location.reload();    
                }    
            } 
        });

        Object.keys(CATEGORY_VISIBILITY).forEach(function (option) {
            // Проверяем настройку FastAPI для категорий MyShows  
            var myshows_fastapi = Lampa.Storage.get('numparser_myshows_fastapi', false);  
            
            // Пропускаем неактивную категорию MyShows     
            if (option === 'myshows_unwatched' && myshows_fastapi) {    
                CATEGORY_VISIBILITY.myshows_unwatched.visible = false;
                return; // Если FastAPI включен, пропускаем локальную категорию    
            }    
            if (option === 'unwatched_serials' && !myshows_fastapi) {  
                CATEGORY_VISIBILITY.unwatched_serials.visible = false;
                return; // Если FastAPI выключен, пропускаем FastAPI категорию    
            }   
            
            var settingName = 'numparser_settings' + option + '_visible';

            var visible = Lampa.Storage.get(settingName, "true").toString() === "true";
            CATEGORY_VISIBILITY[option].visible = visible;

            Lampa.SettingsApi.addParam({
                component: "numparser_settings",
                param: {
                    name: settingName,
                    type: "trigger",
                    default: visible
                },
                field: {
                    name: CATEGORY_VISIBILITY[option].title,
                },
                onChange: function (value) {
                    CATEGORY_VISIBILITY[option].visible = value === "true";
                }
            });
        });

        var numparserApi = new NumparserApiService();
        Lampa.Api.sources.numparser = numparserApi;
        Object.defineProperty(Lampa.Api.sources, SOURCE_NAME, {
            get: function () {
                return numparserApi;
            }
        });

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
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                startPlugin();
            }
        });
    }
})();