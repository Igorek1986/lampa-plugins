(function () {  
    'use strict';  

    var DEFAULT_ADD_THRESHOLD = '0';  
    var DEFAULT_MIN_PROGRESS = 90;  
    var API_URL = 'https://api.myshows.me/v2/rpc/';  
    var isInitialized = false;  
    var MAP_KEY = 'myshows_hash_map';  
    var PROXY_URL = 'https://numparser.igorek1986.ru/myshows/auth';  
    var DEFAULT_CACHE_DAYS = 30;

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
            headers: {    
                'Content-Type': 'application/json'    
            },    
            dataType: 'json'    
        });    
    }  
  
    // Функция для выполнения запросов с автоматическим обновлением токена    
    function makeAuthenticatedRequest(url, options, callback, errorCallback) {    
        var token = getProfileSetting('myshows_token', '');    
            
        if (!token) {      
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
        var addThresholdValue = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString());  
        var progressValue = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();    
        var tokenValue = getProfileSetting('myshows_token', '');    
        var loginValue = getProfileSetting('myshows_login', '');  
        var passwordValue = getProfileSetting('myshows_password', '');   
        var cacheDaysValue = getProfileSetting('myshows_cache_days', DEFAULT_CACHE_DAYS); 
            
        Lampa.Storage.set('myshows_view_in_main', myshowsViewInMain, true);  
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'shows.GetByExternalId',
                    params: { id: id, source: source },
                    id: 1
                })
            }, function(data) {
                cb(data && data.result ? data.result.id : null);
            }, function() {
                cb(null);
            });
        }

        if (imdbId) {
            // var cleanImdbId = imdbId.startsWith('tt') ? imdbId.slice(2) : imdbId;
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
            headers: {      
                'Content-Type': 'application/json'      
            },      
            body: JSON.stringify({      
                jsonrpc: '2.0',      
                method: 'shows.GetById',      
                params: { showId: showId, withEpisodes: true },      
                id: 1      
            })      
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
            headers: {        
                'Content-Type': 'application/json'        
            },        
            body: JSON.stringify({        
                jsonrpc: '2.0',        
                method: 'manage.CheckEpisode',        
                params: { id: episodeId, rating: 0 },        
                id: 1        
            })        
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
                    headers: {          
                        'Content-Type': 'application/json'          
                    },          
                    body: JSON.stringify({          
                        jsonrpc: '2.0',          
                        method: 'manage.SetShowStatus',          
                        params: {          
                            id: showId,          
                            status: "watching"          
                        },          
                        id: 1          
                    })          
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
        if (!card) card = getProfileSetting('myshows_last_card', null);  
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
        // Проверяем, нужно ли добавить сериал в "Смотрю"    
        var originalName = card.original_name || card.original_title || card.title;    
        var firstEpisodeHash = Lampa.Utils.hash('11' + originalName);    
        
        if (hash === firstEpisodeHash && percent >= addThreshold) {    
            addShowToWatching(card, token);         
        } else if (addThreshold === 0 && hash === firstEpisodeHash) {      
            addShowToWatching(card, token);         
        }  
    
        // Отмечаем серию как просмотренную только если достигнут minProgress    
        if (percent >= minProgress) {    
            checkEpisodeMyShows(episodeId, token);        
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

    function getUnwatchedShowsWithDetails(callback) {  
        var token = getProfileSetting('myshows_token', '');  
        if (!token) {  
            callback({ error: 'Not authorized' });  
            return;  
        }  
    
        makeAuthenticatedRequest(API_URL, {  
            method: 'POST',  
            headers: { 'Content-Type': 'application/json' },  
            body: JSON.stringify({  
                jsonrpc: '2.0',  
                method: 'lists.Episodes',  
                params: { list: 'unwatched' },  
                id: 1  
            })  
        }, function(response) {  
            if (!response || !response.result) {  
                callback({ error: response ? response.error : 'Empty response' });  
                return;  
            }  
    
            // Извлекаем уникальные сериалы напрямую из ответа  
            var uniqueShows = {};  
            var shows = [];  
            
            for (var i = 0; i < response.result.length; i++) {  
                var item = response.result[i];  
                if (item.show && !uniqueShows[item.show.id]) {  
                    uniqueShows[item.show.id] = true;  
                    shows.push({  
                        myshowsId: item.show.id,  
                        title: item.show.title,  
                        originalTitle: item.show.titleOriginal,  
                        year: item.show.year,  
                    });  
                }  
            }  
            
            getTMDBDetails(shows, callback);  
        }, function(error) {  
            callback({ error: error });  
        });  
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
                if (data[key]) matchedShows.push(data[key]);  
            }  
            callback({ shows: matchedShows });  
        };  
        
        for (var i = 0; i < shows.length; i++) {  
            var show = shows[i];  
            
            (function(currentShow, index) {   
                
                var url = 'https://api.themoviedb.org/3/search/tv' +  
                    '?api_key=' + Lampa.TMDB.key() +  
                    '&query=' + encodeURIComponent(currentShow.originalTitle || currentShow.title) +  
                    '&year=' + currentShow.year +  
                    '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                
                var network = new Lampa.Reguest();  
                network.silent(url, function(response) {  
                    var result = null;  
                    if (response && response.results && response.results.length > 0) {  
                        result = response.results[0];  
                    }  
                    status.append('tmdb_' + index, result);  
                }, function(error) {  
                    status.error();  
                });  
            })(show, i);  
        }  
    }

    window.MyShows = {
        getUnwatchedShowsWithDetails: getUnwatchedShowsWithDetails
    };

    function addMyShowsToTMDB() {  
        // Сохраняем оригинальную функцию main TMDB  
        var originalTMDBMain = Lampa.Api.sources.tmdb.main;  
        
        // Переопределяем функцию main TMDB  
        Lampa.Api.sources.tmdb.main = function(params, oncomplite, onerror) {  
            // Вызываем оригинальную функцию, но перехватываем результат  
            return originalTMDBMain.call(this, params, function(data) {  
                // Добавляем MyShows данные в начало списка  
                if (getProfileSetting('myshows_view_in_main', true)) {  
                    var token = getProfileSetting('myshows_token', '');  
                    
                    if (token) {  
                        getUnwatchedShowsWithDetails(function(result) {  
                            if (result && result.shows && result.shows.length > 0) {  
                                // Добавляем MyShows категорию в начало  
                                var myshowsCategory = {  
                                    title: 'Непросмотренные сериалы (MyShows)',  
                                    results: result.shows.slice(0, 20),  
                                    source: 'tmdb',  
                                    line_type: 'myshows_unwatched'  
                                };  
                                
                                data.unshift(myshowsCategory);  
                            }  
                            oncomplite(data);  
                        });  
                        return;  
                    }  
                }  
                
                oncomplite(data);  
            }, onerror);  
        };  
    }

    function addMyShowsToCUB() {  
        // Сохраняем оригинальную функцию main CUB  
        var originalCUBMain = Lampa.Api.sources.cub.main;  
        
        // Переопределяем функцию main CUB  
        Lampa.Api.sources.cub.main = function(params, oncomplite, onerror) {  
            // Получаем оригинальную функцию loadPart  
            var originalLoadPart = originalCUBMain.call(this, params, function(data) {  
                // Добавляем MyShows данные  
                if (getProfileSetting('myshows_view_in_main', true)) {  
                    var token = getProfileSetting('myshows_token', '');  
                    
                    if (token) {  
                        getUnwatchedShowsWithDetails(function(result) {  
                            if (result && result.shows && result.shows.length > 0) {  
                                var myshowsCategory = {  
                                    title: 'Непросмотренные сериалы (MyShows)',  
                                    results: result.shows.slice(0, 20),  
                                    source: 'tmdb',  
                                    line_type: 'myshows_unwatched'  
                                };  
                                
                                data.unshift(myshowsCategory);  
                            }  
                            oncomplite(data);  
                        });  
                        return;  
                    }  
                }  
                
                oncomplite(data);  
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
        setProfileSetting('myshows_last_card', card);  
    });  
    }
  
    // Инициализация  
    if (window.appready) {  
        initSettings();  
        cleanupOldMappings();
        initTimelineListener();  
        addMyShowsToTMDB();
        addMyShowsToCUB();
    } else {  
        Lampa.Listener.follow('app', function (event) {  
        if (event.type === 'ready') {  
            initSettings();  
            cleanupOldMappings();
            initTimelineListener();  
            addMyShowsToTMDB();
            addMyShowsToCUB();
        }  
        });  
    }  
})();