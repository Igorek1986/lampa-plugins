(function () {  
    'use strict';  

    var DEFAULT_ADD_THRESHOLD = '0';  
    var DEFAULT_MIN_PROGRESS = 90;  
    var API_URL = 'https://api.myshows.me/v2/rpc/';  
    var isInitialized = false;  
    var MAP_KEY = 'myshows_hash_map';  
    var PROXY_URL = 'https://numparser.igorek1986.ru/myshows/auth';  
    var DEFAULT_CACHE_DAYS = 30;
    var JSON_HEADERS = {  
        'Content-Type': 'application/json'  
    };


    function accountUrl(url) {  
        url = url + '';  
        if (url.indexOf('uid=') == -1) {  
            var uid = Lampa.Storage.get('lampac_unic_id', '');  
            if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));  
        }  
        return url;  
    }  
    
    // Сохранение кеша с использованием профилей  
    function saveCacheToServer(cacheData, callback) {  
        try {  
            var data = JSON.stringify(cacheData, null, 2);  
            var profileId = Lampa.Storage.get('lampac_profile_id', 'default');  
            var uri = accountUrl('/storage/set?path=myshows&pathfile=' + profileId);  
            
            var network = new Lampa.Reguest();  
            network.native(uri, function(response) {  
                if (response.success) {  
                    console.log('[MyShows] Cache saved to server:', response.fileInfo.path);  
                    // Сохраняем время изменения для проверки актуальности  
                    Lampa.Storage.set('lampac_myshows_cache', response.fileInfo.changeTime);  
                    if (callback) callback(true);  
                } else {  
                    console.error('[MyShows] Cache save failed:', response.msg);  
                    if (callback) callback(false);  
                }  
            }, function(error) {  
                console.error('[MyShows] Cache save error:', error);  
                if (callback) callback(false);  
            }, data, {  
                headers: { 'Content-Type': 'application/json' },  
                method: 'POST'  
            });  
        } catch(e) {  
            console.error('[MyShows] Cache preparation error:', e);  
            if (callback) callback(false);  
        }  
    }  
  
    // Загрузка кеша 
    function loadCacheFromServer(callback) {      
        console.log('[MyShows] loadCacheFromServer function called'); 
        var profileId = Lampa.Storage.get('lampac_profile_id', 'default');      
        var uri = accountUrl('/storage/get?path=myshows&pathfile=' + profileId);      
            
        var network = new Lampa.Reguest();      
        network.silent(uri, function(response) {      
            if (response.success && response.fileInfo && response.data) {      
                var lastChangeTime = Lampa.Storage.get('lampac_myshows_cache', '0');      
                if (response.fileInfo.changeTime > lastChangeTime) {      
                    // Файл изменился - используем новый кеш    
                    console.log('[MyShows] Loading NEW cache from server (file changed)');  
                    var cacheData = JSON.parse(response.data);      
                    Lampa.Storage.set('lampac_myshows_cache', response.fileInfo.changeTime);      
                    callback({ shows: cacheData.shows });      
                    return;      
                } else {    
                    // Файл не изменился - используем существующий кеш    
                    console.log('[MyShows] Loading EXISTING cache from server (file unchanged)');  
                    var cacheData = JSON.parse(response.data);    
                    callback({ shows: cacheData.shows });    
                    return;    
                }    
            } else if (response.msg && response.msg == 'outFile') {    
                // Файл не существует - это первый запуск    
                console.log('[MyShows] No cache file exists yet');    
            } else {  
                console.log('[MyShows] Cache response invalid:', response);  
            }  
            callback(null);       
        }, function(error) {      
            console.log('[MyShows] Cache load error:', error);      
            callback(null);      
        });      
    }

    function createJSONRPCRequest(method, params, id) {  
        return JSON.stringify({  
            jsonrpc: '2.0',  
            method: method,  
            params: params || {},  
            id: id || 1  
        });  
    }

    // Функция авторизации через прокси  
    function tryAuthFromSettings(successCallback) {        
        var login = getProfileSetting('myshows_login', '');        
        var password = getProfileSetting('myshows_password', '');        
            
        if (!login || !password) {        
            if (!successCallback) Lampa.Noty.show('Enter login and password');      
            if (successCallback) successCallback(null);    
            return;        
        }    
            
        var network = new Lampa.Reguest();    
            
        network.native(PROXY_URL, function(data) {    
            if (data && data.token) {    
                setProfileSetting('myshows_token', data.token);    
                Lampa.Storage.set('myshows_token', data.token, true);    

                if (Lampa.Settings && Lampa.Settings.update) {          
                    try {      
                    Lampa.Settings.update();          
                    } catch (error) {}      
                }   
                    
                if (successCallback) {    
                    successCallback(data.token);    
                } else {    
                    Lampa.Noty.show('Auth success!');    
                }    
            } else {    
                if (successCallback) {    
                    successCallback(null);    
                } else {    
                    Lampa.Noty.show('Auth failed: no token received');    
                }    
            }    
        }, function(xhr) {    
            if (successCallback) {    
                successCallback(null);    
            } else {    
                Lampa.Noty.show('Auth error: ' + xhr.status);    
            }    
        }, JSON.stringify({    
            login: login,    
            password: password    
        }), {    
            headers: JSON_HEADERS,    
            dataType: 'json'    
        });    
    }  
  
    // Функция для выполнения запросов с автоматическим обновлением токена    
    function makeAuthenticatedRequest(url, options, callback, errorCallback) {    
        var token = getProfileSetting('myshows_token', '');    
            
        if (!token) {    
            console.error('makeAuthenticatedRequest: No token available');    
            if (errorCallback) errorCallback(new Error('No token available'));    
            return;    
        }    
            
        var network = new Lampa.Reguest();    
            
        options.headers = options.headers || {};    
        options.headers['Authorization'] = 'Bearer ' + token;    
            
        network.silent(url, function(data) {    
            // Проверяем JSON-RPC ошибки    
            if (data && data.error && data.error.code === 401) {    
                tryAuthFromSettings(function(newToken) {    
                    if (newToken) {    
                        options.headers['Authorization'] = 'Bearer ' + newToken;    
                            
                        var retryNetwork = new Lampa.Reguest();    
                        retryNetwork.silent(url, function(retryData) {    
                            if (callback) callback(retryData);    
                        }, function(retryXhr) {    
                            if (errorCallback) errorCallback(new Error('HTTP ' + retryXhr.status));    
                        }, options.body, {    
                            headers: options.headers    
                        });    
                    } else {    
                        if (errorCallback) errorCallback(new Error('Failed to refresh token'));    
                    }    
                });    
            } else {    
                if (callback) callback(data);    
            }    
        }, function(xhr) {    
            if (xhr.status === 401) {    
                tryAuthFromSettings(function(newToken) {    
                    if (newToken) {    
                        options.headers['Authorization'] = 'Bearer ' + newToken;    
                            
                        var retryNetwork = new Lampa.Reguest();    
                        retryNetwork.silent(url, function(retryData) {    
                            if (callback) callback(retryData);    
                        }, function(retryXhr) {    
                            if (errorCallback) errorCallback(new Error('HTTP ' + retryXhr.status));    
                        }, options.body, {    
                            headers: options.headers    
                        });    
                    } else {    
                        if (errorCallback) errorCallback(new Error('Failed to refresh token'));    
                    }    
                });    
            } else {    
                if (errorCallback) errorCallback(new Error('HTTP ' + xhr.status));    
            }    
        }, options.body, {    
            headers: options.headers    
        });    
    }  
  
    // Функции для работы с профиль-специфичными настройками  
    function getProfileKey(baseKey) {  
        var profileId = Lampa.Storage.get('lampac_profile_id', 'default');  
        return baseKey + '_profile' + profileId;  
    }  
  
    function getProfileSetting(key, defaultValue) {  
        return Lampa.Storage.get(getProfileKey(key), defaultValue);  
    }  
  
    function setProfileSetting(key, value) {  
        Lampa.Storage.set(getProfileKey(key), value);  
    }  
    
    function loadProfileSettings() {  
        if (!hasProfileSetting('myshows_view_in_main')) {      
            setProfileSetting('myshows_view_in_main', true);      
        }    

        if (!hasProfileSetting('myshows_sort_order')) {    
            setProfileSetting('myshows_sort_order', 'alphabet');    
        }  

        if (!hasProfileSetting('myshows_add_threshold')) {      
            setProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD);      
        }    

        if (!hasProfileSetting('myshows_min_progress')) {    
            setProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS);    
        }    
            
        if (!hasProfileSetting('myshows_token')) {    
            setProfileSetting('myshows_token', '');    
        }    

        if (!hasProfileSetting('myshows_login')) {    
            setProfileSetting('myshows_login', '');    
        }  

        if (!hasProfileSetting('myshows_password')) {  
            setProfileSetting('myshows_password', '');  
        }  

        if (!hasProfileSetting('myshows_cache_days')) {  
            setProfileSetting('myshows_cache_days', DEFAULT_CACHE_DAYS);  
        }  
            
        var myshowsViewInMain = getProfileSetting('myshows_view_in_main', true); 
        var sortOrderValue = getProfileSetting('myshows_sort_order', 'alphabet');  
        var addThresholdValue = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString());  
        var progressValue = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();    
        var tokenValue = getProfileSetting('myshows_token', '');    
        var loginValue = getProfileSetting('myshows_login', '');  
        var passwordValue = getProfileSetting('myshows_password', '');   
        var cacheDaysValue = getProfileSetting('myshows_cache_days', DEFAULT_CACHE_DAYS); 

            
        Lampa.Storage.set('myshows_view_in_main', myshowsViewInMain, true);  
        Lampa.Storage.set('myshows_sort_order', sortOrderValue, true);
        Lampa.Storage.set('myshows_add_threshold', addThresholdValue, true);  
        Lampa.Storage.set('myshows_min_progress', progressValue, true);    
        Lampa.Storage.set('myshows_token', tokenValue, true);    
        Lampa.Storage.set('myshows_login', loginValue, true);  
        Lampa.Storage.set('myshows_password', passwordValue, true);  
        Lampa.Storage.set('myshows_cache_days', cacheDaysValue, true);  
    }    
      
    function hasProfileSetting(key) {    
        var profileKey = getProfileKey(key);    
        return window.localStorage.getItem(profileKey) !== null;    
    }  
  
    // Инициализация компонента настроек  
    function initSettings() {  
        if (isInitialized) {    
            loadProfileSettings();  
            autoSetupToken();

            return;    
        }   

        try {  
            if (Lampa.SettingsApi.remove) {  
            Lampa.SettingsApi.remove('myshows');  
            }  
        } catch (e) {}  

        Lampa.SettingsApi.addComponent({  
            component: 'myshows',  
            name: 'MyShows',  
            icon: '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/></svg>'  
        });  

        isInitialized = true;    
        loadProfileSettings();    
        autoSetupToken();

        Lampa.SettingsApi.addParam({  
            component: 'myshows',  
            param: {  
                name: 'myshows_view_in_main',  
                type: 'trigger',  
                default: getProfileSetting('myshows_view_in_main', true)  
            },  
            field: {  
                name: 'Показывать на главной странице',  
                description: 'Отображать непросмотренные сериалы на главной странице'  
            },  
            onChange: function(value) {  
                setProfileSetting('myshows_view_in_main', value);  
            }  
        });

        Lampa.SettingsApi.addParam({    
            component: 'myshows',    
            param: {    
                name: 'myshows_sort_order',    
                type: 'select',    
                values: {    
                    'alphabet': 'По алфавиту',    
                    'progress': 'По прогрессу',    
                    'unwatched_count': 'По количеству непросмотренных'  
                },    
                default: 'alphabet'    
            },    
            field: {    
                name: 'Сортировка сериалов',    
                description: 'Порядок отображения сериалов на главной странице'    
            },    
            onChange: function(value) {    
                setProfileSetting('myshows_sort_order', value);    
            }    
        });

        // Настройки плагина  
        Lampa.SettingsApi.addParam({    
            component: 'myshows',    
            param: {    
            name: 'myshows_add_threshold',    
            type: 'select',    
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
                '50': 'После 50% просмотра'    
            },    
            default: getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString()   
            },    
            field: {    
            name: 'Порог добавления сериала',    
            description: 'Когда добавлять сериал в список "Смотрю" на MyShows'    
            },    
            onChange: function(value) {    
            setProfileSetting('myshows_add_threshold', parseInt(value));    
            }    
        });  

        Lampa.SettingsApi.addParam({  
            component: 'myshows',  
            param: {  
            name: 'myshows_min_progress',  
            type: 'select',  
            values: {  
                '50': '50%',  
                '60': '60%',  
                '70': '70%',  
                '80': '80%',  
                '85': '85%',  
                '90': '90%',  
                '95': '95%',  
                '100': '100%'  
            },  
            default: getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString()  
            },  
            field: {  
            name: 'Порог просмотра',  
            description: 'Минимальный процент просмотра для отметки эпизода на myshows.me'  
            },  
            onChange: function(value) {  
            setProfileSetting('myshows_min_progress', parseInt(value));  
            }  
        }); 
        
        Lampa.SettingsApi.addParam({  
            component: 'myshows',  
            param: {  
                name: 'myshows_cache_days',  
                type: 'select',  
                values: {  
                    '7': '7 дней',  
                    '14': '14 дней',  
                    '30': '30 дней',  
                    '60': '60 дней',  
                    '90': '90 дней'  
                },  
                default: DEFAULT_CACHE_DAYS.toString()    
            },  
            field: {  
                name: 'Время жизни кеша',  
                description: 'Через сколько дней очищать кеш маппинга эпизодов'  
            },  
            onChange: function(value) {  
                setProfileSetting('myshows_cache_days', parseInt(value));  
            }  
        });

        Lampa.SettingsApi.addParam({  
            component: 'myshows',  
            param: {  
            name: 'myshows_login',  
            type: 'input',  
            placeholder: 'Логин MyShows',  
            values: getProfileSetting('myshows_login', ''),  
            default: ''  
            },  
            field: {  
            name: 'MyShows Логин',  
            description: 'Введите логин или email, привязанный к аккаунту myshows.me'  
            },  
            onChange: function(value) {  
            setProfileSetting('myshows_login', value);  
            }  
        });  

        Lampa.SettingsApi.addParam({  
            component: 'myshows',  
            param: {  
            name: 'myshows_password',  
            type: 'input',  
            placeholder: 'Пароль',  
            values: getProfileSetting('myshows_password', ''),  
            default: '',  
            password: true  
            },  
            field: {  
            name: 'MyShows Пароль',  
            description: 'Введите пароль от аккаунта myshows.me'  
            },  
            onChange: function(value) {  
            setProfileSetting('myshows_password', value);  
            tryAuthFromSettings();  
            }  
        });  
    }  

    // Обновляем UI при смене профиля
    Lampa.Listener.follow('profile', function(e) {
        if (e.type === 'changed') {
            // Пересоздаем настройки для нового профиля
            initSettings();
            
            // Обновляем значения в UI, если настройки открыты
            setTimeout(function() {
            var settingsPanel = document.querySelector('[data-component="myshows"]');
            if (settingsPanel) {
                // Обновляем значения полей
                var myshowsViewInMain = settingsPanel.querySelector('select[data-name="myshows_view_in_main"]');  
                if (myshowsViewInMain) myshowsViewInMain.value = getProfileSetting('myshows_view_in_main', true);

                var sortSelect = settingsPanel.querySelector('select[data-name="myshows_sort_order"]');  
                if (sortSelect) sortSelect.value = getProfileSetting('myshows_sort_order', 'alphabet');

                var addThresholdSelect = settingsPanel.querySelector('select[data-name="myshows_add_threshold"]');  
                if (addThresholdSelect) addThresholdSelect.value = getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString();

                var tokenInput = settingsPanel.querySelector('input[data-name="myshows_token"]');
                if (tokenInput) tokenInput.value = getProfileSetting('myshows_token', '');
                
                var progressSelect = settingsPanel.querySelector('select[data-name="myshows_min_progress"]');
                if (progressSelect) progressSelect.value = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();

                var daysSelect = settingsPanel.querySelector('select[data-name="myshows_cache_days"]');
                if (daysSelect) daysSelect.value = getProfileSetting('myshows_cache_days', DEFAULT_CACHE_DAYS).toString();

                var loginInput = settingsPanel.querySelector('input[data-name="myshows_login"]');
                if (loginInput) loginInput.value = getProfileSetting('myshows_login', '');

                var passwordInput = settingsPanel.querySelector('input[data-name="myshows_password"]');
                if (passwordInput) passwordInput.value = getProfileSetting('myshows_password', '');
            }
            }, 100);
        }
    });
  
    // Получить showId по imdbId или kinopoiskId
    function getShowIdByExternalIds(imdbId, kinopoiskId, token, callback) {
        // Внутренняя функция для выполнения запроса
        function trySource(source, id, cb) {
            makeAuthenticatedRequest(API_URL, {
                method: 'POST',
                headers: JSON_HEADERS,
                body: createJSONRPCRequest('shows.GetByExternalId', { id: id, source: source })
            }, function(data) {
                cb(data && data.result ? data.result.id : null);
            }, function() {
                cb(null);
            });
        }

        if (imdbId) {
            var cleanImdbId = imdbId.indexOf('tt') === 0 ? imdbId.slice(2) : imdbId;
            
            trySource('imdb', cleanImdbId, function(result) {
                if (result) {
                    callback(result);
                } else if (kinopoiskId) {
                    trySource('kinopoisk', kinopoiskId, callback);
                } else {
                    callback(null);
                }
            });
        }
        else if (kinopoiskId) {
            trySource('kinopoisk', kinopoiskId, callback);
        }
        else {
            callback(null);
        }
    }

    // Получить список эпизодов по showId
    function getEpisodesByShowId(showId, token, callback) {      
        makeAuthenticatedRequest(API_URL, {      
            method: 'POST',      
            headers: JSON_HEADERS,  
            body: createJSONRPCRequest('shows.GetById', { showId: showId, withEpisodes: true })        
        }, function(data) {      
            if(data && data.result && data.result.episodes) {      
                callback(data.result.episodes);      
            } else {      
                callback([]);      
            }      
        }, function(err) {      
            callback([]);      
        });      
    }  
  
    // Построить mapping hash -> episodeId  
    function buildHashMap(episodes, originalName) {  
        var map = {};  
        for(var i=0; i<episodes.length; i++){  
            var ep = episodes[i];  
            // Формируем hash как в Lampa: season_number + episode_number + original_name  
            var hashStr = '' + ep.seasonNumber + ep.episodeNumber + originalName;  
            var hash = Lampa.Utils.hash(hashStr);  
            map[hash] = {  
                episodeId: ep.id,  
                originalName: originalName,  
                timestamp: Date.now()  
            };
        }  
        return map;  
    }  
  
    // Автоматически получить mapping для текущего сериала (по imdbId или kinopoiskId из карточки)  
    function ensureHashMap(card, token, callback) {
        var imdbId = card && (card.imdb_id || card.imdbId || (card.ids && card.ids.imdb));
        var kinopoiskId = card && (card.kinopoisk_id || card.kp_id || (card.ids && card.ids.kp));
        var originalName = card && (card.original_name || card.original_title || card.title);
        
        if ((!imdbId && !kinopoiskId) || !originalName) {
            callback({});
            return;
        }

        var map = Lampa.Storage.get(MAP_KEY, {});
        // Проверяем существующий mapping
        for (var h in map) {
            if (map.hasOwnProperty(h) && map[h] && map[h].originalName === originalName) {
                callback(map);
                return;
            }
        }

        // Получаем showId с учетом обоих идентификаторов
        getShowIdByExternalIds(imdbId, kinopoiskId, token, function(showId) {
            if (!showId) {
                callback({});
                return;
            }
            
            getEpisodesByShowId(showId, token, function(episodes) {
                var newMap = buildHashMap(episodes, originalName);
                // Сохраняем mapping
                for (var k in newMap) {
                    if (newMap.hasOwnProperty(k)) {
                        map[k] = newMap[k];
                    }
                }
                Lampa.Storage.set(MAP_KEY, map);
                callback(map);
            });
        });
    }
  
    // Отметить эпизод на myshows  
    function checkEpisodeMyShows(episodeId, token) {        
        if (!episodeId || !token) return;        
            
        makeAuthenticatedRequest(API_URL, {        
            method: 'POST',        
            headers: JSON_HEADERS,  
            body: createJSONRPCRequest('manage.CheckEpisode', { id: episodeId, rating: 0 })             
        }, function(data) {      
            if (data && data.error) {        
                Lampa.Noty.show('Ошибка при отметке эпизода: ' + (data.error.message || 'Неизвестная ошибка'));      
            }      
        }, function(err) {      
            console.error('MyShows API error:', err);      
        });      
    }  
  
    // Добавить сериал в "Смотрю" на MyShows  
    function addShowToWatching(card, token) {    
        var imdbId = card.imdb_id || card.imdbId || (card.ids && card.ids.imdb);
        var kinopoiskId = card && (card.kinopoisk_id || card.kp_id || (card.ids && card.ids.kp));
            getShowIdByExternalIds(imdbId, kinopoiskId, token, function(showId) {          
                if (!showId) return;
                        
                makeAuthenticatedRequest(API_URL, {          
                    method: 'POST',          
                    headers: JSON_HEADERS,   
                    body: createJSONRPCRequest('manage.SetShowStatus', { id: showId, status: "watching" })              
                });          
            });  
    }  
  
    // Универсальный поиск карточки сериала  
    function getCurrentCard() {  
        var card = (Lampa.Activity && Lampa.Activity.active && Lampa.Activity.active() && (  
            Lampa.Activity.active().card_data ||  
            Lampa.Activity.active().card ||  
            Lampa.Activity.active().movie  
        )) || null;  
        // if (!card) card = getProfileSetting('myshows_last_card', null);  
        if (!card) card = Lampa.Storage.get('myshows_last_card', null);  
        return card;  
    }  
  
    // обработка Timeline обновлений
    function processTimelineUpdate(data) {    
        if (!data || !data.data || !data.data.hash || !data.data.road) {    
            return;    
        }    
    
        var hash = data.data.hash;    
        var percent = data.data.road.percent;    
        var token = getProfileSetting('myshows_token', '');    
        var minProgress = parseInt(getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS));    
        var addThreshold = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD));    
            
        if (!token) {    
            return;    
        }    
    
        var card = getCurrentCard();    
        if (!card) return;    
    
        ensureHashMap(card, token, function(map) {    
            var episodeId = map[hash] && map[hash].episodeId ? map[hash].episodeId : map[hash];   
            
            // Если hash не найден в mapping - принудительно обновляем  
            if (!episodeId) {  
                // Очищаем кеш для этого сериала  
                var originalName = card.original_name || card.original_title || card.title;  
                var fullMap = Lampa.Storage.get(MAP_KEY, {});  
                // Удаляем все записи для этого сериала  
                for (var h in fullMap) {  
                    if (fullMap.hasOwnProperty(h) && fullMap[h] && fullMap[h].originalName === originalName) {  
                        delete fullMap[h];  
                    }  
                }  
                Lampa.Storage.set(MAP_KEY, fullMap);  
                
                // Повторно запрашиваем mapping  
                ensureHashMap(card, token, function(newMap) {  
                    var newEpisodeId = newMap[hash] && newMap[hash].episodeId ? newMap[hash].episodeId : newMap[hash];  
                    if (newEpisodeId) {  
                        processEpisode(newEpisodeId, hash, percent, card, token, minProgress, addThreshold);  
                    }  
                });  
                return;  
            }  
            
            processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold);  
        });    
    }  

    function processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold) {    
        
        var originalName = card.original_name || card.original_title || card.title;      
        var firstEpisodeHash = Lampa.Utils.hash('11' + originalName);     
        
        Lampa.Storage.set('myshows_was_watching', true); 
        
        // Проверяем, нужно ли добавить сериал в "Смотрю"  
        if (hash === firstEpisodeHash && percent >= addThreshold) {    
            addShowToWatching(card, token);    
            
            // Обновляем кеш только если НЕ достигнут minProgress    
            if (percent < minProgress) {    
                setTimeout(function() {    
                    console.log('[MyShows] Force refreshing cache after adding show to watching');    
                    getUnwatchedShowsWithDetails(function(result) {    
                        console.log('[MyShows] Cache updated after adding show');    
                    }, true);    
                }, 1000);    
            }    
        } else if (addThreshold === 0 && hash === firstEpisodeHash) {    
            addShowToWatching(card, token);    
            
            // Обновляем кеш только если НЕ достигнут minProgress    
            if (percent < minProgress) {    
                setTimeout(function() {    
                    console.log('[MyShows] Force refreshing cache after adding show to watching (threshold 0)');    
                    getUnwatchedShowsWithDetails(function(result) {    
                        console.log('[MyShows] Cache updated after adding show');    
                    }, true);    
                }, 1000);    
            }  
        }   
    
        // Отмечаем серию как просмотренную только если достигнут minProgress      
        if (percent >= minProgress) {      
            checkEpisodeMyShows(episodeId, token);    
            setTimeout(function() {   
                console.log('[MyShows] About to call getUnwatchedShowsWithDetails with forceRefresh = true');
                getUnwatchedShowsWithDetails(function(result) {   
                    console.log('MyShows: Unwatched shows with details:', result);  
                }, true);  
            }, 1000);   
        }      
    }
  
    // Инициализация Timeline listener  
    function initTimelineListener() {  
        if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) {  
            Lampa.Timeline.listener.follow('update', processTimelineUpdate);  
        }  
    }  

    function autoSetupToken() {  
        var token = getProfileSetting('myshows_token', '');  
        
        if (token && token.length > 0) {  
            return; 
        }  
        
        var login = getProfileSetting('myshows_login', '');  
        var password = getProfileSetting('myshows_password', '');  
        
        if (login && password) {  
            tryAuthFromSettings();
        }  
    }  

    // Переодическая очистка MAP_KEY
    function cleanupOldMappings() {      
        var map = Lampa.Storage.get(MAP_KEY, {});      
        var now = Date.now();      
        var days = parseInt(getProfileSetting('myshows_cache_days', DEFAULT_CACHE_DAYS));    
        var maxAge = days * 24 * 60 * 60 * 1000;    
            
        var cleaned = {};      
        var removedCount = 0;      
            
        for (var hash in map) {      
            if (map.hasOwnProperty(hash)) {        
                var item = map[hash];        
                
                // Только записи с timestamp и в пределах maxAge  
                if (item && item.timestamp && typeof item.timestamp === 'number' && (now - item.timestamp) < maxAge) {        
                    cleaned[hash] = item;        
                } else {        
                    removedCount++;        
                }        
            }   
        }      
        
        if (removedCount > 0) {      
            Lampa.Storage.set(MAP_KEY, cleaned);      
            console.log('MyShows: Cleaned', removedCount, 'old mapping entries (including legacy format)');      
        }      
    }

    function fetchFromMyShowsAPI(callback) {  
        console.log('[MyShows] Fetching unwatched shows from MyShows API...');
        makeAuthenticatedRequest(API_URL, {  
            method: 'POST',  
            headers: JSON_HEADERS,  
            body: createJSONRPCRequest('lists.Episodes', { list: 'unwatched' })  
        }, function(response) {  
            if (!response || !response.result) {  
                callback({ error: response ? response.error : 'Empty response' });  
                return;  
            }  
    
            // Группируем эпизоды по сериалам и подсчитываем количество  
            var showsData = {};  
            var shows = [];  
            
            for (var i = 0; i < response.result.length; i++) {  
                var item = response.result[i];  
                if (item.show) {  
                    var showId = item.show.id;  
                    
                    if (!showsData[showId]) {  
                        showsData[showId] = {  
                            show: item.show,  
                            unwatchedCount: 0,  
                            episodes: []  
                        };  
                    }  
                    
                    showsData[showId].unwatchedCount++;  
                    showsData[showId].episodes.push(item.episode);  
                }  
            }  
            
            // Преобразуем в массив для отображения  
            for (var showId in showsData) {  
                var showData = showsData[showId];  
                shows.push({  
                    myshowsId: showData.show.id,  
                    title: showData.show.title,  
                    originalTitle: showData.show.titleOriginal,  
                    year: showData.show.year,  
                    unwatchedCount: showData.unwatchedCount,  
                    unwatchedEpisodes: showData.episodes  
                });  
            }  
            
            console.log('[MyShows] Found', shows.length, 'unique shows with unwatched episodes:');  
            shows.forEach(function(show) {  
                console.log('[MyShows]', show.title, '- осталось серий:', show.unwatchedCount);  
            });  
            
            // Сразу переходим к поиску в TMDB  
            getTMDBDetails(shows, function(result) {  
                if (result && result.shows) {  
                    // Сохраняем в серверный кеш  
                    var cacheData = {  
                        shows: result.shows,  
                    };  
                    saveCacheToServer(cacheData);  
                }  
                callback(result);  
            });  
        }, function(error) {  
            callback({ error: error });  
        });  
    }  

    function getUnwatchedShowsWithDetails(callback, forceRefresh) {    
        console.log('[MyShows] getUnwatchedShowsWithDetails called with forceRefresh:', forceRefresh);  
        if (typeof forceRefresh === 'undefined') {    
            forceRefresh = false;    
        }    
    
        var token = getProfileSetting('myshows_token', '');    
        if (!token) {    
            callback({ error: 'Not authorized' });    
            return;    
        }    
    
        console.log('[MyShows] forceRefresh after check:', forceRefresh);  
    
        if (forceRefresh) {    
            console.log('[MyShows] Taking forceRefresh path - calling fetchFromMyShowsAPI');    
            fetchFromMyShowsAPI(callback);    
        } else {    
            // Логика с кешем    
            loadCacheFromServer(function(cachedResult) {    
                if (cachedResult) {      
                    // Добавляем предварительную подготовку маркеров для кешированных данных  
                    if (cachedResult && cachedResult.shows) {    
                        cachedResult.shows.forEach(function(show) {    
                            if (show.progress_marker) {    
                                show._prebuiltMarker = '<div class="card__marker card__marker--progress"><span>' +     
                                                    show.progress_marker + '</span></div>';    
                            }    
                        });    
                    }  
                    
                    callback(cachedResult);
                    
                    // Запускаем отложенную проверку только один раз при загрузке  
                    setTimeout(function() {  
                        console.log('[MyShows] Starting delayed background check');  
                        fetchFromMyShowsAPI(function(freshResult) {  
                            if (freshResult && freshResult.shows && cachedResult.shows) {  
                                updateUIIfNeeded(cachedResult.shows, freshResult.shows);  
                            }  
                        });  
                    }, 5000);  
                    
                    return;    
                }    
                fetchFromMyShowsAPI(callback);    
            });    
        }  
    }

    function updateUIIfNeeded(oldShows, newShows) {  
        // Создаем карты для быстрого поиска  
        var oldShowsMap = {};  
        var newShowsMap = {};  
        
        oldShows.forEach(function(show) {  
            var key = show.original_name || show.name || show.title;  
            oldShowsMap[key] = show;  
        });  
        
        newShows.forEach(function(show) {  
            var key = show.original_name || show.name || show.title;  
            newShowsMap[key] = show;  
        });  
        
        // Добавляем новые сериалы  
        for (var newKey in newShowsMap) {  
            if (!oldShowsMap[newKey]) {  
                console.log('[MyShows] Adding new show:', newKey);  
                insertNewCardIntoMyShowsSection(newShowsMap[newKey]);  
            }  
        }  
        
        // Удаляем завершенные сериалы  
        for (var oldKey in oldShowsMap) {  
            if (!newShowsMap[oldKey]) {  
                console.log('[MyShows] Removing completed show:', oldKey);  
                updateCompletedShowCard(oldKey);  
            }  
        }  
        
        // Обновляем прогресс существующих сериалов  
        for (var key in newShowsMap) {  
            if (oldShowsMap[key]) {  
                var oldShow = oldShowsMap[key];  
                var newShow = newShowsMap[key];  
                
                if (oldShow.progress_marker !== newShow.progress_marker) {  
                    console.log('[MyShows] Updating show progress:', key);  
                    window.MyShows.updateAllMyShowsCards(key, newShow.progress_marker);  
                }  
            }  
        }  
    }

    function enrichShowData(fullResponse, myshowsData) {    
        // Используем полные данные TMDB как основу  
        var enriched = Object.assign({}, fullResponse);    
        console.log('[SerialStatus] fullResponse', fullResponse);  
        console.log('[SerialStatus] myshowsData', myshowsData);  
        
        // Добавляем данные MyShows  
        if (myshowsData) {  
            enriched.progress_marker = myshowsData.progress_marker;  
            enriched.watched_count = myshowsData.watched_count;  
            enriched.total_count = myshowsData.total_count;  
            enriched.released_count = myshowsData.released_count;  
        }  
        
        // Даты (теперь из полных данных TMDB)  
        enriched.create_date = fullResponse.first_air_date || '';    
        enriched.last_air_date = fullResponse.last_air_date || '';    
        enriched.release_date = fullResponse.first_air_date || '';    
        
        // Метаданные (из полных данных TMDB)  
        enriched.number_of_seasons = fullResponse.number_of_seasons || 0;    
        enriched.original_title = fullResponse.original_name || fullResponse.name || '';    
        enriched.seasons = fullResponse.seasons || null;    
        
        // Системные поля    
        enriched.source = 'MyShows';    
        enriched.status = fullResponse.status;    
        enriched.still_path = '';    
        enriched.update_date = new Date().toISOString();    
        enriched.video = false;    
        
        return enriched;    
    }

    function getTMDBDetails(shows, callback) {  
        if (shows.length === 0) {  
            callback({ shows: [] });  
            return;  
        }  
        
        var status = new Lampa.Status(shows.length);  

        status.onComplite = function(data) {    
            var matchedShows = [];    

            for (var key in data) {    
                if (data[key]) {    
                    matchedShows.push(data[key])
                }    
            }  
            
            var sortOrder = getProfileSetting('myshows_sort_order', 'alphabet');  
            console.log('[MyShows] Sorting by:', sortOrder);  
            
            
            switch(sortOrder) {  
                case 'alphabet':  
                    matchedShows.sort(function(a, b) {  
                        var nameA = (a.name || a.title || '').toLowerCase();  
                        var nameB = (b.name || b.title || '').toLowerCase();  
                        return nameA.localeCompare(nameB, 'ru');  
                    });  
                    break;  
                    
                case 'progress':  
                    matchedShows.sort(function(a, b) {  
                        var progressA = (a.watched_count || 0) / (a.total_count || 1);  
                        var progressB = (b.watched_count || 0) / (b.total_count || 1);  
                        
                        // Сортируем по проценту просмотра (больше процент - выше)  
                        if (progressB !== progressA) {  
                            return progressB - progressA;  
                        }  
                        
                        // При равном проценте - по количеству просмотренных серий  
                        return (b.watched_count || 0) - (a.watched_count || 0);  
                    });  
                    break;  
                    
                case 'unwatched_count':  
                    matchedShows.sort(function(a, b) {  
                        var unwatchedA = (a.total_count || 0) - (a.watched_count || 0);  
                        var unwatchedB = (b.total_count || 0) - (b.watched_count || 0);  
                        
                        // Сортируем по количеству непросмотренных (меньше непросмотренных - выше)  
                        if (unwatchedA !== unwatchedB) {  
                            return unwatchedA - unwatchedB;  
                        }  
                        
                        // При равном количестве - по алфавиту  
                        var nameA = (a.name || a.title || '').toLowerCase();  
                        var nameB = (b.name || b.title || '').toLowerCase();  
                        return nameA.localeCompare(nameB, 'ru');  
                    });  
                    break;  
                    
                default:  
                    // Fallback к алфавитной сортировке  
                    matchedShows.sort(function(a, b) {  
                        var nameA = (a.name || a.title || '').toLowerCase();  
                        var nameB = (b.name || b.title || '').toLowerCase();  
                        return nameA.localeCompare(nameB, 'ru');  
                    });  
            }  
            
            console.log('[MyShows] Sorted', matchedShows.length, 'shows by', sortOrder);  
            callback({ shows: matchedShows });    
        };
        
        for (var i = 0; i < shows.length; i++) {  
            var show = shows[i];  
            
            (function(currentShow, index) {  
                // Сначала ищем сериал  
                var searchUrl = 'https://api.themoviedb.org/3/search/tv' +  
                    '?api_key=' + Lampa.TMDB.key() +  
                    '&query=' + encodeURIComponent(currentShow.originalTitle || currentShow.title) +  
                    '&year=' + currentShow.year +  
                    '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                
                var network = new Lampa.Reguest();  
                network.silent(searchUrl, function(searchResponse) {  
                    if (searchResponse && searchResponse.results && searchResponse.results.length > 0) {  
                        var foundShow = searchResponse.results[0];  
                        
                        // Теперь получаем полную информацию о сериале  
                        var fullUrl = 'https://api.themoviedb.org/3/tv/' + foundShow.id +  
                            '?api_key=' + Lampa.TMDB.key() +  
                            '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                        
                        var fullNetwork = new Lampa.Reguest();  
                        fullNetwork.silent(fullUrl, function(fullResponse) {  
                            if (fullResponse && fullResponse.seasons) {  
                                var totalEpisodes = getTotalEpisodesCount(fullResponse);  
                                
                                // Получаем детали последнего сезона для проверки дат выхода  
                                var validSeasons = [];  
                                for (var i = 0; i < fullResponse.seasons.length; i++) {  
                                    if (fullResponse.seasons[i].season_number > 0) {  
                                        validSeasons.push(fullResponse.seasons[i].season_number);  
                                    }  
                                }  
                                var lastSeason = Math.max.apply(Math, validSeasons);
                                
                                var seasonUrl = 'https://api.themoviedb.org/3/tv/' + foundShow.id + '/season/' + lastSeason +  
                                    '?api_key=' + Lampa.TMDB.key() +  
                                    '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                                
                                var seasonNetwork = new Lampa.Reguest();  
                                seasonNetwork.silent(seasonUrl, function(seasonResponse) {  
                                    var releasedEpisodes = totalEpisodes;  
                                    
                                    if (seasonResponse && seasonResponse.episodes) {  
                                        var today = new Date();  
                                        var unreleased = seasonResponse.episodes.filter(function(ep) {  
                                            if (!ep.air_date) return false;  
                                            var airDate = new Date(ep.air_date);  
                                            return airDate > today;  
                                        }).length;  
                                        
                                        releasedEpisodes = totalEpisodes - unreleased;  
                                    }  
                                    
                                    var watchedEpisodes = Math.max(0, releasedEpisodes - currentShow.unwatchedCount);  
                                                                        
                                    foundShow.progress_marker = watchedEpisodes + '/' + totalEpisodes;  
                                    foundShow.watched_count = watchedEpisodes;  
                                    foundShow.total_count = totalEpisodes;  
                                    foundShow.released_count = releasedEpisodes;

                                    var myshowsData = {  
                                        progress_marker: foundShow.progress_marker,  
                                        watched_count: foundShow.watched_count,  
                                        total_count: foundShow.total_count,  
                                        released_count: foundShow.released_count  
                                    }; 

                                    var enrichedShow = enrichShowData(fullResponse, myshowsData);
                                    
                                    status.append('tmdb_' + index, enrichedShow);  
                                }, function() {    
                                    // Fallback к старой логике если не удалось получить детали сезона    
                                    var watchedEpisodes = Math.max(0, totalEpisodes - currentShow.unwatchedCount);    
                                    foundShow.progress_marker = watchedEpisodes + '/' + totalEpisodes;  
                                    foundShow.watched_count = watchedEpisodes;  
                                    foundShow.total_count = totalEpisodes;  
                                    
                                    var myshowsData = {  
                                        progress_marker: foundShow.progress_marker,  
                                        watched_count: foundShow.watched_count,  
                                        total_count: foundShow.total_count,  
                                        released_count: totalEpisodes  
                                    };  
                                    
                                    var enrichedShow = enrichShowData(fullResponse, myshowsData);  
                                    status.append('tmdb_' + index, enrichedShow);  // Используем enrichedShow  
                                }); 
                            } else {  
                                status.append('tmdb_' + index, foundShow);  
                            }  
                        });
                    } else {  
                        status.append('tmdb_' + index, null);  
                    }  
                }, function(error) {  
                    console.error('[MyShows] Search error:', error);  
                    status.error();  
                });  
            })(show, i);  
        }  
    }

    function getTotalEpisodesCount(tmdbShow) {  
        // Подсчитываем общее количество серий из данных TMDB  
        var total = 0;  
        if (tmdbShow.seasons) {  
            tmdbShow.seasons.forEach(function(season) {  
                if (season.season_number > 0) { // Исключаем спецвыпуски  
                    total += season.episode_count || 0;  
                }  
            });  
        }  
        return total;  
    }

    function createMyShowsCard(item, params) {    
        var card = new Lampa.Card(item, params);    
        
        var originalFavorite = card.favorite;    
        card.favorite = function() {    
            originalFavorite.call(this);    
            
            // Используем предварительно подготовленный HTML  
            if (item._prebuiltMarker) {    
                var cardView = this.card.querySelector('.card__view');  
                if (cardView) {  
                    cardView.insertAdjacentHTML('beforeend', item._prebuiltMarker);  
                }  
            }    
        };    
        
        return card;    
    }

    window.MyShows = {
        getUnwatchedShowsWithDetails: getUnwatchedShowsWithDetails,
        createMyShowsCard: createMyShowsCard,
    };

    // Функция обновления с визуальным эффектом  
    function updateCardWithAnimation(cardElement, newProgressMarker) {  
        var progressMarker = cardElement.querySelector('.card__marker--progress span');  
        if (!progressMarker) return;  
        
        var oldText = progressMarker.textContent;  
        if (oldText === newProgressMarker) return;  
        
        // Добавляем CSS анимацию  
        progressMarker.style.transition = 'all 0.5s ease';  
        progressMarker.style.transform = 'scale(1.5)';  
        progressMarker.style.color = '#FFD700';  
        
        setTimeout(function() {  
            progressMarker.textContent = newProgressMarker;  
            
            setTimeout(function() {  
                progressMarker.style.transform = 'scale(1)';  
                progressMarker.style.color = '#fff';  
            }, 150);  
        }, 150);  
    }  
    
    // Обновленная функция updateAllMyShowsCards с анимацией  
    window.MyShows.updateAllMyShowsCards = function(originalName, newProgressMarker) {  
        var cards = document.querySelectorAll('.card');  
        for (var i = 0; i < cards.length; i++) {  
            var cardElement = cards[i];  
            var cardData = cardElement.card_data || {};  
            
            if ((cardData.original_name || cardData.name || cardData.title) === originalName &&   
                cardData.progress_marker) {  
                
                // Обновляем данные карточки  
                cardData.progress_marker = newProgressMarker;  
                
                // Обновляем с анимацией  
                updateCardWithAnimation(cardElement, newProgressMarker);  
                
                console.log('[MyShows] Updated card progress:', originalName, 'to', newProgressMarker);  
            }  
        }  
    };

    Lampa.Listener.follow('activity', function(event) {            
        
        // Слушаем только возврат на главную страницу  
        if (event.type === 'archive' && (event.component === 'main' || event.component === 'category')) {          
            var lastCard = Lampa.Storage.get('myshows_last_card', null);  
            var wasWatching = Lampa.Storage.get('myshows_was_watching', false);

            if (lastCard && wasWatching) {      
                var originalName = lastCard.original_name || lastCard.original_title || lastCard.title;     
                Lampa.Storage.set('myshows_was_watching', false);     
                
                setTimeout(function() {      
                    getUnwatchedShowsWithDetails(function(result) {       
                        var foundInAPI = false;    
                        var foundShow = null;  
                        
                        if (result && result.shows) {        
                            for (var i = 0; i < result.shows.length; i++) {  
                                var show = result.shows[i];  
                                if ((show.original_name || show.name || show.title) === originalName) {  
                                    foundShow = show;  
                                    break;  
                                }  
                            }    
                            
                            if (foundShow) {        
                                foundInAPI = true;    
                                
                                // Проверяем, есть ли карточка на странице  
                                var existingCard = findExistingCard(originalName);  
                                
                                if (existingCard && foundShow.progress_marker) {  
                                    // Карточка есть - обновляем прогресс  
                                    if (window.MyShows && window.MyShows.updateAllMyShowsCards) {        
                                        window.MyShows.updateAllMyShowsCards(originalName, foundShow.progress_marker);        
                                    }  
                                } else if (!existingCard) {  
                                    // Карточки нет - добавляем новую  
                                    insertNewCardIntoMyShowsSection(foundShow);  
                                }  
                            }        
                        }   
                        if (!foundInAPI) {      
                            updateCompletedShowCard(originalName);      
                        }      
                    });        
                }, 2000);        
            }        
        }        
    });

    function updateCompletedShowCard(showName) {    
        var cards = document.querySelectorAll('.card');    
        
        for (var i = 0; i < cards.length; i++) {    
            var cardElement = cards[i];    
            var cardData = cardElement.card_data || {};    
            
            var cardName = cardData.original_name || cardData.name || cardData.title;    
            if (cardName === showName && cardData.progress_marker) {    
                var releasedEpisodes = cardData.released_count;    
                var totalEpisodes = cardData.total_count;    
                
                if (releasedEpisodes && totalEpisodes) {    
                    var newProgressMarker = releasedEpisodes + '/' + totalEpisodes;    
                    cardData.progress_marker = newProgressMarker;    
                    
                    updateCardWithAnimation(cardElement, newProgressMarker);    
                    
                    // Сохраняем информацию о навигации перед удалением  
                    var parentSection = cardElement.closest('.items-line');  
                    var allCards = parentSection.querySelectorAll('.card');  
                    var currentIndex = Array.from(allCards).indexOf(cardElement);  
                    
                    // Удаляем карточку через 3 секунды после обновления    
                    setTimeout(function() {    
                        removeCompletedCard(cardElement, showName, parentSection, currentIndex);    
                    }, 3000);    
                }    
                break;    
            }    
        }    
    }    

    function removeCompletedCard(cardElement, showName, parentSection, cardIndex) {    
        
        // Проверяем, находится ли фокус на удаляемой карточке  
        var isCurrentlyFocused = cardElement.classList.contains('focus');  
        
        // Определяем следующую карточку для фокуса только если карточка сейчас в фокусе  
        var nextCard = null;  
        if (isCurrentlyFocused) {  
            var allCards = parentSection.querySelectorAll('.card');  
            
            if (cardIndex < allCards.length - 1) {  
                nextCard = allCards[cardIndex + 1]; // Следующая карточка  
            } else if (cardIndex > 0) {  
                nextCard = allCards[cardIndex - 1]; // Предыдущая карточка  
            }  
        }  
        
        // Добавляем анимацию исчезновения    
        cardElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';    
        cardElement.style.opacity = '0';    
        cardElement.style.transform = 'scale(0.8)';    
        
        // Удаляем элемент после анимации  
        setTimeout(function() {    
            if (cardElement && cardElement.parentNode) {    
                cardElement.remove();    
                
                // Восстанавливаем фокус только если удаляемая карточка была в фокусе  
                if (nextCard && window.Lampa && window.Lampa.Controller) {  
                    setTimeout(function() {  
                        Lampa.Controller.collectionSet(parentSection);  
                        Lampa.Controller.collectionFocus(nextCard, parentSection);  
                    }, 50);  
                } else if (isCurrentlyFocused) {  
                    // Если была в фокусе, но нет следующей карточки, обновляем коллекцию  
                    setTimeout(function() {  
                        if (window.Lampa && window.Lampa.Controller) {  
                            Lampa.Controller.collectionSet(parentSection);  
                        }  
                    }, 50);  
                }  
            }    
        }, 500);    
    }
    

    function findExistingCard(showName) {  
        var titleElements = document.querySelectorAll('.items-line__title');  
        var targetSection = null;  
        
        for (var i = 0; i < titleElements.length; i++) {  
            var titleText = titleElements[i].textContent || titleElements[i].innerText;  
            if (titleText.indexOf('MyShows') !== -1) {  
                targetSection = titleElements[i].closest('.items-line');  
                break;  
            }  
        }  
        
        if (!targetSection) {  
            console.log('[MyShows] Target section not found');  
            return null;  
        }  
        
        var cards = targetSection.querySelectorAll('.card');  
        
        for (var i = 0; i < cards.length; i++) {  
            var cardElement = cards[i];  
            var cardData = cardElement.card_data || {};  
            
            var cardNames = [  
                cardData.original_name,  
                cardData.name,  
                cardData.title,  
                cardData.original_title  
            ].filter(Boolean);  
            
            // Используем другую переменную для внутреннего цикла  
            for (var j = 0; j < cardNames.length; j++) {  
                if (cardNames[j] === showName) {  
                    return cardElement;  
                }  
            }  
        }  
        
        return null;  
    }


    function insertNewCardIntoMyShowsSection(showData, retryCount) {  
        var currentFocusedElement = document.querySelector('.focus');  
        var currentFocusedCard = null;
        
        if (currentFocusedElement && currentFocusedElement.closest('.card')) {  
            currentFocusedCard = currentFocusedElement.closest('.card');  
        }

        if (typeof retryCount === 'undefined') {  
            retryCount = 0;  
        }   
        
        var titleElements = document.querySelectorAll('.items-line__title');      
        var targetSection = null;      
        
        
        for (var i = 0; i < titleElements.length; i++) {      
            var titleText = titleElements[i].textContent || titleElements[i].innerText;      
            
            if (titleText.indexOf('MyShows') !== -1) {      
                targetSection = titleElements[i].closest('.items-line');      
                break;      
            }      
        } 
        
        if (targetSection) {    
            var scrollElement = targetSection.querySelector('.scroll');    
            
            if (scrollElement && scrollElement.Scroll) {    
                
                var scroll = scrollElement.Scroll;  

                try {    
                    var newCard = new Lampa.Card(showData, {    
                        object: { source: 'tmdb' },    
                        card_category: true    
                    });    
                    
                    // Переопределяем метод favorite    
                    var originalFavorite = newCard.favorite;    
                    newCard.favorite = function() {    
                        originalFavorite.call(this);    
                        
                        if (showData.progress_marker) {    
                            var marker = this.card.querySelector('.card__marker');    
                            
                            if (!marker) {    
                                marker = document.createElement('div');    
                                marker.className = 'card__marker card__marker--progress';    
                                marker.innerHTML = '<span></span>';    
                                this.card.querySelector('.card__view').appendChild(marker);    
                            }    
                            
                            marker.querySelector('span').textContent = showData.progress_marker;    
                            marker.classList.add('card__marker--progress');    
                        }    
                    };    
                    
                    newCard.onEnter = function(target, card_data) {    
                        Lampa.Activity.push({    
                            url: card_data.url,    
                            component: 'full',    
                            id: card_data.id,    
                            method: card_data.name ? 'tv' : 'movie',    
                            card: card_data,    
                            source: card_data.source || 'tmdb'    
                        });    
                    };    
                    
                    newCard.create();    
                    newCard.favorite();    
                    
                    var cardElement = newCard.render(true);    
                    
                    if (cardElement) {  
                        scroll.append(cardElement);  
                        
                        // Добавляем карточку в систему навигации  
                        if (window.Lampa && window.Lampa.Controller) {  
                            window.Lampa.Controller.collectionAppend(cardElement);  
                            
                            // Восстанавливаем фокус на предыдущий элемент  
                            setTimeout(function() {  
                                if (currentFocusedCard && window.Lampa.Controller.enabled()) {  
                                    // Находим индекс предыдущего элемента  
                                    var allCards = document.querySelectorAll('.card');  
                                    var targetIndex = -1;  
                                    
                                    for (var i = 0; i < allCards.length; i++) {  
                                        if (allCards[i] === currentFocusedCard) {  
                                            targetIndex = i;  
                                            break;  
                                        }  
                                    }  
                                    
                                    if (targetIndex >= 0) {  
                                        // Устанавливаем фокус на сохраненный элемент  
                                        window.Lampa.Controller.focus(currentFocusedCard);  
                                    }  
                                }  
                            }, 100);  
                        }  
                    } 
                } catch (error) {}  
            }  
        }  
    }


    function addProgressMarkerStyles() {      
        var style = document.createElement('style');      
        style.textContent = `      
            .card__marker--progress {      
                position: absolute;      
                left: 0em;      
                bottom: 0.4em;      
                padding: 0.2em 0.4em;      
                font-size: 1.3em;      
                border-radius: 0.5em;      
                font-weight: bold;      
                z-index: 2;      
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);      
                letter-spacing: 0.04em;      
                line-height: 1.1;      
                background: #4CAF50;      
                color: #fff;      
            }      
            
            /* Поддержка glass-стиля как у других маркеров */  
            body.glass--style.platform--browser .card .card__marker--progress,  
            body.glass--style.platform--nw .card .card__marker--progress,  
            body.glass--style.platform--apple .card .card__marker--progress {  
                background-color: rgba(76, 175, 80, 0.8);  
                -webkit-backdrop-filter: blur(1em);  
                backdrop-filter: blur(1em);  
            }  
            
            .card__marker--progress span {    
                transition: all 0.3s ease;    
                display: inline-block;    
            }    
            
            .card__marker::before {      
                display: none;      
            }     
        `;      
        document.head.appendChild(style);      
    }

    function addMyShowsData(data, oncomplite) {    
        if (getProfileSetting('myshows_view_in_main', true)) {    
            var token = getProfileSetting('myshows_token', '');    
            
            if (token) {    
                getUnwatchedShowsWithDetails(function(result) {    
                    if (result && result.shows && result.shows.length > 0) {    
                        var myshowsCategory = {    
                            title: 'Непросмотренные сериалы (MyShows)',    
                            results: result.shows,  
                            source: 'tmdb',    
                            line_type: 'myshows_unwatched',    
                            cardClass: createMyShowsCard,
                            nomore: true   
                        };    
                        
                        // Сохраняем ссылку на данные для последующих модификаций  
                        window.myShowsData = myshowsCategory;  
                        
                        data.unshift(myshowsCategory);    
                    }    
                    oncomplite(data);    
                });    
                return true;    
            }    
        }    
        
        oncomplite(data);    
        return false;   
    }
    
    // Главная TMDB  
    function addMyShowsToTMDB() {  
        var originalTMDBMain = Lampa.Api.sources.tmdb.main;  
        
        Lampa.Api.sources.tmdb.main = function(params, oncomplite, onerror) {  
            return originalTMDBMain.call(this, params, function(data) {  
                addMyShowsData(data, oncomplite);  
            }, onerror);  
        };  
    }  
    
    // Главная CUB  
    function addMyShowsToCUB() {  
        var originalCUBMain = Lampa.Api.sources.cub.main;  
        
        Lampa.Api.sources.cub.main = function(params, oncomplite, onerror) {  
            var originalLoadPart = originalCUBMain.call(this, params, function(data) {  
                addMyShowsData(data, oncomplite);  
            }, onerror);  
            
            return originalLoadPart;  
        };  
    }

    // Инициализация плеера  
    if (window.Lampa && Lampa.Player && Lampa.Player.listener) {  
    Lampa.Player.listener.follow('start', function(data) {  
        var card = data.card || (Lampa.Activity.active() && Lampa.Activity.active().movie);  
    
        if (!card) return;  
        
        // Просто сохраняем карточку для Timeline обработки  
        Lampa.Storage.set('myshows_last_card', card);  
    });  
    }
  
    // Инициализация  
    if (window.appready) {  
        initSettings();  
        cleanupOldMappings();
        initTimelineListener();  
        addProgressMarkerStyles();
        addMyShowsToTMDB();
        addMyShowsToCUB();
    } else {  
        Lampa.Listener.follow('app', function (event) {  
        if (event.type === 'ready') {  
            initSettings();  
            cleanupOldMappings();
            initTimelineListener();  
            addProgressMarkerStyles();
            addMyShowsToTMDB();
            addMyShowsToCUB();
        }  
        });  
    }  

    Lampa.Listener.follow('line', function(event) {  
        if (event.data && event.data.title && event.data.title.indexOf('MyShows') !== -1) {  
            if (event.type === 'create') {  
                // Принудительно создаем все карточки после создания Line  
                if (event.data && event.data.results && event.line) {  
                    event.data.results.forEach(function(show) {  
                        if (!show.ready && event.line.append) {  
                            event.line.append(show);  
                        }  
                    });  
                }  
            }  
        }  
    });
})();