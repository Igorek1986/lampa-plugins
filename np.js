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
    var IS_LAMPAC = null;
    var HAS_TIMECODE_USER = null;


    // ✅ НОВАЯ ЛОГИКА: Глобальное хранилище таймкодов  
    var globalTimecodes = null;  
    var timecodesLoading = false;  
    var timecodesCallbacks = [];  


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
  
    // Функция загрузки всех таймкодов пользователя  
    function loadAllTimecodes(callback) {  
        // ✅ Проверяем, что callback - это функция  
        if (callback && typeof callback === 'function') {  
            if (globalTimecodes !== null) {  
                callback(globalTimecodes);  
                return;  
            }  
            
            timecodesCallbacks.push(callback);  
            
            if (timecodesLoading) {  
                return;  
            }  
        } else {  
            // Если callback не передан, просто загружаем данные  
            if (globalTimecodes !== null) {  
                return;  
            }  
            
            if (timecodesLoading) {  
                return;  
            }  
        }  
        
        timecodesLoading = true;   
        Log.info('Loading all timecodes from /timecode/all_views');  
  
        var uid = Lampa.Storage.get('account_email') || Lampa.Storage.get('user_uid') || Lampa.Storage.get('lampac_unic_id', '');  
        var profileId = Lampa.Storage.get('lampac_profile_id', '');  
  
        if (!uid) {  
            Log.info('No user ID found, skipping timecode loading');  
            globalTimecodes = {};  
            timecodesLoading = false;  
              
            // Вызываем все ожидающие callbacks  
            timecodesCallbacks.forEach(function(cb) {  
                cb(globalTimecodes);  
            });  
            timecodesCallbacks = [];  
            return;  
        }  
  
        var url = window.location.origin + '/timecode/all_views?uid=' + encodeURIComponent(uid);  
        if (profileId) {  
            url += '&profile_id=' + encodeURIComponent(profileId);  
        }  
  
        var network = new Lampa.Reguest();  
        network.silent(url, function(response) {  
            Log.info('Timecodes loaded:', Object.keys(response || {}).length, 'cards');  
            globalTimecodes = response || {};  
            timecodesLoading = false;  
  
            // Вызываем все ожидающие callbacks  
            timecodesCallbacks.forEach(function(cb) {  
                cb(globalTimecodes);  
            });  
            timecodesCallbacks = [];  
        }, function(error) {  
            Log.error('Error loading timecodes:', error);  
            globalTimecodes = {};  
            timecodesLoading = false;  
  
            // Вызываем все ожидающие callbacks с пустым объектом  
            timecodesCallbacks.forEach(function(cb) {  
                cb(globalTimecodes);  
            });  
            timecodesCallbacks = [];  
        });  
    }  
  
    // ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ ФИЛЬТРАЦИИ  
    function basicFilterWatchedContent(results, callback) {      
        if (!Lampa.Storage.get('numparser_hide_watched')) {      
            callback(results);      
            return;      
        }      
        
        // ✅ Загружаем таймкоды, если их еще нет  
        loadAllTimecodes(function() {  
            var filtered = results.filter(function (item) {      
                if (!item) return false;      
            
                var mediaType = (item.first_air_date || item.number_of_seasons) ? 'tv' : 'movie';      
                    
                // Проверяем статус "выброшено" через Favorite      
                var favoriteItem = Lampa.Favorite.check(item);      
                var thrown = !!favoriteItem && favoriteItem.thrown;      
                if (thrown) return false;      
            
                if (mediaType === 'movie') {      
                    var cardId = item.id + '_movie';    
                        
                    if (globalTimecodes && globalTimecodes[cardId]) {    
                        var timecodes = globalTimecodes[cardId];    
                            
                        for (var key in timecodes) {    
                            try {    
                                var data = JSON.parse(timecodes[key]);    
                                if (data.percent >= MIN_PROGRESS) {    
                                    return false;  
                                }    
                            } catch (e) {    
                                Log.error('Error parsing timecode:', e);    
                            }    
                        }    
                    }    
                }      
        
                if (mediaType === 'tv') {        
                    var cardId = item.id + '_tv';      
                    var releasedEpisodes = getReleasedEpisodesFromTMDB(item);      
                        
                    if (!releasedEpisodes || !releasedEpisodes.length) {      
                        return true;      
                    }      
                
                    if (globalTimecodes && globalTimecodes[cardId]) {      
                        var timecodes = globalTimecodes[cardId];      
                        var originalTitle = item.original_name || item.original_title || item.name || item.title;  
                            
                        var allWatched = releasedEpisodes.every(function(episode) {      
                            // ✅ Формируем хеш как в Lampa: season + episode + original_title  
                            var hashString = episode.season_number.toString() +   
                                        episode.episode_number.toString() +   
                                        originalTitle;  
                            var episodeHash = Lampa.Utils.hash(hashString);  
                                
                            // ✅ Проверяем наличие хеша в таймкодах  
                            if (timecodes[episodeHash]) {  
                                try {      
                                    var data = JSON.parse(timecodes[episodeHash]);      
                                    if (data.percent >= MIN_PROGRESS) {      
                                        return true; // Эпизод просмотрен  
                                    }      
                                } catch (e) {  
                                    Log.error('Error parsing timecode for hash:', episodeHash, e);  
                                }      
                            }      
                            return false; // Эпизод не просмотрен  
                        });      
                            
                        return !allWatched; // Скрыть, если все эпизоды просмотрены  
                    }      
                }   
            
                return true;      
            });  
            
            // ✅ Возвращаем отфильтрованные результаты через callback  
            callback(filtered);  
        });  
    }
  
    var isLoadingMore = {};

    // Асинхронная функция для догрузки страниц
    function loadMoreUntilFullAsync(currentResults, category, currentPage, source, totalPages, callback) {  
        var results = currentResults.slice();  
        var page = currentPage;  
        var maxPages = 10;  
    
        Log.info('Loading more - current:', results.length, 'needed:', 20 - results.length,   
                    'page:', page, 'totalPages:', totalPages, 'maxPages:', maxPages, 'category:', category);  
    
        function loadNextPage() {  
            Log.info('Loading page', page, 'current results:', results.length, 'totalPages:', totalPages);  
            
            if (results.length >= 20 || page >= totalPages || page >= maxPages) {  
                Log.info('Stopping loading - reached limit. Results:', results.length,   
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
    
            Log.info('Requesting page', page, 'of category', category);  
            Lampa.Api.sources[source].list(params, function(response) {  
                delete isLoadingMore[category + '_' + page];  
                
                if (response && response.results && Array.isArray(response.results)) {  
                    Log.info('Received page', page, 'with', response.results.length,   
                            'items. Response total_pages:', response.total_pages);  
                    
                    // ✅ ИСПРАВЛЕНО: Асинхронный вызов с callback  
                    basicFilterWatchedContent(response.results, function(filtered) {  
                        Log.info('After filtering new page:', filtered.length, 'items remain');  
                        
                        results = results.concat(filtered);  
                        Log.info('Total results after concatenation:', results.length);  
                        
                        if (results.length < 20 && page < totalPages && page < maxPages) {  
                            Log.info('Need more items. Current:', results.length, 'Loading next page...');  
                            loadNextPage();  
                        } else {  
                            Log.info('Loading complete. Final result:', results.length, 'items');  
                            callback(results.slice(0, 20));  
                        }  
                    });  
                } else {  
                    Log.info('No valid response received for page', page);  
                    callback(results.slice(0, 20));  
                }  
            });  
        }  
    
        loadNextPage();  
    }

    function getReleasedEpisodesFromTMDB(item) {      
        var episodes = [];      
        
        if (!item) {  
            return episodes;  
        }  
        
        // Проверяем наличие last_episode_to_myshows    
        if (item.last_episode_to_myshows) {    
            
            var lastEp = item.last_episode_to_myshows;    
            
            // Если есть данные seasons, используем их  
            if (item.seasons && Array.isArray(item.seasons)) {  
                for (var season = 1; season <= lastEp.season_number; season++) {      
                    var maxEpisode = (season === lastEp.season_number)       
                        ? lastEp.episode_number       
                        : getEpisodeCountForSeason(item.seasons, season);      
                        
                    for (var episode = 1; episode <= maxEpisode; episode++) {      
                        episodes.push({      
                            season_number: season,      
                            episode_number: episode      
                        });      
                    }      
                }  
            } else {  
                // Если нет seasons, генерируем только для последнего сезона  
                for (var episode = 1; episode <= lastEp.episode_number; episode++) {  
                    episodes.push({  
                        season_number: lastEp.season_number,  
                        episode_number: episode  
                    });  
                }  
            }  
             
            return episodes;    
        }    
        
        // Fallback на TMDB (остальной код без изменений)   
        var lastEpisode = item.last_episode_to_air;      
        
        if (!lastEpisode || !item.seasons) {    
            return episodes;    
        }    
        
        for (var season = 1; season <= lastEpisode.season_number; season++) {      
            var maxEpisode = (season === lastEpisode.season_number)       
                ? lastEpisode.episode_number       
                : getEpisodeCountForSeason(item.seasons, season);      
                
            for (var episode = 1; episode <= maxEpisode; episode++) {      
                episodes.push({      
                    season_number: season,      
                    episode_number: episode      
                });      
            }      
        }      
        
        return episodes;      
    }
    
    function getEpisodeCountForSeason(seasons, seasonNumber) {  
        var season = seasons.find(function(s) {   
            return s.season_number === seasonNumber && s.episode_count > 0;   
        });  
        return season ? season.episode_count : 0;  
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
        myshows_unwatched: {
            title: 'Непросмотренные (MyShows)',
            visible: Lampa.Storage.get('numparser_category_myshows_unwatched', true)
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
            Log.info('Normalize data called for:', category, 'page:', page, 'initial results:', json.results ? json.results.length : 0);
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
                        media_type: (item.first_air_date || item.number_of_seasons) ? 'tv' : 'movie',  
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

            Log.info('Before filtering in normalizeData:', normalized.results.length, 'items');  
            
            if (Lampa.Storage.get('numparser_hide_watched')) {    
                // ✅ ПРАВИЛЬНО - асинхронный вызов с callback  
                basicFilterWatchedContent(normalized.results, function(filtered) {  
                    // Догружаем только если это НЕ внутренний запрос    
                    if (!isInternal && !isCategoryFull && filtered.length < 20 && normalized.total_pages > 1) {  
                    // if (!isInternal && filtered.length < 20 && normalized.total_pages > 1) {    
                        loadMoreUntilFullAsync(filtered, category, page, source, normalized.total_pages, function(results) {    
                            normalized.results = results;    
                            callback(normalized);    
                        });    
                    } else {    
                        normalized.results = filtered;    
                        callback(normalized);    
                    }  
                });  
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
            
            var url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  

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

            var hasMyShowsCredentials = Lampa.Storage.get('myshows_login', '') && Lampa.Storage.get('myshows_password', ''); 
            // Основные категории с проверкой видимости
            if (CATEGORY_VISIBILITY.myshows_unwatched.visible && hasMyShowsCredentials) {
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
                            // cardClass: window.MyShows.createMyShowsCard,
                            nomore: true
                        });
                    });
                });
            }

            if (CATEGORY_VISIBILITY.legends.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.legends, CATEGORY_VISIBILITY.legends.title, callback);
            });
            if (CATEGORY_VISIBILITY.episodes.visible) {  
                            var addEpisodes = Lampa.Manifest.app_digital >= 300
                                ? addEpisodesV3
                                : addEpisodesV2;

                            addEpisodes(partsData);
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

            function addEpisodesV2(partsData) {
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

            function addEpisodesV3(partsData) {
                partsData.push(function (callback) {  
                    var results = Lampa.TimeTable.lately().slice(0, 20);  
                    
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
                        title: CATEGORY_VISIBILITY.episodes.title,  
                        nomore: true  
                    });  
                });
            }

            function makeRequest(category, title, callback) {
                var page = 1;
                var url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  

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

        if (IS_LAMPAC) {
            var profileId = Lampa.Storage.get('lampac_profile_id', '');
        } else {
            var profileId = '';
            // Проверяем что аккаунт существует и имеет профиль
            if (Lampa.Account.Permit.account && Lampa.Account.Permit.account.profile && Lampa.Account.Permit.account.profile.id) {
                profileId = '_' + Lampa.Account.Permit.account.profile.id;
            }
        }
        return profileId;
    }

    function getProfileKey(baseKey) {
        Log.info('IS_LAMPAC:', IS_LAMPAC, 'baseKey: ', baseKey);
        var profileId = getProfileId();
        return baseKey + '_profile' + profileId;
    }

    function getProfileSetting(key, defaultValue) {
        return Lampa.Storage.get(getProfileKey(key), defaultValue);
    }

    function setProfileSetting(key, value) {
        Lampa.Storage.set(getProfileKey(key), value);
    }

    function hasProfileSetting(key) {
        var profileKey = getProfileKey(key);
        return window.localStorage.getItem(profileKey) !== null;
    }

    // Загружаем профильные настройки
    function loadNumparserProfileSettings() {

        if (!hasProfileSetting('numparser_hide_watched') && HAS_TIMECODE_USER) {
            setProfileSetting('numparser_hide_watched', "true");
        }

        if (!hasProfileSetting('numparser_min_progress')) {
            setProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS);
        }

        if (!hasProfileSetting('numparser_source_name')) {
            setProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME);
        }

        // Восстанавливаем значения в Lampa.Storage, чтобы UI знал актуальные данные
        if (HAS_TIMECODE_USER) {
            Lampa.Storage.set('numparser_hide_watched', getProfileSetting('numparser_hide_watched', "true"), "true");
        }
        Lampa.Storage.set('numparser_min_progress', getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS), "true");
        Lampa.Storage.set('numparser_source_name', getProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME), "true");
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

        // Добавляем переключатель фильтрации
        Log.info('TimecodeUser!', HAS_TIMECODE_USER, 'LAMPAC:', IS_LAMPAC);
        if (IS_LAMPAC && HAS_TIMECODE_USER) {
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
        };

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

        Object.keys(CATEGORY_VISIBILITY).forEach(function (option) {
            
            var settingName = 'numparser_settings_' + option + '_visible';
            var visible = getProfileSetting(settingName, "true");

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
                    var newVisible = value === true || value === "true";
                    CATEGORY_VISIBILITY[option].visible = newVisible;
                    setProfileSetting(settingName, newVisible);
                }
            });
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

        // === Обновляем настройки при смене профиля ===
        Lampa.Listener.follow('profile', function(e) {
            if (e.type === 'changed') {

                loadNumparserProfileSettings();

                // Если панель настроек открыта — обновим значения
                setTimeout(function() {
                    var settingsPanel = document.querySelector('[data-component="numparser_settings"]');
                    if (settingsPanel) {
                        var hideWatched = settingsPanel.querySelector('select[data-name="numparser_hide_watched"]');
                        if (hideWatched) hideWatched.value = getProfileSetting('numparser_hide_watched', "true");

                        var minProgress = settingsPanel.querySelector('select[data-name="numparser_min_progress"]');
                        if (minProgress) minProgress.value = getProfileSetting('numparser_min_progress', DEFAULT_MIN_PROGRESS).toString();

                        var sourceName = settingsPanel.querySelector('input[data-name="numparser_source_name"]');
                        if (sourceName) sourceName.value = getProfileSetting('numparser_source_name', DEFAULT_SOURCE_NAME);
                    }
                }, 100);
            }
        });
    }

    var lastKnownProfileId = '';

    Lampa.Listener.follow('profile', function(e) {
        Log.info('Profile Change - Type:', e.type);
        
        if (e.type === 'changed') {
            var newProfileId = getProfileId();
            
            // ✅ Проверяем, действительно ли профиль изменился
            if (newProfileId !== lastKnownProfileId) {
                Log.info('🔀 Смена профиля:', lastKnownProfileId, '->', newProfileId);
                
                // Сбрасываем кэш
                globalTimecodes = null;
                timecodesLoading = false;
                timecodesCallbacks = [];
                
                // Обновляем последний известный профиль
                lastKnownProfileId = newProfileId;
                
            } else {
                Log.info('⚠️ Профиль не изменился');
            }
        }
    });

    // Проверка Lampac или Lampa и наличие TimecodeUser
    function checkEnvironment(path, callback) {
        
        // Проверка через /version
        var xhr = new XMLHttpRequest();
        xhr.open('GET', path, true);
        
        xhr.onload = function() {
            callback(xhr.status === 200);
        };
        
        xhr.onerror = function() {
            callback(false);
        };
        
        xhr.send();
    }

    function initNUMPlugin() {
        startPlugin();
        // Сначала проверяем среду
        checkEnvironment('/version', function(isLampac) {
            IS_LAMPAC = isLampac;
            Log.info('✅ Среда:', IS_LAMPAC ? 'Lampac' : 'Обычная Lampa');
            
            // Затем проверяем TimecodeUser
            checkEnvironment('/timecode/all_views', function(hasTimecodeUser) {
                HAS_TIMECODE_USER = hasTimecodeUser;
                Log.info('✅ TimecodeUser:', HAS_TIMECODE_USER ? 'Доступен' : 'Не доступен');

                lastKnownProfileId = getProfileId();
                Log.info('Начальный профиль:', lastKnownProfileId);
                
                // ✅ Инициализируем плагин
                setTimeout(function() {
                    initSettings();
                    loadNumparserProfileSettings();
                }, 50);
            });
        });
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