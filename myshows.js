(function () {  
    'use strict';  

    var DEFAULT_ADD_THRESHOLD = '0';  
    var DEFAULT_MIN_PROGRESS = 90;    
    var API_URL = 'https://api.myshows.me/v3/rpc/';
    var isInitialized = false;  
    var MAP_KEY = 'myshows_hash_map';  
    var PROXY_URL = 'https://numparser.igorek1986.ru/myshows/auth';  
    var DEFAULT_CACHE_DAYS = 30;
    var JSON_HEADERS = {  
        'Content-Type': 'application/json'  
    };
    var AUTHORIZATION = 'authorization2'
    var syncInProgress = false;
    var watch_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var later_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>';
    var remove_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';
    var cancelled_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" fill="currentColor"/></svg>';


    function accountUrl(url) {  
        url = url + '';  
        if (url.indexOf('uid=') == -1) {  
            var uid = Lampa.Storage.get('lampac_unic_id', '');  
            if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));  
        }  
        return url;  
    }  
    
    // Сохранение кеша с использованием профилей  
    function saveCacheToServer(cacheData, path, callback) {  
        try {  
            // var data = JSON.stringify(cacheData);  
            var data = JSON.stringify(cacheData, null, 2);  

            var profileId = Lampa.Storage.get('lampac_profile_id', 'default');  
            var uri = accountUrl('/storage/set?path=myshows/' + path + '&pathfile=' + profileId);  
            
            var network = new Lampa.Reguest();  
            network.native(uri, function(response) {  
                if (response.success) {  
                    if (callback) callback(true);  
                } else {  
                    console.error('[MyShows] Storage error', response.msg);
                    if (callback) callback(false);   
                }  
            }, function(error) {  
                console.error('[MyShows] Network error');
                if (callback) callback(false);  

            }, data, {  
                headers: JSON_HEADERS,  
                method: 'POST'  
            });  
        } catch(e) {  
            console.error('[MyShows] Try error on saveCacheToServer', e.message);
            if (callback) callback(false);  
        }  
    }  
  
    // Загрузка кеша 
    function loadCacheFromServer(path, propertyName, callback) {      
        var profileId = Lampa.Storage.get('lampac_profile_id', 'default');      
        var uri = accountUrl('/storage/get?path=myshows/' + path + '&pathfile=' + profileId);      
            
        var network = new Lampa.Reguest();      
        network.silent(uri, function(response) {      
            if (response.success && response.fileInfo && response.data) {      
                    var cacheData = JSON.parse(response.data);      
                    // callback({ shows: cacheData.shows });  
                    var dataProperty = propertyName || 'shows';  
                    var result = {};  
                    result[dataProperty] = cacheData[dataProperty];  
                    callback(result);    
                    return;        
            }  
            callback(null);       
        }, function(error) {         
            callback(null);      
        });      
    }

    function initMyShowsCaches() {
        // По умолчанию для браузера  
        var updateDelay = 5000;

        // Проверяем, если это ТВ платформа  
        if (Lampa.Platform.tv()) {  
            updateDelay = 25000; // 25 секунд для ТВ  
        }

        loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {    
            if (cachedResult) {      

                // Запускаем отложенную проверку только один раз при загрузке  
                setTimeout(function() {  
                    fetchFromMyShowsAPI(function(freshResult) {  
                        if (freshResult && freshResult.shows && cachedResult.shows) {  
                            updateUIIfNeeded(cachedResult.shows, freshResult.shows);  
                        }  
                    });  
                }, updateDelay);  
                
                return;    
            }    
        }); 
        loadCacheFromServer('serial_status', 'shows', function(cachedResult) {
            if (cachedResult) {
                setTimeout(function() {
                    fetchShowStatus(function(showsData) {})
                }, updateDelay)
            } else {
                fetchShowStatus(function(showsData) {})
            }
        });

        loadCacheFromServer('movie_status', 'movies', function(cachedResult) {
            if (cachedResult) {
                setTimeout(function() {
                    fetchStatusMovies(function(showsData) {})
                }, updateDelay)
            } else {
                fetchStatusMovies(function(showsData) {})
            }
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
    function makeAuthenticatedRequest(options, callback, errorCallback) {    
        var token = getProfileSetting('myshows_token', '');    
            
        if (!token) {    
            if (errorCallback) errorCallback(new Error('No token available'));    
            return;    
        }    
            
        var network = new Lampa.Reguest();    
            
        options.headers = options.headers || {};     
        options.headers[AUTHORIZATION] = 'Bearer ' + token; 
            
        network.silent(API_URL, function(data) {    
            // Проверяем JSON-RPC ошибки    
            if (data && data.error && data.error.code === 401) {    
                tryAuthFromSettings(function(newToken) {    
                    if (newToken) {    
                        options.headers[AUTHORIZATION] = 'Bearer ' + newToken;    
                            
                        var retryNetwork = new Lampa.Reguest();    
                        retryNetwork.silent(API_URL, function(retryData) {    
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
                        options.headers[AUTHORIZATION] = 'Bearer ' + newToken;    
                            
                        var retryNetwork = new Lampa.Reguest();    
                        retryNetwork.silent(API_URL, function(retryData) {    
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

    function makeMyShowsRequest(requestConfig, callback) {
        makeAuthenticatedRequest(requestConfig, function(data) {
            if (data && data.result) {
                callback(true, data);
            } else {
                callback(false, data);
            }
        }, function (err) {
            callback(false, null)
        });
    }

    function makeMyShowsJSONRPCRequest(method, params, callback) {  
        makeMyShowsRequest({  
            method: 'POST',  
            headers: JSON_HEADERS,  
            body: createJSONRPCRequest(method, params)  
        }, callback);  
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

        if (!hasProfileSetting('myshows_button_view')) {      
            setProfileSetting('myshows_button_view', true);      
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
        var myshowsButtonView = getProfileSetting('myshows_button_view', true); 
        var sortOrderValue = getProfileSetting('myshows_sort_order', 'alphabet');  
        var addThresholdValue = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString());  
        var progressValue = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();    
        var tokenValue = getProfileSetting('myshows_token', '');    
        var loginValue = getProfileSetting('myshows_login', '');  
        var passwordValue = getProfileSetting('myshows_password', '');   
        var cacheDaysValue = getProfileSetting('myshows_cache_days', DEFAULT_CACHE_DAYS); 

            
        Lampa.Storage.set('myshows_view_in_main', myshowsViewInMain, true);  
        Lampa.Storage.set('myshows_button_view', myshowsButtonView, true);  
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
            description: 'Минимальный процент просмотра для отметки эпизода или фильма на myshows.me'  
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
                name: 'myshows_button_view',  
                type: 'trigger',  
                default: getProfileSetting('myshows_button_view', true)  
            },  
            field: {  
                name: 'Показывать кнопки в карточках',  
                description: 'Отображать кнопки уплавления в карточка'  
            },  
            onChange: function(value) {  
                setProfileSetting('myshows_button_view', value);  
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

                var myshowsButtonView = settingsPanel.querySelector('select[data-name="myshows_button_view"]');  
                if (myshowsViewInMain) myshowsButtonView.value = getProfileSetting('myshows_button_view', true);

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

    function getShowIdByExternalIds(imdbId, kinopoiskId, title, originalTitle, tmdbId, year, alternativeTitles, callback) {
        console.log('[MyShows] getShowIdByExternalIds started with params:', {
            imdbId: imdbId,
            kinopoiskId: kinopoiskId,
            title: title,
            originalTitle: originalTitle,
            tmdbId: tmdbId,
            year: year,
            alternativeTitles: alternativeTitles
        });

        // 1. Пробуем найти по IMDB
        getShowIdByImdbId(imdbId, function(imdbResult) {
            if (imdbResult) {
                console.log('[MyShows] Found by IMDB ID:', imdbResult);
                return callback(imdbResult);
            }

            // 2. Пробуем найти по Kinopoisk
            getShowIdByKinopiskId(kinopoiskId, function(kinopoiskResult) {
                if (kinopoiskResult) {
                    console.log('[MyShows] Found by Kinopoisk ID:', kinopoiskResult);
                    return callback(kinopoiskResult);
                }

                // 3. Для азиатского контента - специальная логика
                if (isAsianContent(originalTitle)) {
                    handleAsianContent(originalTitle, tmdbId, year, alternativeTitles, callback);
                } else {
                    // 4. Для неазиатского контента - прямой поиск
                    console.log('[MyShows] Non-Asian content, searching by original title:', originalTitle);
                    getShowIdByOriginalTitle(originalTitle, year, callback);
                }
            });
        });
    }

    // Выносим логику для азиатского контента в отдельную функцию
    function handleAsianContent(originalTitle, tmdbId, year, alternativeTitles, callback) {
        console.log('[MyShows] Is Asian content: true for originalTitle:', originalTitle);

        // 1. Пробуем альтернативные названия
        if (alternativeTitles && alternativeTitles.length > 0) {
            console.log('[MyShows] Trying alternative titles:', alternativeTitles);
            tryAlternativeTitles(alternativeTitles, 0, year, function(altResult) {
                if (altResult) {
                    console.log('[MyShows] Found by alternative title:', altResult);
                    return callback(altResult);
                }
                // 2. Если альтернативные не сработали - пробуем английское название
                tryEnglishTitleFallback(originalTitle, tmdbId, year, callback);
            });
        } else {
            // 3. Если нет альтернативных названий - сразу пробуем английское
            tryEnglishTitleFallback(originalTitle, tmdbId, year, callback);
        }
    }

    // Выносим логику fallback на английское название
    function tryEnglishTitleFallback(originalTitle, tmdbId, year, callback) {
        console.log('[MyShows] Trying getEnglishTitle fallback');
        
        getEnglishTitle(tmdbId, true, function(englishTitle) {
            if (englishTitle) {
                console.log('[MyShows] getEnglishTitle result:', englishTitle);
                
                // Пробуем поиск по английскому названию
                getShowIdByOriginalTitle(englishTitle, year, function(englishResult) {
                    if (englishResult) {
                        console.log('[MyShows] Found by English title:', englishResult);
                        return callback(englishResult);
                    }
                    // Fallback к оригинальному названию
                    finalFallbackToOriginal(originalTitle, year, callback);
                });
            } else {
                // Прямой fallback к оригинальному названию
                finalFallbackToOriginal(originalTitle, year, callback);
            }
        });
    }

    // Финальный fallback
    function finalFallbackToOriginal(originalTitle, year, callback) {
        console.log('[MyShows] Fallback to original title:', originalTitle);
        getShowIdByOriginalTitle(originalTitle, year, function(finalResult) {
            console.log('[MyShows] Final result:', finalResult);
            callback(finalResult);
        });
    }

    // Упрощенная версия tryAlternativeTitles (если нужно)
    function tryAlternativeTitles(titles, index, year, callback) {
        if (index >= titles.length) {
            return callback(null);
        }
        
        var currentTitle = titles[index];
        getShowIdByOriginalTitle(currentTitle, year, function(result) {
            if (result) {
                callback(result);
            } else {
                tryAlternativeTitles(titles, index + 1, year, callback);
            }
        });
    }

    // Получить сериал по внешнему ключу
    function getShowIdBySource(id, source, callback) {
        makeMyShowsJSONRPCRequest('shows.GetByExternalId', {
                id: parseInt(id),
                source: source
        }, function(success, data) {
            if (success && data && data.result) {
                callback(data.result.id);
            } else {
                callback(null);
            }
        });
    }

    // Получить список эпизодов по showId
    function getEpisodesByShowId(showId, token, callback) {    
        makeMyShowsJSONRPCRequest('shows.GetById', { 
            showId: parseInt(showId), withEpisodes: true         
        }, function(success, data) {
            callback(data.result.episodes);
        });      
    }  

    function getShowIdByOriginalTitle(title, year, callback) {  
        makeMyShowsJSONRPCRequest('shows.Search', {  
            "query": title  
        }, function(success, data) {  
            if (success && data && data.result) {  
                getShowCandidates(data.result, title, year, function(candidates) {  
                    callback(candidates || null);  
                });  
            } else {  
                callback(null);  
            }  
        });  
    }

    // Поиск по оригинальному названию
    function getMovieIdByOriginalTitle(title, year, callback) {
        makeMyShowsJSONRPCRequest('movies.GetCatalog', {
                search: { "query": title },
                page: 0,
                pageSize: 50
        }, function(success, data) {
            if (success && data && data.result) {
                getMovieCandidates(data.result, title, year, function(candidates) {
                    if (candidates) {
                        callback(candidates);
                        return;
                    } else {
                        callback(null);
                    }
                })
            } else {
                callback(null);
            }
        });
    }

    // Отметить эпизод на myshows  
    function checkEpisodeMyShows(episodeId, callback) {         
        makeMyShowsJSONRPCRequest('manage.CheckEpisode', { 
            id: episodeId, 
            rating: 0                 
        }, function(success, data) {
            callback(success);
        });     
    }  

    // Отметить фильм
    function checkMovieMyShows(movieId, callback) {        
        makeMyShowsJSONRPCRequest('manage.SetMovieStatus', { 
                movieId: movieId, 
                status: "finished" 
        }, function(success, data) {
            callback(success);
        });
    }

    // Установить статус для сериала ("Смотрю, Буду смотреть, Перестал смотреть, Не смотрю" на MyShows  
    function setMyShowsStatus(cardData, status, callback) {  
        var alternativeTitles = [];
        if (cardData && cardData.alternative_titles && cardData.alternative_titles.results) {  
            cardData.alternative_titles.results.forEach(function(altTitle) {  
                if (altTitle.iso_3166_1 === 'US' && altTitle.title) {  
                    alternativeTitles.push(altTitle.title);  
                }  
            });  
        } 
        var imdbId = cardData.imdb_id || (cardData.ids && cardData.ids.imdb);  
        var kinopoiskId = cardData.kinopoisk_id || cardData.kp_id || (cardData.ids && cardData.ids.kp);  
        var showTitle = cardData.title || cardData.name;  
        var originalName = cardData.original_name || cardData.original_title || cardData.title;
        var year = cardData.first_air_date.slice(0,4);
        var tmdbId = cardData.id;
        
        getShowIdByExternalIds(imdbId, kinopoiskId, showTitle, originalName, tmdbId, year, alternativeTitles, function(showId) {
            if (!showId) {  
                callback(false);  
                return;  
            }  
            
            makeMyShowsJSONRPCRequest('manage.SetShowStatus', {  
                    id: showId,  
                    status: status   
            }, function(success, data) {  
                // var success = !data.error;  
                
                if (success && data && data.result) {  
                    // Обновляем кэш при успешном изменении статуса   
                    fetchShowStatus(function(data) {})
                    fetchFromMyShowsAPI(function(data) {})
                    
                    if (status === 'watching') {  
                        addToHistory(cardData);  
                    }  
                }  
                
                callback(success);  
            });  
        });  
    }

    function fetchShowStatus(callback) {
        makeMyShowsJSONRPCRequest('profile.Shows', {
        }, function(success, data) {
            if (success && data && data.result) {
                var filteredShows = data.result.map(function(item) {  
                    return {  
                        id: item.show.id,  
                        title: item.show.title,  
                        titleOriginal: item.show.titleOriginal,  
                        watchStatus: item.watchStatus  
                    };  
                });  
                
                callback({shows: filteredShows});
                saveCacheToServer({ shows: filteredShows }, 'serial_status', function() {})

            } else {
                callback(null);
            }
        }) 
    }

    // Получить непросмотренные серии
    function fetchFromMyShowsAPI(callback) {  
        makeMyShowsJSONRPCRequest('lists.Episodes', { list: 'unwatched'   
        }, function(success, response) {  
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
            
            // Сразу переходим к поиску в TMDB  
            getTMDBDetails(shows, function(result) {  
                if (result && result.shows) {  
                    // Сохраняем в серверный кеш  
                    var cacheData = {  
                        shows: result.shows,  
                    };  
                    saveCacheToServer(cacheData, 'unwatched_serials', function(result) {});  

                    var useFastAPI = Lampa.Storage.get('numparser_myshows_fastapi', false);  
                    if (useFastAPI) {  
                        console.log('[MyShows] Сохраняем данные в FastAPI');  
                        saveToFastAPI(cacheData, 'unwatched_serials');  
                    }
                }  
                callback(result);  
            });  
        });  
    } 

    var BASE_URL = Lampa.Storage.get('base_url_numparser');

    function saveToFastAPI(cacheData, path, callback) {    
        var login = Lampa.Storage.get('myshows_login', '');    
        var unicId = Lampa.Storage.get('lampac_unic_id', '');    
        var profileId = Lampa.Storage.get('lampac_profile_id', '');    
        
        if (!login || !unicId) {    
            console.log('[MyShows] Не удается сохранить в FastAPI: отсутствует login или unic_id');    
            if (callback) callback();  
            return;    
        }    
        
        // Сортировка данных
        var sortOrder = getProfileSetting('myshows_sort_order', 'alphabet');
        if (cacheData.shows && cacheData.shows.length > 0) {
            sortShows(cacheData.shows, sortOrder);
        }
        
        var hashedLogin = Lampa.Utils.hash(login);    
        var pathHash = Lampa.Utils.hash(unicId + profileId);    
        var url = BASE_URL + '/myshows/' + path + '/' + hashedLogin + '/' + pathHash;    
        var jsonData = JSON.stringify(cacheData);    
        
        var network = new Lampa.Reguest();    
        
        // Правильный порядок: url, success, error, post_data, params  
        network.silent(url,   
            function(response) {    
                console.log('[MyShows] Данные успешно сохранены в FastAPI');    
                if (callback) callback();    
            },   
            function(error) {    
                console.log('[MyShows] Ошибка сохранения в FastAPI:', error);    
                if (callback) callback();    
            },   
            jsonData,    
            {    
                method: 'POST',    
                headers: {    
                    'Content-Type': 'application/json',    
                    'X-Profile-ID': profileId    
                }    
            }  
        );   
    }

    ////// Статус фильмов. (Смотрю, Буду смотреть, Не смотрел) //////
    function setMyShowsMovieStatus(movieData, status, callback) {          
        var title = movieData.original_title || movieData.title;  
        var year = getMovieYear(movieData);  
        
        getMovieIdByOriginalTitle(title, year, function(movieId) {  
            if (!movieId) {  
                callback(false);  
                return;  
            }  
            
            makeMyShowsJSONRPCRequest('manage.SetMovieStatus', {  
                    movieId: movieId,  
                    status: status  
            }, function(success, data) {  
                
                if (success && data && data.result) {  
                    // Обновляем кэш фильмов при успешном изменении статуса  
                    fetchStatusMovies(function(data) {})
                    
                    // Если фильм отмечен как просмотренный, добавляем в историю  
                    if (status === 'finished') {  
                        addToHistory(movieData);  
                    }  
                }  
                
                callback(success);   
            });  
        });  
    }

    function getShowIdByImdbId(id, callback) {
        if (!id) {
            callback(null);
            return
        }
        var cleanImdbId = id.indexOf('tt') === 0 ? id.slice(2) : id;
        getShowIdBySource(cleanImdbId, 'imdb', function(myshows_id) {
            callback(myshows_id);
        })
    }

    function getShowIdByKinopiskId(id, callback) {
        if (!id) {
            callback(null);
            return
        }

        getShowIdBySource(id, 'kinopoisk', function(myshows_id) {
            callback(myshows_id);
        })
    }

    function getMovieCandidates(data, title, year, callback) {
        var candidates = [];
        for (var i = 0; i < data.length; ++i) {
            try {
                var movie = data[i].movie;
                if (!movie) {
                    continue
                }
                var titleMatch = movie.titleOriginal && movie.titleOriginal.toLowerCase() === title.toLowerCase();
                var yearMatch = movie.year == year;

                if (titleMatch && yearMatch) {
                    candidates.push(movie);
                }
            } catch (e) {
                callback(null);
            }
        }

        if (candidates.length === 0) {
            callback(null);
            return;
        } else if (candidates.length == 1) {
            callback(candidates[0].id)
        } else getBestMovieCandidate(candidates, function(candidate) {
            if (candidate) {
                callback(candidate);
                return;
            } else {
                callback(null);
            }
        })
    }

    function getShowCandidates(data, title, year, callback) {    
        console.log('[MyShows] getShowCandidates called with:', {  
            dataLength: data.length,  
            title: title,  
            year: year  
        });  
        
        var candidates = [];    
        
        for (var i = 0; i < data.length; ++i) {    
            try {    
                var show = data[i];  
                if (!show) {    
                    continue;    
                }    
                
                var yearMatch = show.year == year;    
    
                console.log('[MyShows] Checking show:', {  
                    id: show.id,  
                    titleOriginal: show.titleOriginal,  
                    year: show.year,  
                    yearMatch: yearMatch  
                });  
    
                // Для точного совпадения года добавляем кандидата  
                if (yearMatch) {    
                    candidates.push(show);    
                    console.log('[MyShows] Added year match candidate:', show.id);  
                }    
            } catch (e) {    
                console.error('[MyShows] Error processing show:', e);  
                callback(null);    
                return;    
            }    
        }    
    
        console.log('[MyShows] Found candidates:', candidates.length);  
    
        if (candidates.length === 0) {    
            callback(null);    
        } else if (candidates.length == 1) {    
            console.log('[MyShows] Returning single candidate:', candidates[0].id);  
            callback(candidates[0].id);    
        } else {    
            console.log('[MyShows] Multiple candidates, getting best one');  
            getBestShowCandidate(candidates, function(candidate) {    
                callback(candidate ? candidate.id : null);    
            });    
        }    
    }

    function getBestMovieCandidate(candidates, callback) {
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            var releaseDate = candidate.releaseDate;

            if (!releaseDate) {
                continue;
            }

            try {
                var parts = releaseDate.split('.')
                if (parts.length !== 3) {
                    callback(null);
                    return;
                }

                var myShowsData = new Date(parts[2], parts[1]-1, parts[0]);
                var card = getCurrentCard();
                var tmdbData = card && card.release_date ? new Date(card.release_date) : null;

                if (myShowsData.getTime() == tmdbData.getTime()) {
                    callback(candidate);
                    return;
                } else {
                    continue;
                }
            } catch(e) {
                callback(null);
            }
        }
        callback(null);
    }

    function getBestShowCandidate(candidates, callback) {  
        for (var i = 0; i < candidates.length; i++) {  
            var candidate = candidates[i];  
            
            // Для сериалов может быть другое поле даты или его отсутствие  
            var airDate = candidate.started || candidate.first_air_date;  
            
            if (!airDate) {  
                continue;  
            }  
    
            try {  
                var myShowsDate;  
                
                // Обработка разных форматов дат  
                if (airDate.includes('.')) {  
                    var parts = airDate.split('.');  
                    if (parts.length !== 3) {  
                        continue;  
                    }  
                    myShowsDate = new Date(parts[2], parts[1]-1, parts[0]);  
                } else if (airDate.includes('-')) {  
                    myShowsDate = new Date(airDate);  
                } else {  
                    continue;  
                }  
    
                var card = getCurrentCard();  
                var tmdbDate = card && card.first_air_date ? new Date(card.first_air_date) :   
                            card && card.release_date ? new Date(card.release_date) : null;  
    
                if (tmdbDate && myShowsDate.getTime() === tmdbDate.getTime()) {  
                    callback(candidate);  
                    return;  
                }  
            } catch(e) {  
                continue;  
            }  
        }  
        
        // Если точного совпадения по дате нет, возвращаем первый кандидат  
        callback(candidates.length > 0 ? candidates[0] : null);  
    }

    function getEnglishTitle(tmdbId, isSerial, callback) {  
        var apiUrl = 'https://api.themoviedb.org/3/' + (isSerial ? 'tv' : 'movie') + '/' + tmdbId +   
                    '?api_key=' + Lampa.TMDB.key() +   
                    '&language=en';  
    
        var tmdbNetwork = new Lampa.Reguest();  
        tmdbNetwork.silent(apiUrl, function (response) {  
            if (response) {  
                var englishTitle = isSerial ? response.name : response.title;  
                callback(englishTitle);  
            } else {  
                callback(null);  
            }  
        }, function () {  
            // Error callback  
            callback(null);  
        });  
    }

    function isAsianContent(originalTitle) {  
        if (!originalTitle) return false;  
        
        // Проверяем на корейские, японские, китайские символы  
        var koreanRegex = /[\uAC00-\uD7AF]/;  
        var japaneseRegex = /[\u3040-\u30FF\uFF66-\uFF9F]/;  
        var chineseRegex = /[\u4E00-\u9FFF]/;  
        
        return koreanRegex.test(originalTitle) ||   
            japaneseRegex.test(originalTitle) ||   
            chineseRegex.test(originalTitle);  
    }

    function tryAlternativeTitles(titles, index, year, callback) {  
        console.log('[MyShows] tryAlternativeTitles - index:', index, 'of', titles.length, 'titles');  
        
        if (index >= titles.length) {  
            console.log('[MyShows] tryAlternativeTitles - all titles exhausted');  
            callback(null);  
            return;  
        }  
        
        var currentTitle = titles[index];  
        console.log('[MyShows] tryAlternativeTitles - trying title:', currentTitle, 'year:', year);  
        
        getShowIdByOriginalTitle(currentTitle, year, function(myshows_id) {  
            console.log('[MyShows] tryAlternativeTitles - result for "' + currentTitle + '":', myshows_id);  
            
            if (myshows_id) {  
                console.log('[MyShows] tryAlternativeTitles - SUCCESS with title:', currentTitle);  
                callback(myshows_id);  
            } else {  
                console.log('[MyShows] tryAlternativeTitles - failed with "' + currentTitle + '", trying next');  
                // Пробуем следующее название  
                tryAlternativeTitles(titles, index + 1, year, callback);  
            }  
        });  
    }

    function getMovieYear(card) {   
        
        // Сначала пробуем готовое поле  
        if (card.release_year && card.release_year !== '0000') {  
            return card.release_year;  
        }  
        
        // Извлекаем из release_date  
        var date = (card.release_date || '') + '';  
        return date ? date.slice(0,4) : null;  
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
        var alternativeTitles = [];
        if (card && card.alternative_titles && card.alternative_titles.results) {  
            card.alternative_titles.results.forEach(function(altTitle) {  
                if (altTitle.iso_3166_1 === 'US' && altTitle.title) {  
                    alternativeTitles.push(altTitle.title);  
                }  
            });  
        }
        var imdbId = card && (card.imdb_id || card.imdbId || (card.ids && card.ids.imdb));
        var kinopoiskId = card && (card.kinopoisk_id || card.kp_id || (card.ids && card.ids.kp));
        var showTitle = card && (card.title || card.name);
        var originalName = card && (card.original_name || card.original_title || card.title);
        var year = card.first_air_date.slice(0,4);
        var tmdbId = card && card.id;
        
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
        getShowIdByExternalIds(imdbId, kinopoiskId, showTitle, originalName, tmdbId, year, alternativeTitles, function(showId) {
            if (!showId) {
                callback({});
                return;
            }

            console.log('[MyShows] ensureHashMap showId', showId)
            
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
        return !card.original_name && (card.original_title || card.title);
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
        if (card) {
            card.isMovie = isMovieContent(card);
        }
        return card;  
    }  
  
    // обработка Timeline обновлений
    function processTimelineUpdate(data) {    
        if (syncInProgress) {   
            return;  
        }  

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

        var isMovie = isMovieContent(card);

        if (isMovie) {
            // Обработка фильма
            if (percent >= minProgress) {
                var originalTitle = card.original_title || card.title;
                var year = getMovieYear(card)
                getMovieIdByOriginalTitle(originalTitle, year, function(movieId) {
                    if (movieId) {
                        checkMovieMyShows(movieId, function(success) {});
                    }
                });
            }
        } else {  
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
    }  

    function processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold) { 
        
        var originalName = card.original_name || card.original_title || card.title;      
        var firstEpisodeHash = Lampa.Utils.hash('11' + originalName);     
        
        Lampa.Storage.set('myshows_was_watching', true); 
        
        // Проверяем, нужно ли добавить сериал в "Смотрю"  
        if (hash === firstEpisodeHash && percent >= addThreshold) {    
 
            setMyShowsStatus(card, 'watching', function(success) {
                // Обновляем кеш только если НЕ достигнут minProgress    
                if (success && percent < minProgress) {
                    fetchFromMyShowsAPI(function(data) {});
                }
            });  

        } else if (addThreshold === 0 && hash === firstEpisodeHash) {    
   
            setMyShowsStatus(card, 'watching', function(success) {
                // Обновляем кеш только если НЕ достигнут minProgress    
                if (success && percent < minProgress) {
                    fetchFromMyShowsAPI(function(data) {})
                }
            });  
        }   
    
        // Отмечаем серию как просмотренную только если достигнут minProgress      
        if (percent >= minProgress) {    
            checkEpisodeMyShows(episodeId, function(success) {
                if (success) {
                    fetchFromMyShowsAPI(function(data) {})
                }
            });    
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
        }      
    }
    
    function prepareProgressMarkers(data) {    
        var items = data.shows || data.results || [];  
        
        items.forEach(function(show) {    
            if (show.progress_marker) {    
                show._prebuiltMarker = '<div class="card__marker card__marker--progress"><span>' +     
                                    show.progress_marker + '</span></div>';    
            }    
        });  
        
        return data;    
    }

    function getUnwatchedShowsWithDetails(callback, show) {   
        var useFastAPI = Lampa.Storage.get('numparser_myshows_fastapi', false);  
      
        if (useFastAPI) { 
            fetchFromMyShowsAPI(function(freshResult) {
                // Добавляем предварительную подготовку маркеров для кешированных данных  
                callback(prepareProgressMarkers(freshResult));
            }); 
        } else {
            // Логика с кешем    
            loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {    
                if (cachedResult) {      
                    // Добавляем предварительную подготовку маркеров для кешированных данных  
                    prepareProgressMarkers(cachedResult);
                    
                    callback(cachedResult);   
                } else {
                    fetchFromMyShowsAPI(function(freshResult) {
                        // Добавляем предварительную подготовку маркеров для кешированных данных  
                        callback(prepareProgressMarkers(freshResult));
                    });    
                } 
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
                    updateAllMyShowsCards(key, newShow.progress_marker);  
                }  
            }  
        }  
    }

    function enrichShowData(fullResponse, myshowsData) {    
        // Используем полные данные TMDB как основу  
        var enriched = Object.assign({}, fullResponse);    
        
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
        enriched.source = 'tmdb';    
        enriched.status = fullResponse.status;    
        enriched.still_path = '';    
        enriched.update_date = new Date().toISOString();    
        enriched.video = false;    
        
        return enriched;    
    }

    function getTMDBDetails(shows, callback) {
        if (shows.length === 0) {
            return callback({ shows: [] });
        }

        var status = new Lampa.Status(shows.length);

        status.onComplite = function (data) {
            var matchedShows = Object.keys(data)
                .map(function (key) { return data[key]; })
                .filter(Boolean);

            var sortOrder = getProfileSetting('myshows_sort_order', 'alphabet');

            sortShows(matchedShows, sortOrder);

            callback({ shows: matchedShows });
        };

        shows.forEach(function (show, index) {
            fetchTMDBShowDetails(show, index, status);
        });
    }

    function sortShows(shows, order) {
        switch (order) {
            case 'alphabet':
                shows.sort(sortByAlphabet);
                break;
            case 'progress':
                shows.sort(sortByProgress);
                break;
            case 'unwatched_count':
                shows.sort(sortByUnwatched);
                break;
            default:
                shows.sort(sortByAlphabet);
        }
    }

    function sortByAlphabet(a, b) {
        var nameA = (a.name || a.title || '').toLowerCase();
        var nameB = (b.name || b.title || '').toLowerCase();
        return nameA.localeCompare(nameB, 'ru');
    }

    function sortByProgress(a, b) {
        var progressA = (a.watched_count || 0) / (a.total_count || 1);
        var progressB = (b.watched_count || 0) / (b.total_count || 1);

        if (progressB !== progressA) {
            return progressB - progressA;
        }
        return (b.watched_count || 0) - (a.watched_count || 0);
    }

    function sortByUnwatched(a, b) {
        var unwatchedA = (a.total_count || 0) - (a.watched_count || 0);
        var unwatchedB = (b.total_count || 0) - (b.watched_count || 0);

        if (unwatchedA !== unwatchedB) {
            return unwatchedA - unwatchedB;
        }
        return sortByAlphabet(a, b);
    }

    function fetchTMDBShowDetails(currentShow, index, status) {
        var searchUrl = 'https://api.themoviedb.org/3/search/tv' +
            '?api_key=' + Lampa.TMDB.key() +
            '&query=' + encodeURIComponent(currentShow.originalTitle || currentShow.title) +
            '&year=' + currentShow.year +
            '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');

        var network = new Lampa.Reguest();
        network.silent(searchUrl, function (searchResponse) {
            if (searchResponse && searchResponse.results && searchResponse.results.length > 0) {
                var foundShow = searchResponse.results[0];
                enrichTMDBShow(foundShow, currentShow, index, status);
            } else {
                status.append('tmdb_' + index, null);
            }
        }, function (error) {
            status.error();
        });
    }

    function enrichTMDBShow(foundShow, currentShow, index, status) {
        var fullUrl = 'https://api.themoviedb.org/3/tv/' + foundShow.id +
            '?api_key=' + Lampa.TMDB.key() +
            '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');

        var fullNetwork = new Lampa.Reguest();
        fullNetwork.silent(fullUrl, function (fullResponse) {
            if (!fullResponse || !fullResponse.seasons) {
                return status.append('tmdb_' + index, foundShow);
            }

            var totalEpisodes = getTotalEpisodesCount(fullResponse);
            var lastSeason = getLastValidSeason(fullResponse);

            if (!lastSeason) {
                return appendEnriched(fullResponse, foundShow, currentShow, totalEpisodes, totalEpisodes, index, status);
            }

            fetchSeasonDetails(foundShow, fullResponse, currentShow, totalEpisodes, lastSeason, index, status);
        });
    }

    function getLastValidSeason(fullResponse) {
        var validSeasons = fullResponse.seasons
            .filter(function (s) { return s.season_number > 0; })
            .map(function (s) { return s.season_number; });

        return validSeasons.length ? Math.max.apply(Math, validSeasons) : null;
    }

    function fetchSeasonDetails(foundShow, fullResponse, currentShow, totalEpisodes, lastSeason, index, status) {
        var seasonUrl = 'https://api.themoviedb.org/3/tv/' + foundShow.id + '/season/' + lastSeason +
            '?api_key=' + Lampa.TMDB.key() +
            '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');

        var seasonNetwork = new Lampa.Reguest();
        seasonNetwork.silent(seasonUrl, function (seasonResponse) {
            var releasedEpisodes = getReleasedEpisodesCount(seasonResponse, currentShow, totalEpisodes);
            appendEnriched(fullResponse, foundShow, currentShow, totalEpisodes, releasedEpisodes, index, status);
        }, function () {
            appendEnriched(fullResponse, foundShow, currentShow, totalEpisodes, totalEpisodes, index, status);
        });
    }

    function getReleasedEpisodesCount(seasonResponse, currentShow, totalEpisodes) {
        if (!seasonResponse || !seasonResponse.episodes) return totalEpisodes;

        var today = new Date();
        var unreleased = seasonResponse.episodes.reduce(function (acc, ep) {
            var myshowsEpisode = currentShow.unwatchedEpisodes.find(function (mep) {
                return mep.seasonNumber === ep.season_number &&
                    mep.episodeNumber === ep.episode_number;
            });

            var airDateStr = myshowsEpisode ? myshowsEpisode.airDate : ep.air_date;
            if (airDateStr && new Date(airDateStr) > today) {
                acc++;
            }
            return acc;
        }, 0);

        return totalEpisodes - unreleased;
    }

    function appendEnriched(fullResponse, foundShow, currentShow, totalEpisodes, releasedEpisodes, index, status) {
        var watchedEpisodes = Math.max(0, releasedEpisodes - currentShow.unwatchedCount);

        var myshowsData = {
            progress_marker: watchedEpisodes + '/' + totalEpisodes,
            watched_count: watchedEpisodes,
            total_count: totalEpisodes,
            released_count: releasedEpisodes
        };

        var enrichedShow = enrichShowData(fullResponse, myshowsData);
        status.append('tmdb_' + index, enrichedShow);
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
        prepareProgressMarkers: prepareProgressMarkers,
        saveToFastAPI: saveToFastAPI,

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

    function updateAllMyShowsCards(originalName, newProgressMarker, withAnimation) {    
        var cards = document.querySelectorAll('.card');    
        for (var i = 0; i < cards.length; i++) {    
            var cardElement = cards[i];    
            var cardData = cardElement.card_data || {};    

            if ((cardData.original_title || cardData.original_name || cardData.name || cardData.title) === originalName &&     
                cardData.progress_marker) {    
                
                // Обновляем данные карточки    
                cardData.progress_marker = newProgressMarker;    
                
                if (withAnimation) {  
                    // Обновляем с анимацией только если флаг установлен  
                    updateCardWithAnimation(cardElement, newProgressMarker);    
                } else {  
                    // Обновляем без анимации - просто меняем текст  
                    var progressElement = cardElement.querySelector('.card__marker--progress span');  
                    if (progressElement) {  
                        progressElement.textContent = newProgressMarker;  
                    }  
                }  
            }    
        }    
    };

    Lampa.Listener.follow('activity', function(event) {  
        if (event.type === 'start' && event.component === 'full') {  
            // Сохраняем карточку, в которую зашли  
            var currentCard = event.object && event.object.card;  
            if (currentCard) {  
                Lampa.Storage.set('myshows_current_card', currentCard);  
            }  
        }  
        
        if (event.type === 'archive' && (event.component === 'main' || event.component === 'category')) {  
            var lastCard = Lampa.Storage.get('myshows_last_card', null);  
            var currentCard = Lampa.Storage.get('myshows_current_card', null);  
            var wasWatching = Lampa.Storage.get('myshows_was_watching', false);  
    
            if (lastCard && wasWatching) {  
                // Был просмотр - выполняем полную логику с таймаутом  
                var originalName = lastCard.original_name || lastCard.original_title || lastCard.title;  
                Lampa.Storage.set('myshows_was_watching', false);  
                
                setTimeout(function() {  
                    loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {  
                        var foundInAPI = false;  
                        var foundShow = null;  
                        
                        if (cachedResult && cachedResult.shows) {  
                            for (var i = 0; i < cachedResult.shows.length; i++) {  
                                var show = cachedResult.shows[i];  
                                if ((show.original_name || show.name || show.title) === originalName) {  
                                    foundShow = show;  
                                    break;  
                                }  
                            }  
                            
                            if (foundShow) {  
                                foundInAPI = true;  
                                
                                var existingCard = findExistingCard(originalName);  
                                
                                if (existingCard && foundShow.progress_marker) {  
                                    updateAllMyShowsCards(originalName, foundShow.progress_marker, true)
                                } else if (!existingCard) {  
                                    insertNewCardIntoMyShowsSection(foundShow);  
                                }  
                            }  
                        }  
                        if (!foundInAPI) {  
                            updateCompletedShowCard(originalName);  
                        }  
                    });  
                }, 2000);  
            } else if (currentCard) {  
                // Просто навигация - обновляем сразу без таймаута  
                var originalName = currentCard.original_name || currentCard.original_title || currentCard.title;  
                
                loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {  
                    if (cachedResult && cachedResult.shows) {  
                        var foundShow = cachedResult.shows.find(function(show) {  
                            return (show.original_name || show.name || show.title) === originalName;  
                        });  
                        
                        if (foundShow && foundShow.progress_marker) {  
                            // Обновляем UI  
                            updateAllMyShowsCards(originalName, foundShow.progress_marker, true)
                        }
                    }  
                });  
            }  
            
            // Очищаем сохраненную карточку после обработки  
            Lampa.Storage.remove('myshows_current_card');  
        }  
    });

    function updateCompletedShowCard(showName) {    
        var cards = document.querySelectorAll('.card');    
        console.log('[MyShows] Searching for card:', showName, 'Total cards:', cards.length);
        
        for (var i = 0; i < cards.length; i++) {    
            var cardElement = cards[i];    
            var cardData = cardElement.card_data || {};    
            
            var cardName = cardData.original_title || cardData.original_name || cardData.name || cardData.title;    
            console.log('[MyShows] Card', i, 'name:', cardName, 'has progress_marker:', !!cardData.progress_marker);
            if (cardName === showName && cardData.progress_marker) {  
                console.log('[MyShows] Found matching card for:', showName);   
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
                            method: isMovieContent(card_data) ? 'movie' : 'tv',   
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
                        myShowsData = myshowsCategory;  
                        
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

    ////// Статус сериалов. (Смотрю, Буду смотреть, Не смотрел) //////

    function createMyShowsButtons(e, currentStatus) {  
        var buttons = [  
            {   
                title: 'Смотрю',   
                status: 'watching',   
                class: 'myshows-watching', 
                icon: watch_icon 
            },  
            {   
                title: 'Буду смотреть',   
                status: 'later',   
                class: 'myshows-scheduled',  
                icon: later_icon
            },  
            {   
                title: 'Перестал смотреть',   
                status: 'cancelled',   
                class: 'myshows-thrown',  
                icon: cancelled_icon
            },  
            {   
                title: 'Не смотрю',   
                status: 'remove',   
                class: 'myshows-cancelled',  
                icon: remove_icon
            }  
        ];  
        
        buttons.forEach(function(buttonData) {  
            var isActive = currentStatus === buttonData.status;  
            var activeClass = isActive ? ' myshows-active' : '';  
            
            var btn = $('<div class="full-start__button selector ' + buttonData.class + activeClass + '">' +  
                buttonData.icon +  
                '<span>' + buttonData.title + '</span>' +  
                '</div>'); 

            btn.on('hover:focus', function() {  
                // Стандартное поведение фокуса Lampa  
            }); 
                
            btn.on('hover:enter', function() {  
                // Сначала снимаем выделение со всех кнопок MyShows  
                updateButtonStates(null);  
                
                setMyShowsStatus(e.data.movie, buttonData.status, function(success) {  
                    if (success) {  
                        Lampa.Noty.show('Статус "' + buttonData.title + '" установлен на MyShows');  
                        // Добавляем выделение на нажатую кнопку  
                        updateButtonStates(buttonData.status);  
                    } else {  
                        Lampa.Noty.show('Ошибка установки статуса');  
                        // При ошибке возвращаем предыдущее состояние  
                        updateButtonStates(currentStatus);  
                    }  
                });  
            }); 
            
            e.object.activity.render().find('.full-start-new__buttons').append(btn);  
        });  

        if (window.Lampa && window.Lampa.Controller) {    
            var container = e.object.activity.render().find('.full-start-new__buttons');  
            
            // Получаем все видимые кнопки  
            var allButtons = container.find('> *').filter(function(){  
                return $(this).is(':visible')  
            });  
            
            // Обновляем коллекцию Controller с новыми кнопками  
            Lampa.Controller.collectionSet(container);  
            
            // Восстанавливаем фокус на первой кнопке  
            if (allButtons.length > 0) {  
                Lampa.Controller.collectionFocus(allButtons.eq(0)[0], container);  
            }  
        } 
    }

    function updateButtonStates(newStatus) {  
        var buttons = document.querySelectorAll('.full-start__button[class*="myshows-"]');  
        
        buttons.forEach(function(button) {  
            // Сначала снимаем активное состояние со всех кнопок  
            button.classList.remove('myshows-active');  
            
            // Затем добавляем активное состояние только нужной кнопке  
            if (newStatus && (  
                (newStatus === 'watching' && button.classList.contains('myshows-watching')) ||  
                (newStatus === 'later' && button.classList.contains('myshows-scheduled')) ||  
                (newStatus === 'cancelled' && button.classList.contains('myshows-thrown')) ||  
                (newStatus === 'remove' && button.classList.contains('myshows-cancelled'))
            )) {  
                button.classList.add('myshows-active');  
            }  
        });  
    }

    function getShowStatus(showId, callback) {  
        loadCacheFromServer('serial_status', 'shows', function(showsData) {
            
            if (showsData) {
                var userShow = showsData.shows.find(function(item) {  
                    return item.id === showId;  
                }); 
                callback(userShow ? userShow.watchStatus : 'remove');
            } else {
                callback('remove');
            }
        }) 
    }

    function addMyShowsButtonStyles() {        
        var style = document.createElement('style');        
        style.textContent = `        
            .full-start-new__buttons .full-start__button.myshows-watching.myshows-active svg,      
            .full-start__buttons .full-start__button.myshows-watching.myshows-active svg {        
                color: #FFC107;        
                filter: drop-shadow(0 0 3px rgba(255, 193, 7, 0.8));        
            }        
            
            .full-start-new__buttons .full-start__button.myshows-scheduled.myshows-active svg,      
            .full-start__buttons .full-start__button.myshows-scheduled.myshows-active svg {        
                color: #2196F3;        
                filter: drop-shadow(0 0 3px rgba(33, 150, 243, 0.8));        
            }    
            
            .full-start-new__buttons .full-start__button.myshows-thrown.myshows-active svg,      
            .full-start__buttons .full-start__button.myshows-thrown.myshows-active svg {        
                color: #FF9800;        
                filter: drop-shadow(0 0 3px rgba(255, 152, 0, 0.8));        
            }    
            
            .full-start-new__buttons .full-start__button.myshows-cancelled.myshows-active svg,      
            .full-start__buttons .full-start__button.myshows-cancelled.myshows-active svg {        
                color: #F44336;        
                filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.8));        
            }        
        `;        
        document.head.appendChild(style);        
    }

    function getStatusTitle(showTitle, path, callback) {  
        
        loadCacheFromServer('serial_status', 'shows', function(showsData) {  
            if (showsData && showsData.shows) {  
                var userShow = showsData.shows.find(function(item) {  
                    // Ищем по точному совпадению названия или оригинального названия  
                    return item.title === showTitle ||   
                        item.titleOriginal === showTitle ||  
                        (item.title && item.title.toLowerCase() === showTitle.toLowerCase()) ||  
                        (item.titleOriginal && item.titleOriginal.toLowerCase() === showTitle.toLowerCase());  
                });  
                
                if (callback) {  
                    callback(userShow ? userShow.watchStatus : 'remove');  
                } else {  
                    return userShow ? userShow.watchStatus : 'remove';  
                }  
            } else {  
                if (callback) {  
                    callback('remove');  
                } else {  
                    return 'remove';  
                }  
            }  
        });  
    }

    Lampa.Listener.follow('full', function(e) {    
        if (e.type == 'complite') {    
            
            var isTV = e.data.movie.number_of_seasons ||     
                    e.data.movie.name ||     
                    e.object.method === 'tv';    
            
            if (!isTV) return;    
            
            var showTitle = e.data.movie.title || e.data.movie.name;    
            
            // Используем callback вместо синхронного вызова  
            getStatusTitle(showTitle, null, function(cachedStatus) {  
                if (!cachedStatus || cachedStatus === 'remove') {  
                    updateButtonStates('remove');  
                }  

                if (getProfileSetting('myshows_button_view', true)) {    
                    createMyShowsButtons(e, cachedStatus);   
                }
            });  
            
            // Асинхронно проверяем актуальность статуса    
            var alternativeTitles = [];
            if (e.data.movie && e.data.movie.alternative_titles && e.data.movie.alternative_titles.results) {  
                e.data.movie.alternative_titles.results.forEach(function(altTitle) {  
                    if (altTitle.iso_3166_1 === 'US' && altTitle.title) {  
                        alternativeTitles.push(altTitle.title);  
                    }  
                });  
            } 
            var imdbId = e.data.movie.imdb_id || (e.data.movie.ids && e.data.movie.ids.imdb);    
            var kinopoiskId = e.data.movie.kinopoisk_id || e.data.movie.kp_id || (e.data.movie.ids && e.data.movie.ids.kp);   
            var originalName = e.data.movie.original_name || e.data.movie.original_title || e.data.movie.title;   
            var year = e.data.movie.first_air_date.slice(0,4);  
            var tmdbId = e.data.movie.id;  
    
            // getShowIdByExternalIds(imdbId, kinopoiskId, showTitle, originalName, tmdbId, year, function(showId) {  
            getShowIdByExternalIds(imdbId, kinopoiskId, showTitle, originalName, tmdbId, year, alternativeTitles, function(showId) { 
                if (showId) {    
                    getShowStatus(showId, function(currentStatus) {    
                        updateButtonStates(currentStatus);    
                    });    
                }    
            });    
        }    
    });

    function addToHistory(contentData) {
        Lampa.Favorite.add('history', contentData)
    }

    ///// Статус фильмов 
    function createMyShowsMovieButtons(e, currentStatus) {  
        var buttons = [  
            {  
                title: 'Просмотрел',  
                status: 'finished',  
                class: 'myshows-movie-watched',  
                icon: watch_icon
            },  
            {  
                title: 'Буду смотреть',  
                status: 'later',  
                class: 'myshows-movie-later',  
                icon: later_icon
            },  
            {  
                title: 'Не смотрел',  
                status: 'remove',  
                class: 'myshows-movie-remove',  
                icon: remove_icon
            }  
        ];  
        
        buttons.forEach(function(buttonData) {  
            var isActive = currentStatus === buttonData.status;  
            var activeClass = isActive ? ' myshows-active' : '';  
            
            var btn = $('<div class="full-start__button selector ' + buttonData.class + activeClass + '">' +  
                buttonData.icon +  
                '<span>' + buttonData.title + '</span>' +  
                '</div>');  
            
            btn.on('hover:focus', function() {  
                // Стандартное поведение фокуса Lampa  
            });  
            
            btn.on('hover:enter', function() {  
                updateMovieButtonStates(null);  
                
                setMyShowsMovieStatus(e.data.movie, buttonData.status, function(success) {  
                    if (success) {  
                        Lampa.Noty.show('Статус "' + buttonData.title + '" установлен на MyShows');  
                        updateMovieButtonStates(buttonData.status);  
                    } else {  
                        Lampa.Noty.show('Ошибка установки статуса');  
                        var movieTitle = e.data.movie.original_title || e.data.movie.title;  
                    }  
                });  
            });  
            
            e.object.activity.render().find('.full-start-new__buttons').append(btn);  
        });  
        
        if (window.Lampa && window.Lampa.Controller) {    
            var container = e.object.activity.render().find('.full-start-new__buttons');  
            
            // Получаем все видимые кнопки  
            var allButtons = container.find('> *').filter(function(){  
                return $(this).is(':visible')  
            });  
            
            // Обновляем коллекцию Controller с новыми кнопками  
            Lampa.Controller.collectionSet(container);  
            
            // Восстанавливаем фокус на первой кнопке  
            if (allButtons.length > 0) {  
                Lampa.Controller.collectionFocus(allButtons.eq(0)[0], container);  
            }  
        } 
    }

    function Movies(body, callback) {
        makeMyShowsJSONRPCRequest(body, {
        }, function(success, movies) { 
            if (success && movies && movies.result) {
                callback(movies);
                return;
            } else {
                callback(null);
                return;
            }
        });
    }

    function getWatchedMovies(callback) {
        var body = 'profile.WatchedMovies';
        Movies(body, function(movies) {
            if (movies && movies.result) {
                callback(movies);
                return;
            } else {
                callback(null);
            }
        })
    }
    
    function getUnwatchedMovies(callback) {
        var body = 'profile.UnwatchedMovies';
        Movies(body, function(movies) {
            if (movies && movies.result) {
                callback(movies);
                return;
            } else {
                callback(null);
            }
        })
    }

    function fetchStatusMovies(callback) {
        getWatchedMovies(function(watchedData) {
            getUnwatchedMovies(function(unwatchedData) {
                var movies = [];
                processMovieData(watchedData, 'finished', movies);
                processMovieData(unwatchedData, 'later', movies);

                var statusData = {
                    movies: movies,
                    timestamp: Date.now() 
                }

                saveCacheToServer(statusData, 'movie_status', function(result) {
                    callback(result);
                })
            });
        });
    }

    function processMovieData(movieData, defaultStatus, targetArray) {
        if (movieData && movieData.result && Array.isArray(movieData.result)) {
            movieData.result.forEach(function(item) {
                if (item && item.id) {
                    targetArray.push({
                        id: item.id,
                        title: item.title,
                        titleOriginal: item.titleOriginal,
                        watchStatus: item.userMovie && item.userMovie.watchStatus ? item.userMovie.watchStatus : defaultStatus
                    })
                }
            })
        }
    }
    
    function getMovieStatusByTitle(movieTitle, callback) {  
        
        loadCacheFromServer('movie_status', 'movies', function(moviesData) {  
            if (moviesData && moviesData.movies) {  
                var userMovie = moviesData.movies.find(function(item) {  
                    return item.title === movieTitle ||  
                        item.titleOriginal === movieTitle ||  
                        (item.title && item.title.toLowerCase() === movieTitle.toLowerCase()) ||  
                        (item.titleOriginal && item.titleOriginal.toLowerCase() === movieTitle.toLowerCase());  
                });  
                
                if (callback) {  
                    callback(userMovie ? userMovie.watchStatus : 'remove');  
                } else {  
                    return userMovie ? userMovie.watchStatus : 'remove';  
                }  
            } else {  
                if (callback) {  
                    callback('remove');  
                } else {  
                    return 'remove';  
                }  
            }  
        });  
    }
    
    function updateMovieButtonStates(newStatus) {  
        var buttons = document.querySelectorAll('.full-start__button[class*="myshows-movie-"]');  
        
        buttons.forEach(function(button) {  
            button.classList.remove('myshows-active');  
            
            if (newStatus && (  
                (newStatus === 'finished' && button.classList.contains('myshows-movie-watched')) ||  
                (newStatus === 'later' && button.classList.contains('myshows-movie-later')) ||  
                (newStatus === 'remove' && button.classList.contains('myshows-movie-remove'))  
            )) {  
                button.classList.add('myshows-active');  
            }  
        });  
    }

    function addMyShowsMovieButtonStyles() {  
        var style = document.createElement('style');  
        style.textContent = `  
            .full-start-new__buttons .full-start__button.myshows-movie-watched.myshows-active svg,  
            .full-start__buttons .full-start__button.myshows-movie-watched.myshows-active svg {  
                color: #4CAF50;  
                filter: drop-shadow(0 0 3px rgba(76, 175, 80, 0.8));  
            }  
            
            .full-start-new__buttons .full-start__button.myshows-movie-later.myshows-active svg,  
            .full-start__buttons .full-start__button.myshows-movie-later.myshows-active svg {  
                color: #2196F3;  
                filter: drop-shadow(0 0 3px rgba(33, 150, 243, 0.8));  
            }  
            
            .full-start-new__buttons .full-start__button.myshows-movie-remove.myshows-active svg,  
            .full-start__buttons .full-start__button.myshows-movie-remove.myshows-active svg {  
                color: #F44336;  
                filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.8));  
            }  
        `;  
        document.head.appendChild(style);  
    }

    Lampa.Listener.follow('full', function(e) {  
        if (e.type == 'complite') {  

            var movie = e.data.movie;  
            var imdbId = movie.imdb_id || (movie.ids && movie.ids.imdb);    
            var kinopoiskId = movie.kinopoisk_id || movie.kp_id || (movie.ids && movie.ids.kp);
            
            // Проверяем тип контента  
            var isMovie = isMovieContent(e.data.movie);  
            
            if (isMovie) {    
                var movieTitle = e.data.movie.original_title || e.data.movie.title;    
                
                getMovieStatusByTitle(movieTitle, function(cachedStatus) {  
                    console.log('[MyShows] cachedStatus Movie', cachedStatus);  
                    
                    if (!cachedStatus || cachedStatus === 'remove') {  
                        updateMovieButtonStates('remove');  
                    }  

                    if (getProfileSetting('myshows_button_view', true)) {    
                        createMyShowsMovieButtons(e, cachedStatus);   
                    }
                });  
            }
        }  
    });

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
        initMyShowsCaches();  
        cleanupOldMappings();  
        initTimelineListener();    
        addProgressMarkerStyles();  
        addMyShowsToTMDB();  
        addMyShowsToCUB();  
        addMyShowsButtonStyles();  
        addMyShowsMovieButtonStyles();  
    } else {    
        Lampa.Listener.follow('app', function (event) {    
            if (event.type === 'ready') {    
                initSettings();    
                initMyShowsCaches();  
                cleanupOldMappings();  
                initTimelineListener();    
                addProgressMarkerStyles();  
                addMyShowsToTMDB();  
                addMyShowsToCUB();  
                addMyShowsButtonStyles();  
                addMyShowsMovieButtonStyles();  
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