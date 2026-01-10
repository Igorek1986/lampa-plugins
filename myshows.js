(function () {  
    'use strict';  

    var DEFAULT_ADD_THRESHOLD = '0';  
    var DEFAULT_MIN_PROGRESS = 90;    
    var API_URL = 'https://api.myshows.me/v3/rpc/';
    var MAP_KEY = 'myshows_hash_map';  
    var MYSHOWS_AUTH_PROXY = 'https://numparser.igorek1986.ru/myshows/auth';  
    var DEFAULT_CACHE_DAYS = 30;
    var JSON_HEADERS = {  
        'Content-Type': 'application/json'  
    };
    var AUTHORIZATION = 'authorization2'
    var syncInProgress = false;
    var myshows_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="3" /><line x1="12" y1="5" x2="7" y2="1" /><line x1="12" y1="5" x2="17" y2="1" /><circle cx="12" cy="6" r="1" /></svg>';
    var watch_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var later_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>';
    var remove_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';
    var cancelled_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" fill="currentColor"/></svg>';
    var IS_LAMPAC = null;
    var EPISODES_CACHE = {}; 

    function createLogMethod(emoji, consoleMethod) {
        var DEBUG = Lampa.Storage.get('myshows_debug_mode', false);
        if (!DEBUG) {
            return function() {};
        }

        return function() {
            var args = Array.prototype.slice.call(arguments);
            if (emoji) {
                args.unshift(emoji);
            }
            args.unshift('MyShows');
            consoleMethod.apply(console, args);
        };
    }

    var Log = {
        info: createLogMethod('ℹ️', console.log),
        error: createLogMethod('❌', console.error),
        warn: createLogMethod('⚠️', console.warn),
        debug: createLogMethod('🐛', console.debug)
    };

    function accountUrl(url) {  
        url = url + '';  
        if (url.indexOf('uid=') == -1) {  
            var uid = Lampa.Storage.get('account_email') || Lampa.Storage.get('lampac_unic_id');
            if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));  
        }  
        return url;  
    }  

    function getProfileId() {
        var lampaProfileId =
            Lampa.Account.Permit.account &&
            Lampa.Account.Permit.account.profile &&
            Lampa.Account.Permit.account.profile.id
                ? '_' + Lampa.Account.Permit.account.profile.id
                : '';

        if (IS_LAMPAC) {
            var lampacProfileId = Lampa.Storage.get('lampac_profile_id', '');

            if (lampacProfileId) {
                // ✅ Нормализация: всегда "_id"
                if (lampacProfileId[0] !== '_') {
                    lampacProfileId = '_' + lampacProfileId;
                }
                return lampacProfileId;
            }

            // fallback на профиль Lampa
            return lampaProfileId;
        }

        // Не LAMPAC → только профиль Lampa
        return lampaProfileId;
    }
    
    // Сохранение кеша с использованием профилей  
    function saveCacheToServer(cacheData, path, callback) {  
        Log.info('Save', 'Cache: ', cacheData, 'Path:', path);
        
        try {  
            var data = JSON.stringify(cacheData, null, 2);  

            var profileId = getProfileId();
            var uri = accountUrl('/storage/set?path=myshows/' + path + '&pathfile=' + profileId);  

            // 🟢 Для Android — если uri относительный, добавляем window.location.origin
            if (Lampa.Platform.is('android') && !/^https?:\/\//i.test(uri)) {
                uri = window.location.origin + (uri.indexOf('/') === 0 ? uri : '/' + uri);
                Log.info('Android 🧩 Fixed URI via window.location.origin:', uri);
            }

            if (!IS_LAMPAC) {
                Lampa.Storage.set('myshows_' + path + profileId, cacheData)
            } else {
                var network = new Lampa.Reguest();  
                network.native(uri, function(response) {  
                    if (response.success) {  
                        if (callback) callback(true);  
                    } else {  
                        Log.error('Storage error', response.msg);
                        if (callback) callback(false);   
                    }  
                }, function(error) {  
                    Log.error('Network error');
                    if (callback) callback(false);  
    
                }, data, {  
                    headers: JSON_HEADERS,  
                    method: 'POST'  
                });  
            }
        } catch(e) {  
            Log.error('Try error on saveCacheToServer', e.message);
            if (callback) callback(false);  
        }  
    }  
  
    // Загрузка кеша 
    function loadCacheFromServer(path, propertyName, callback) {  

        var profileId = getProfileId(); 

        if (!getProfileSetting('myshows_token')) {
            // не использовать кеш, не показывать маркеры
            return;
        }

        if (!IS_LAMPAC) {
            var result = Lampa.Storage.get('myshows_' + path + profileId);
            callback(result);
            return;
        } else {   
            var uri = accountUrl('/storage/get?path=myshows/' + path + '&pathfile=' + profileId);      
                
            var network = new Lampa.Reguest();      
            network.silent(uri, function(response) {      
                if (response.success && response.fileInfo && response.data) {      
                        var cacheData = JSON.parse(response.data);       
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
            var msg = 'Enter MyShows login and password';
            if (successCallback) {
                successCallback(null);
            } else {
                Lampa.Noty.show(msg);
            }
            return;
        }

        var network = new Lampa.Reguest();
        network.native(MYSHOWS_AUTH_PROXY, function(data) {
            if (data && data.token) {
                var token = data.token;
                setProfileSetting('myshows_token', token);
                Lampa.Storage.set('myshows_token', token, true);
                if (successCallback) {
                    successCallback(token);
                } else {
                    Lampa.Noty.show('✅ Auth success! Reboot...');
                    setTimeout(function() { window.location.reload(); }, 3000);
                }
            } else {
                fail('No token received');
            }
        }, function(xhr) {
            fail('Network error: ' + xhr.status);
        }, JSON.stringify({ login: login, password: password }), {
            headers: JSON_HEADERS,
        });

        function fail(msg) {
            if (successCallback) {
                successCallback(null);
            } else {
                Lampa.Noty.show('🔒 MyShows auth failed: ' + msg);
            }
        }
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
        Log.info('IS_LAMPAC:', IS_LAMPAC, 'baseKey: ', baseKey);
        var profileId = getProfileId();
        if (!profileId) {
            return baseKey;
        }

        return baseKey + '_profile' + profileId;
    }
  
    function getProfileSetting(key, defaultValue) {  
        return Lampa.Storage.get(getProfileKey(key), defaultValue);  
    }  
  
    function setProfileSetting(key, value) {  
        Log.info('Setting profile setting:', getProfileKey(key), value);
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
            setProfileSetting('myshows_sort_order', 'progress');    
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
        var sortOrderValue = getProfileSetting('myshows_sort_order', 'progress');  
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

        try {  
            if (Lampa.SettingsApi.removeComponent) {  
                Lampa.SettingsApi.removeComponent('myshows');  
            }  
        } catch (e) {}  

        Lampa.SettingsApi.addComponent({  
            component: 'myshows',  
            name: 'MyShows',  
            icon: myshows_icon
        });  

        loadProfileSettings();    
        autoSetupToken();
        var tokenValue = getProfileSetting('myshows_token', '');

        if (tokenValue) {
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
                    default: 'progress'    
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
        }

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

        var xhr = new XMLHttpRequest();  
        xhr.open('GET', '/timecode/batch_add', true);  
        
        xhr.onload = function() {  
            var isEnabled = xhr.status !== 404;  
            Log.info('✅ Модуль TimecodeUser ' + (isEnabled ? 'установлен' : 'не установлен'));  
            
            // Сразу добавляем настройки если модуль включен  
            if (isEnabled && IS_LAMPAC && tokenValue) {  
                Lampa.SettingsApi.addParam({  
                    component: 'myshows',  
                    param: {  
                        type: 'button'  
                    },  
                    field: {  
                        name: 'Синхронизация с Lampac'  
                    },  
                    onChange: function() {  
                        Lampa.Select.show({  
                            title: 'Синхронизация MyShows',  
                            items: [  
                                {  
                                    title: 'Синхронизировать',  
                                    subtitle: 'Добавить просмотренные фильмы и сериалы в историю Lampa.',  
                                    confirm: true  
                                },  
                                {  
                                    title: 'Отмена'  
                                }  
                            ],  
                            onSelect: function(item) {  
                                if (item.confirm) {  
                                    Lampa.Noty.show('Начинаем синхронизацию...');  
                                    syncMyShows(function(success, message) {  
                                        if (success) {  
                                            Lampa.Noty.show(message);  
                                        } else {  
                                            Lampa.Noty.show('Ошибка: ' + message);  
                                        }  
                                    });  
                                }  
                                Lampa.Controller.toggle('settings_component');  
                            },  
                            onBack: function() {  
                                Lampa.Controller.toggle('settings_component');  
                            }  
                        });  
                    }  
                });  
            }  
        };  
        
        xhr.onerror = function(e) {  
            Log.info('❌ Ошибка проверки модуля: ' + e.type);  
        }; 
        
        xhr.send();  

        if (!tokenValue) {  
            Lampa.SettingsApi.addParam({    
                component: 'myshows',    
                param: {    
                    type: 'static'  
                },    
                field: {    
                    name: '📋 После авторизации станут доступны:', 
                    description: '• Показ непросмотренных сериалов на главной странице<br>• Настройки сортировки<br>• Управление порогами просмотра<br>• Дополнительные настройки'   
                }    
            });  
        }
    }  


    if (IS_LAMPAC && Lampa.Storage.get('lampac_profile_id')) {
        var originalProfileWaiter = window.__profile_extra_waiter;
        var myshowsProfileSynced = false; // Флаг синхронизации
        var currentProfileId = ''; // Текущий ID профиля
    
        window.__profile_extra_waiter = function() {
            var synced = myshowsProfileSynced;
            
            if (typeof originalProfileWaiter === 'function') {
                synced = synced && originalProfileWaiter();
            }
            
            return synced;
        };
    }

    function handleProfileChange() {
        Log.info('Checking for profile change...');
        // Сбрасываем флаг синхронизации при смене профиля
        myshowsProfileSynced = false;
        Log.info('myshowsProfileSynced', myshowsProfileSynced);
        
        var newProfileId = getProfileId();
        Log.info('Current Profile ID:', currentProfileId, 'New Profile ID:', newProfileId);
        
        // Если профиль не изменился, выходим
        if (currentProfileId === newProfileId) {
            myshowsProfileSynced = true;
            return;
        }
        
        // Сохраняем новый ID профиля
        currentProfileId = newProfileId;
        
        Log.info('🔄 Profile changed to:', newProfileId);
        
        // Пересоздаем настройки для нового профиля
        initSettings();

        // Очищаем кешированные данные
        cachedShuffledItems = {};

        // Проверяем текущую активность - если мы в MyShows, но в новом профиле нет токена
        var currentActivity = Lampa.Activity.active();
        var newToken = getProfileSetting('myshows_token', '');
        
        // Если мы находимся в компоненте MyShows и в новом профиле нет токена
        if (currentActivity && 
            currentActivity.component && 
            currentActivity.component.indexOf('myshows_') === 0 && 
            !newToken) {
            
            Log.info('Switched from MyShows to profile without token, redirecting to start page');
            
            // Получаем тип стартовой страницы  
            var start_from = Lampa.Storage.field("start_page");  
            Log.info('start_from:', start_from);
            
            // Получаем сохраненную активность  
            var active = Lampa.Storage.get('activity','false');  
            Log.info('active:', active);
            
            // Определяем параметры на основе настроек  
            var startParams;  
            
            if(window.start_deep_link){  
                startParams = window.start_deep_link;  
            } else if(active && start_from === "last"){  
                startParams = active;  
            } else {  
                // По умолчанию главная страница  
                startParams = {  
                    url: '',  
                    title: Lang.translate('title_main') + ' - ' + Storage.field('source').toUpperCase(),  
                    component: 'main',  
                    source: Storage.field('source'),  
                    page: 1  
                };  
            }
            Log.info('startParams:', startParams);
            
            // Перенаправляем на стартовую страницу с небольшой задержкой
            setTimeout(function() {
                Lampa.Activity.replace(startParams);
                Lampa.Noty.show('Профиль изменен. Нет данных MyShows в этом профиле');
                myshowsProfileSynced = true; // Синхронизация завершена
            }, 1000);
        } else {
            // Если есть токен или мы не в компоненте MyShows
            // Загружаем данные для нового профиля
            if (newToken) {
                // Асинхронно загружаем данные
                setTimeout(function() {
                    try {
                        // Инициализируем кеши для нового профиля
                        initMyShowsCaches();
                        Log.info('✅ MyShows data loaded for profile:', newProfileId);
                    } catch (e) {
                        Log.error('Error loading MyShows data:', e);
                    }
                    myshowsProfileSynced = true; // Синхронизация завершена
                }, 500);
            } else {
                // Нет токена - синхронизация завершена
                myshowsProfileSynced = true;
                Log.info('✅ No MyShows token for this profile');
            }
        }
        
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
            if (sortSelect) sortSelect.value = getProfileSetting('myshows_sort_order', 'progress');

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

    function initCurrentProfile() {        
        currentProfileId = getProfileId();
        // Устанавливаем флаг синхронизации в true при старте
        myshowsProfileSynced = true;
        
        Log.info('📊 Current profile initialized:', currentProfileId);
    }

    // Обновляем UI при смене профиля Lampa
    Lampa.Listener.follow('state:changed', function(e) {  
        if (e.target === 'favorite' && e.reason === 'profile') {   
            handleProfileChange();  
        }  
    });
    
    // Обновляем UI при смене профиля Lampac
    Lampa.Listener.follow('profile', function(e) {
        if (e.type === 'changed') {
            handleProfileChange();  
        }
    });

    function getShowIdByExternalIds(imdbId, kinopoiskId, title, originalTitle, tmdbId, year, alternativeTitles, callback) {
        Log.info('getShowIdByExternalIds started with params:', {
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
                Log.info('Found by IMDB ID:', imdbResult);
                return callback(imdbResult);
            }

            // 2. Пробуем найти по Kinopoisk
            getShowIdByKinopiskId(kinopoiskId, function(kinopoiskResult) {
                if (kinopoiskResult) {
                    Log.info('Found by Kinopoisk ID:', kinopoiskResult);
                    return callback(kinopoiskResult);
                }

                // 3. Для азиатского контента - специальная логика
                if (isAsianContent(originalTitle)) {
                    handleAsianContent(originalTitle, tmdbId, year, alternativeTitles, callback);
                } else {
                    // 4. Для неазиатского контента - прямой поиск
                    Log.info('Non-Asian content, searching by original title:', originalTitle);
                    getShowIdByOriginalTitle(originalTitle, year, callback);
                }
            });
        });
    }

    // Выносим логику для азиатского контента в отдельную функцию
    function handleAsianContent(originalTitle, tmdbId, year, alternativeTitles, callback) {
        Log.info('Is Asian content: true for originalTitle:', originalTitle);

        // 1. Пробуем альтернативные названия
        if (alternativeTitles && alternativeTitles.length > 0) {
            Log.info('Trying alternative titles:', alternativeTitles);
            tryAlternativeTitles(alternativeTitles, 0, year, function(altResult) {
                if (altResult) {
                    Log.info('Found by alternative title:', altResult);
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
        Log.info('Trying getEnglishTitle fallback');
        
        getEnglishTitle(tmdbId, true, function(englishTitle) {
            if (englishTitle) {
                Log.info('getEnglishTitle result:', englishTitle);
                
                // Пробуем поиск по английскому названию
                getShowIdByOriginalTitle(englishTitle, year, function(englishResult) {
                    if (englishResult) {
                        Log.info('Found by English title:', englishResult);
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
        Log.info('Fallback to original title:', originalTitle);
        getShowIdByOriginalTitle(originalTitle, year, function(finalResult) {
            Log.info('Final result:', finalResult);
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
        makeMyShowsJSONRPCRequest('shows.GetCatalog', {  
            search: { 
                "query": title,
                "year": parseInt(year)
            }  
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
                search: { 
                    "query": title,
                    "year": parseInt(year)
                }
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
        var identifiers = getCardIdentifiers(cardData);
        if (!identifiers) {
            callback(false);
            return;
        }
        
        getShowIdByExternalIds(
            identifiers.imdbId, 
            identifiers.kinopoiskId, 
            identifiers.title, 
            identifiers.originalName, 
            identifiers.tmdbId, 
            identifiers.year, 
            identifiers.alternativeTitles,  
            function(showId) {
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
                    // Сбрасываем кеш
                    cachedShuffledItems = {};
                    
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
                    var status = item.watchStatus;  
                    
                    if (status === 'finished') {  
                        status = 'watching';  
                    }  
                    
                    return {    
                        id: item.show.id,    
                        title: item.show.title,    
                        titleOriginal: item.show.titleOriginal,    
                        watchStatus: status    
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
    
            var showsData = {};    
            var shows = [];    
            var myshowsIndex = {};  
            
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
            
            // Преобразуем в массив и создаём last_episode_to_myshows  
            for (var showId in showsData) {    
                var showData = showsData[showId];  
                
                // Первый элемент unwatchedEpisodes - это последний вышедший эпизод  
                var lastEpisode = showData.episodes[0];  
                var last_episode_to_myshows = null;  
                
                if (lastEpisode) {  
                    last_episode_to_myshows = {  
                        season_number: lastEpisode.seasonNumber,  
                        episode_number: lastEpisode.episodeNumber,  
                        air_date: lastEpisode.airDate,  
                        air_date_utc: lastEpisode.airDateUTC  
                    };  
                }  
                
                var key = (showData.show.titleOriginal || showData.show.title).toLowerCase();  
                myshowsIndex[key] = {  
                    myshowsId: showData.show.id,  
                    unwatchedCount: showData.unwatchedCount,  
                    unwatchedEpisodes: showData.episodes,  
                    last_episode_to_myshows: last_episode_to_myshows  
                };  
                
                shows.push({    
                    myshowsId: showData.show.id,    
                    title: showData.show.title,    
                    originalTitle: showData.show.titleOriginal,    
                    year: showData.show.year,    
                    unwatchedCount: showData.unwatchedCount,    
                    unwatchedEpisodes: showData.episodes,  
                    last_episode_to_myshows: last_episode_to_myshows  
                });    
            }    
            
            // Получаем данные TMDB и объединяем  
            getTMDBDetails(shows, function(result) {    
                if (result && result.shows) {  
                    
                    for (var i = 0; i < result.shows.length; i++) {  
                        var tmdbShow = result.shows[i];  
                        var key = (tmdbShow.original_title || tmdbShow.original_name ||   
                                tmdbShow.title || tmdbShow.name).toLowerCase();  
                        
                        if (myshowsIndex[key]) {  
                            tmdbShow.myshowsId = myshowsIndex[key].myshowsId;  
                            tmdbShow.unwatchedCount = myshowsIndex[key].unwatchedCount;  
                            // tmdbShow.unwatchedEpisodes = myshowsIndex[key].unwatchedEpisodes;  
                            tmdbShow.last_episode_to_myshows = myshowsIndex[key].last_episode_to_myshows;  

                        }  
                    }  
                    
                    var cacheData = {    
                        shows: result.shows,    
                    };    
                    

                    saveCacheToServer(cacheData, 'unwatched_serials', function(result) {});    
                }    
                callback(result);    
            });    
        });    
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
                    // Сбрасываем кеш 
                    cachedShuffledItems = {};

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

    function normalizeForComparison(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')  // декомпозиция: é → e +  ́
            .replace(/[\u0300-\u036f]/g, '')  // удаляем все комбинирующие знаки
            .trim();
    }

    function getMovieCandidates(data, title, year, callback) {
        var candidates = [];
        for (var i = 0; i < data.length; ++i) {
            try {
                var movie = data[i].movie;
                if (!movie) {
                    continue
                }
                var titleMatch = movie.titleOriginal && normalizeForComparison(movie.titleOriginal.toLowerCase()) === normalizeForComparison(title.toLowerCase());
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
            callback(candidate ? candidate.id : null);    
        })
    }

    function getShowCandidates(data, title, year, callback) {    
        Log.info('getShowCandidates called with:', {  
            dataLength: data.length,  
            title: title,  
            year: year
        });  
        
        var candidates = [];    
        
        for (var i = 0; i < data.length; ++i) {    
            try {    
                var item = data[i];
                if (!item || !item.show) {  
                    continue;    
                }    
                
                var show = item.show;
                
                // Нормализация для сравнения
                var titleMatch = show.titleOriginal && 
                    normalizeForComparison(show.titleOriginal.toLowerCase()) === 
                    normalizeForComparison(title.toLowerCase());
                    
                var yearMatch = show.year == year;
        
                Log.info('Checking show:', {  
                    id: show.id,  
                    titleOriginal: show.titleOriginal,
                    normalizedShowTitle: show.titleOriginal ? normalizeForComparison(show.titleOriginal.toLowerCase()) : 'null',
                    normalizedInputTitle: normalizeForComparison(title.toLowerCase()),
                    titleMatch: titleMatch,
                    year: show.year,  
                    yearMatch: yearMatch  
                });  
        
                // Точное совпадение по названию и году
                if (titleMatch && yearMatch) {    
                    candidates.push(show);    
                    Log.info('Added exact match candidate:', show.id);  
                }    
            } catch (e) {    
                Log.error('Error processing show:', e);  
                callback(null);    
                return;    
            }    
        }    
    
        Log.info('Found candidates:', candidates.length);  
    
        if (candidates.length === 0) {    
            callback(null);    
        } else if (candidates.length == 1) {    
            Log.info('Returning single candidate:', candidates[0].id);  
            callback(candidates[0].id);    
        } else {    
            Log.info('Multiple candidates, getting best one');  
            getBestShowCandidate(candidates, function(candidate) {    
                callback(candidate ? candidate.id : null);    
            });    
        }    
    }

    function getBestMovieCandidate(candidates, callback) {  
        
        for (var i = 0; i < candidates.length; i++) {  
            var candidate = candidates[i];  
            
            if (!candidate.releaseDate) continue;  
            
            try {  
                var parts = candidate.releaseDate.split('.');  
                if (parts.length !== 3) continue;  
                
                var myShowsDate = new Date(parts[2], parts[1]-1, parts[0]);  
                myShowsDate.setHours(0, 0, 0, 0);
                
                var card = getCurrentCard();  
                if (!card || !card.release_date) continue;  
                
                var tmdbDate = new Date(card.release_date);  
                tmdbDate.setHours(0, 0, 0, 0); 
                
                if (myShowsDate.getTime() === tmdbDate.getTime()) {  
                    callback(candidate);  
                    return;  
                }  
                
            } catch(e) {  
                Log.info('Date parsing error:', e);  
                continue;  
            }  
        }  
        
        Log.info('No matching candidate found');  
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
                myShowsDate.setHours(0, 0, 0, 0);

                
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
                tmdbDate.setHours(0, 0, 0, 0); 
    
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
        var apiUrl = (isSerial ? 'tv' : 'movie') + '/' + tmdbId +   
                    '?api_key=' + Lampa.TMDB.key() +   
                    '&language=en';  
    
        var tmdbNetwork = new Lampa.Reguest();  
        tmdbNetwork.silent(Lampa.TMDB.api(apiUrl), function (response) {
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
        Log.info('tryAlternativeTitles - index:', index, 'of', titles.length, 'titles');  
        
        if (index >= titles.length) {  
            Log.info('tryAlternativeTitles - all titles exhausted');  
            callback(null);  
            return;  
        }  
        
        var currentTitle = titles[index];  
        Log.info('tryAlternativeTitles - trying title:', currentTitle, 'year:', year);  
        
        getShowIdByOriginalTitle(currentTitle, year, function(myshows_id) {  
            Log.info('tryAlternativeTitles - result for "' + currentTitle + '":', myshows_id);  
            
            if (myshows_id) {  
                Log.info('tryAlternativeTitles - SUCCESS with title:', currentTitle);  
                callback(myshows_id);  
            } else {  
                Log.info('tryAlternativeTitles - failed with "' + currentTitle + '", trying next');  
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
            var hashStr = '' + ep.seasonNumber + (ep.seasonNumber > 10 ? ':' : '') + ep.episodeNumber + originalName; 
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
        var identifiers = getCardIdentifiers(card);
        if (!identifiers) {
            callback({});
            return;
        }
        
        var imdbId = identifiers.imdbId;
        var kinopoiskId = identifiers.kinopoiskId;
        var showTitle = identifiers.title;
        var originalName = identifiers.originalName;
        var year = identifiers.year;
        var tmdbId = identifiers.tmdbId;
        var alternativeTitles = identifiers.alternativeTitles;
        
        if (!originalName) {
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

            Log.info('ensureHashMap showId', showId)
            
            getEpisodesByShowId(showId, token, function(episodes) {
                var newMap = buildHashMap(episodes, originalName);

                // Сохраняем mapping
                for (var k in newMap) {
                    if (newMap.hasOwnProperty(k)) {
                        map[k] = newMap[k];
                    }
                }
                EPISODES_CACHE[originalName] = map;
                Log.info('EPISODES_CACHE', EPISODES_CACHE[originalName]);
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

    function getCardIdentifiers(card) {
        if (!card) {
            Log.warn('extractCardIdentifiers: card is null');
            return null;
        }
        
        var alternativeTitles = [];
        try {
            if (card.alternative_titles && card.alternative_titles.results) {  
                card.alternative_titles.results.forEach(function(altTitle) {  
                    if (altTitle.iso_3166_1 === 'US' && altTitle.title) {  
                        alternativeTitles.push(altTitle.title);  
                    }  
                });  
            }
        } catch (e) {
            Log.warn('Error extracting alternative titles:', e);
        }
        
        return {
            imdbId: card.imdb_id || card.imdbId || (card.ids && card.ids.imdb),
            kinopoiskId: card.kinopoisk_id || card.kp_id || (card.ids && card.ids.kp),
            title: card.title || card.name,
            originalName: card.original_name || card.original_title || card.title,
            year: card.first_air_date ? card.first_air_date.slice(0,4) : 
                (card.release_date ? card.release_date.slice(0,4) : null),
            tmdbId: card.id,
            alternativeTitles: alternativeTitles
        };
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
                        checkMovieMyShows(movieId, function(success) {
                            if (success) {
                                cachedShuffledItems = {}; 
                                fetchStatusMovies(function(data) {})
                            }
                        });
                    }
                });
            }
        } else {  
            ensureHashMap(card, token, function(map) {    
                var episodeId = map[hash] && map[hash].episodeId ? map[hash].episodeId : map[hash];  

                if (episodeId) {
                    Log.info('episodeId есть в Local Storage', episodeId);
                }
                
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
                        } else {
                            Log.info('Нет newEpisodeId — ищем в EPISODES_CACHE');
                            var originalName = card.original_name || card.original_title || card.title;
                            var episodes_hash = EPISODES_CACHE[originalName];
                            var episodeId = null;
                            
                            if (episodes_hash) {
                                Log.info('episodes_hash', episodes_hash);
                                for (var epHash in episodes_hash) {
                                    // Проверяем, что свойство принадлежит самому объекту, а не прототипу
                                    if (episodes_hash.hasOwnProperty(epHash)) {
                                        Log.info('Сравниваем epHash:', epHash, 'с искомым hash:', hash);
                                        
                                        // Сравниваем хеши
                                        if (epHash == hash) {
                                            // Нашли совпадение!
                                            var episodeData = episodes_hash[epHash];
                                            episodeId = episodeData.id; // или episodeData.id, смотря что в объекте
                                            Log.info('Найден episodeId:', episodeId);
                                            break; // Выходим из цикла
                                        }
                                    }
                                }
                            }

                            if (episodeId) {
                                processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold);
                            } else {
                                Log.warn('❌ Не найден episodeId даже в EPISODES_CACHE для хеша:', hash);
                            }
                        }
                    });  
                    return;  
                }  
                 Log.info('CheckEpisode episodeId', episodeId);
                
                processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold);  
            });   
        } 
    }  

    function processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold) { 
        
        var originalName = card.original_name || card.original_title || card.title;      
        var firstEpisodeHash = Lampa.Utils.hash('11' + originalName);     
        
        // Проверяем, нужно ли добавить сериал в "Смотрю"  
        if (hash === firstEpisodeHash && percent >= addThreshold) {    
 
            setMyShowsStatus(card, 'watching', function(success) {
                cachedShuffledItems = {}; 
                // Обновляем кеш только если НЕ достигнут minProgress    
                if (success && percent < minProgress) {
                    fetchFromMyShowsAPI(function(data) {});
                    fetchShowStatus(function(data) {});
                }
            });  

        } else if (addThreshold === 0 && hash === firstEpisodeHash) {    
   
            setMyShowsStatus(card, 'watching', function(success) {
                // Обновляем кеш только если НЕ достигнут minProgress    
                if (success && percent < minProgress) {
                    fetchFromMyShowsAPI(function(data) {});
                    fetchShowStatus(function(data) {});
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

    function getUnwatchedShowsWithDetails(callback, show) {     
        Log.info('getUnwatchedShowsWithDetails called');      
        
        if (IS_LAMPAC) {  
            // Используем кеширование только в Lampac  
            loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {      
                Log.info('Cache result:', cachedResult);      
                if (cachedResult) {        
                    callback(cachedResult);     
                } else {  
                    fetchFromMyShowsAPI(function(freshResult) {  
                        Log.info('API result (no cache):', freshResult);      
                        callback(freshResult);      
                    });      
                }   
            });      
        } else {  
            Log.info('Not Lampac, using direct API');      
            fetchFromMyShowsAPI(function(freshResult) {  
                Log.info('Direct API result:', freshResult);      
                callback(freshResult);      
            });      
        }   
    }

    function updateUIIfNeeded(oldShows, newShows) {  
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
                Log.info('Adding new show:', newKey);  
                
                // ✅ Проверяем, есть ли карточка в DOM  
                var existingCard = findCardInMyShowsSection(newKey);  
                if (!existingCard) {  
                    insertNewCardIntoMyShowsSection(newShowsMap[newKey]);  
                } else {  
                    Log.info('Card already exists in DOM:', newKey);  
                    // Обновляем данные существующей карточки  
                    existingCard.card_data = existingCard.card_data || {};  
                    existingCard.card_data.progress_marker = newShowsMap[newKey].progress_marker;  
                    existingCard.card_data.next_episode = newShowsMap[newKey].next_episode;  
                    existingCard.card_data.remaining = newShowsMap[newKey].remaining;
                    addProgressMarkerToCard(existingCard, existingCard.card_data);  
                }  
            }  
        }  
        
        // Удаляем завершенные сериалы  
        for (var oldKey in oldShowsMap) {  
            if (!newShowsMap[oldKey]) {  
                Log.info('Removing completed show:', oldKey);  
                updateCompletedShowCard(oldKey);  
            }  
        }  
        
        // Обновляем прогресс существующих  
        for (var key in newShowsMap) {  
            if (oldShowsMap[key]) {  
                var oldShow = oldShowsMap[key];  
                var newShow = newShowsMap[key];  
                
                if (oldShow.progress_marker !== newShow.progress_marker ||   
                    oldShow.next_episode !== newShow.next_episode) {  
                    Log.info('Updating show:', key);  
                    updateAllMyShowsCards(key, newShow.progress_marker, newShow.next_episode, newShow.remaining);  
                }  
            }  
        }  
    }

    function enrichShowData(fullResponse, myshowsData) {  
        var enriched = Object.assign({}, fullResponse);  
        
        if (myshowsData) {  
            enriched.progress_marker = myshowsData.progress_marker;  
            enriched.remaining = myshowsData.remaining;  
            enriched.watched_count = myshowsData.watched_count;  
            enriched.total_count = myshowsData.total_count;  
            enriched.released_count = myshowsData.released_count;  
            enriched.next_episode = myshowsData.next_episode; 
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

            var sortOrder = getProfileSetting('myshows_sort_order', 'progress');

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
            function cleanTitle(title) {
                if (!title) return '';
                // Убираем суффиксы в скобках: (JP), (RU), и т.д.
                return title.replace(/\s*\([^)]*\)\s*$/, '').trim();
            }
            
            var originalTitle = currentShow.originalTitle || currentShow.title;
            var cleanedTitle = cleanTitle(currentShow.originalTitle) || cleanTitle(currentShow.title);
            
            var searchIndex = 0;
            var searchAttempts = [];
            
            // Добавляем варианты в порядке приоритета
            // 1. Оригинальное название (например, "One Piece (JP)")
            if (originalTitle) {
                searchAttempts.push(originalTitle);
            }
            
            // 2. Очищенное название (например, "One Piece") - только если отличается
            if (cleanedTitle && cleanedTitle !== originalTitle) {
                searchAttempts.push(cleanedTitle);
            }
            
            // Убираем дубликаты (на всякий случай)
            searchAttempts = searchAttempts.filter(function(query, idx, self) {
                return self.indexOf(query) === idx;
            });
            
            Log.info('Поиск TMDB для:', currentShow.title, 
                    'Варианты:', searchAttempts);
            
            function trySearch() {
                if (searchIndex >= searchAttempts.length) {
                    // Все варианты исчерпаны
                    Log.warn('Не найдено в TMDB:', currentShow.title);
                    status.append('tmdb_' + index, null);
                    return;
                }
                
                var searchQuery = searchAttempts[searchIndex];
                searchIndex++;
                
                var searchUrl = 'search/tv' +
                    '?api_key=' + Lampa.TMDB.key() +
                    '&query=' + encodeURIComponent(searchQuery) +
                    '&year=' + currentShow.year +
                    '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');
                
                Log.info('TMDB попытка', searchIndex + '/' + searchAttempts.length + 
                        ':', currentShow.title, '->', searchQuery);
                
                var network = new Lampa.Reguest();
                network.silent(Lampa.TMDB.api(searchUrl), function (searchResponse) {
                    if (searchResponse && searchResponse.results && searchResponse.results.length > 0) {
                        var foundShow = searchResponse.results[0];
                        Log.info('Найдено:', foundShow.name, '(ID:', foundShow.id + ')');
                        enrichTMDBShow(foundShow, currentShow, index, status);
                    } else {
                        Log.info('Не найдено, пробуем следующий вариант для:', currentShow.title);
                        // Пробуем следующий вариант
                        trySearch();
                    }
                }, function (error) {
                    Log.error('Ошибка запроса TMDB для:', searchQuery, error);
                    // При ошибке пробуем следующий вариант
                    trySearch();
                });
            }
            
            // Начинаем поиск
            trySearch();
        }

    function enrichTMDBShow(foundShow, currentShow, index, status) {
        var fullUrl = 'tv/' + foundShow.id +
            '?api_key=' + Lampa.TMDB.key() +
            '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');

        var fullNetwork = new Lampa.Reguest();
        fullNetwork.silent(Lampa.TMDB.api(fullUrl), function (fullResponse) {
            if (!fullResponse || !fullResponse.seasons) {
                return status.append('tmdb_' + index, foundShow);
            }

            // 🔥 Параллельно получаем данные от MyShows
            getMyShowsEpisodesCount(foundShow, currentShow, fullResponse, function(myShowsData) {
                if (myShowsData) {
                    // Используем данные MyShows
                    Log.info('Используем данные MyShows для', foundShow.name, {
                        total: myShowsData.totalEpisodes,
                        released: myShowsData.releasedEpisodes
                    });
                    
                    // Сразу вызываем appendEnriched с данными MyShows
                    appendEnriched(fullResponse, foundShow, currentShow, 
                                myShowsData.totalEpisodes, 
                                myShowsData.releasedEpisodes, 
                                index, status);
                }
            });
        });
    }

    function getMyShowsEpisodesCount(foundShow, currentShow, fullResponse, callback) {
        // Пробуем использовать myshowsId из currentShow
        var showId = currentShow && currentShow.myshowsId;
        
        if (!showId) {
            // Если нет, ищем по TMDB данным
            var identifiers = {
                imdbId: fullResponse.external_ids ? fullResponse.external_ids.imdb_id : null,
                title: fullResponse.name,
                originalName: fullResponse.original_name,
                tmdbId: fullResponse.id,
                year: fullResponse.first_air_date ? fullResponse.first_air_date.substring(0, 4) : null
            };
            
            getShowIdByExternalIds(
                identifiers.imdbId,
                null,
                identifiers.title,
                identifiers.originalName,
                identifiers.tmdbId,
                identifiers.year,
                null,
                function(foundId) {
                    if (foundId) {
                        fetchEpisodes(foundId);
                    } else {
                        callback(null);
                    }
                }
            );
            return;
        }
        
        fetchEpisodes(showId);
        
        function fetchEpisodes(showId) {
            var token = getProfileSetting('myshows_token', '');
            if (!token) {
                callback(null);
                return;
            }
            
            getEpisodesByShowId(showId, token, function(episodes) {
                if (!episodes || episodes.length === 0) {
                    callback(null);
                    return;
                }
                
                var now = new Date();
                var released = 0;
                var regular = 0;
                var specials = 0;
                var specialsReleased = 0;
                
                for (var i = 0; i < episodes.length; i++) {
                    var ep = episodes[i];
                    
                    if (ep.episodeNumber === 0) {
                        specials++;
                        
                        var airDateSpecial = ep.airDateUTC ? new Date(ep.airDateUTC) : 
                                        ep.airDate ? new Date(ep.airDate) : null;
                        
                        if (!airDateSpecial || airDateSpecial <= now) {
                            specialsReleased++;
                        }
                    } else {
                        regular++;
                        
                        var airDate = ep.airDateUTC ? new Date(ep.airDateUTC) : 
                                    ep.airDate ? new Date(ep.airDate) : null;
                        
                        if (!airDate || airDate <= now) {
                            released++;
                        }
                    }
                }

                Log.info('Статистика эпизодов для', fullResponse.name + ':', {
                    всего: episodes.length,
                    обычных: regular,
                    вышедших_обычных: released,
                    специальных: specials,
                    вышедших_специальных: specialsReleased
                });
                
                callback({
                    totalEpisodes: regular,
                    releasedEpisodes: released,
                    specialEpisodes: specials,
                    releasedSpecialEpisodes: specialsReleased
                });
            });
        }
    }

    function appendEnriched(fullResponse, foundShow, currentShow, totalEpisodes, releasedEpisodes, index, status) {  
        var watchedEpisodes = Math.max(0, releasedEpisodes - currentShow.unwatchedCount);  
        var remainingEpisodes = releasedEpisodes - watchedEpisodes;
        
        // ✅ Находим следующую непросмотренную серию  
        var nextEpisode = null;  
        if (currentShow.unwatchedEpisodes && currentShow.unwatchedEpisodes.length > 0) {  
            var lastUnwatched = currentShow.unwatchedEpisodes[currentShow.unwatchedEpisodes.length - 1];  
            
            // ✅ Форматируем "s04e07" → "S04 E07"  
            var shortName = lastUnwatched.shortName; // "s04e07"  
            if (shortName) {  
                // Используем регулярное выражение для разбора формата sXXeYY  
                var match = shortName.match(/s(\d+)e(\d+)/i);  
                if (match) {  
                    var season = match[1].padStart(2, '0');  // "04"  
                    var episode = match[2].padStart(2, '0'); // "07"  
                    nextEpisode = 'S' + season + '/E' + episode; // "S04 E07"  
                } else {  
                    nextEpisode = shortName.toUpperCase(); // Запасной вариант  
                }  
            }  
        }  
    
        var myshowsData = {  
            progress_marker: watchedEpisodes + '/' + releasedEpisodes,  
            remaining: remainingEpisodes,
            watched_count: watchedEpisodes,  
            total_count: totalEpisodes,  
            released_count: releasedEpisodes,  
            next_episode: nextEpisode  // ✅ Добавляем следующую серию  
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

    window.MyShows = {
        getUnwatchedShowsWithDetails: getUnwatchedShowsWithDetails,

    };

    function updateCardWithAnimation(cardElement, newText, markerClass) {
        Log.info('>>> updateCardWithAnimation START:', {
            cardElement: cardElement ? 'found' : 'null',
            newText: newText,
            markerClass: markerClass
        });
        
        if (!cardElement || !markerClass) {
            Log.warn('updateCardWithAnimation: missing cardElement or markerClass');
            return;
        }
        
        if (typeof newText !== 'string') {
            Log.warn('Invalid newText type:', typeof newText, newText);
            return;
        }
        
        var marker = cardElement.querySelector('.' + markerClass);
        if (!marker) {
            Log.info('Marker not found:', markerClass, 'in card');
            return;
        }
        
        var oldText = marker.textContent || '';
        Log.info('Old text:', oldText, 'New text:', newText);
        
        if (oldText && oldText === newText) {
            Log.info('Text unchanged, skipping animation');
            return;
        }
        
        // Новый маркер
        if (!oldText) {
            Log.info('New marker created');
            marker.textContent = newText;
            marker.classList.add('digit-animating');
            setTimeout(function() {
                marker.classList.remove('digit-animating');
            }, 400);
            return;
        }
        
        // Определяем тип маркера
        var markerType = 'progress';
        if (markerClass === 'myshows-remaining') markerType = 'remaining';
        else if (markerClass === 'myshows-next-episode') markerType = 'next';
        
        // ✅ ПРОГРЕСС (формат "X/Y")
        if (markerType === 'progress') {
            var oldParts = oldText.split('/');
            var newParts = newText.split('/');
            
            if (oldParts.length === 2 && newParts.length === 2) {
                var oldWatched = parseInt(oldParts[0], 10);
                var newWatched = parseInt(newParts[0], 10);
                var oldTotal = oldParts[1];
                var newTotal = newParts[1];
                
                if (!isNaN(oldWatched) && !isNaN(newWatched)) {
                    if (oldTotal === newTotal && oldWatched !== newWatched) {
                        Log.info('Progress animation:', oldWatched, '→', newWatched);
                        animateDigitByDigit(marker, oldWatched, newWatched, newTotal);
                        return;
                    }
                }
            }
        }
        // ✅ ОСТАВШИЕСЯ (число)
        else if (markerType === 'remaining') {
            var oldRemaining = parseInt(oldText, 10);
            var newRemaining = parseInt(newText, 10);
            
            if (!isNaN(oldRemaining) && !isNaN(newRemaining) && oldRemaining !== newRemaining) {
                Log.info('Remaining animation:', oldRemaining, '→', newRemaining);
                animateCounter(marker, oldRemaining, newRemaining, 'remaining');
                return;
            }
        }
        // ✅ СЛЕДУЮЩАЯ СЕРИЯ
        else if (markerType === 'next') {
            Log.info('Next episode animation');
            animateNextEpisode(marker, oldText, newText);
            return;
        }
        
        // Простое обновление
        Log.info('Simple update');
        marker.textContent = newText;
        marker.classList.add('digit-animating');
        setTimeout(function() {
            marker.classList.remove('digit-animating');
        }, 400);
    }

    function updateAllMyShowsCards(showName, newProgressMarker, newNextEpisode, newRemainingMarker) {  
        Log.info('updateAllMyShowsCards called:', {  
            showName: showName,  
            progress: newProgressMarker,  
            remaining: newRemainingMarker,
            nextEpisode: newNextEpisode,  
            nextEpisodeType: typeof newNextEpisode  
        });  
        
        var cards = document.querySelectorAll('.card');  
        
        cards.forEach(function(cardElement) {  
            var cardData = cardElement.card_data;  
            if (!cardData) return;  
            
            var cardName = cardData.original_title || cardData.original_name ||   
                        cardData.name || cardData.title;  
            
            if (cardName === showName) {  
                Log.info('Found card to update:', cardName);  
                
                // ✅ Обновляем данные в card_data  
                if (newProgressMarker) {  
                    cardData.progress_marker = newProgressMarker;  
                }  
                if (newNextEpisode && typeof newNextEpisode === 'string') {  
                    cardData.next_episode = newNextEpisode;  
                }  
                if (newRemainingMarker) {
                    cardData.remaining = newRemainingMarker;
                }
                
                // ✅ Подписываемся на события (если ещё не подписаны)  
                if (!cardElement.dataset.myshowsListeners) {  
                    cardElement.addEventListener('visible', function() {  
                        Log.info('Card visible event fired (existing)');  
                        addProgressMarkerToCard(cardElement, cardElement.card_data);  
                    });  
                    
                    cardElement.addEventListener('update', function() {  
                        Log.info('Card update event fired (existing)');  
                        addProgressMarkerToCard(cardElement, cardElement.card_data);  
                    });  
                    
                    cardElement.dataset.myshowsListeners = 'true';  
                }  
                
                // ✅ Обновляем визуально  
                addProgressMarkerToCard(cardElement, cardData);  
                
                // ✅ Триггерим событие update  
                var event = new Event('update');  
                cardElement.dispatchEvent(event);  
            }  
        });  
    }
    
    function animateDigitByDigit(container, startNum, endNum, totalEpisodes) {
        Log.info('animateDigitByDigit:', startNum, '→', endNum, '/', totalEpisodes);
        
        if (startNum === endNum) {
            container.classList.add('digit-animating');
            setTimeout(function() {
                container.classList.remove('digit-animating');
            }, 400);
            return;
        }
        
        var direction = startNum < endNum ? 'up' : 'down';
        var current = startNum;
        var speed = 250;

        // ✅ Просто сохраняем оригинальные классы
        var originalClasses = container.className;
        
        // Добавляем временный класс для анимации
        container.className = originalClasses + ' digit-animating-active';
        
        function updateDigit() {
            container.textContent = current + '/' + totalEpisodes;
            
            // Добавляем inline-стили для текущего шага
            // container.style.color = direction === 'up' ? '#4CAF50' : '#FF9800';
            container.style.backgroundColor = direction === 'up' ? '#2E7D32' : '#EF6C00';
            
            setTimeout(function() {
                if (direction === 'up' && current < endNum) {
                    current++;
                    setTimeout(updateDigit, speed);
                } else if (direction === 'down' && current > endNum) {
                    current--;
                    setTimeout(updateDigit, speed);
                } else {
                    // ✅ Завершение: убираем inline-стили и восстанавливаем классы
                    setTimeout(function() {
                        // container.style.color = '';
                        container.style.backgroundColor = '';
                        container.className = originalClasses;
                    }, 200);
                }
            }, 80);
        }
        
        updateDigit();
    }

    Lampa.Listener.follow('activity', function(event) {  

        Log.info('Activity event:', {  
            type: event.type,  
            component: event.component  
        });  

        if (event.type === 'start' && event.component === 'full') {  
            // Сохраняем карточку, в которую зашли  
            var currentCard = event.object && event.object.card;  
            if (currentCard) {  
                Lampa.Storage.set('myshows_current_card', currentCard);  
            }  
        }  

        if (event.type === 'start' && event.component === 'full') {  
            var currentCard = event.object && event.object.card;  
            if (currentCard) {  
                var originalName = currentCard.original_name || currentCard.original_title || currentCard.title;  
                var previousCard = Lampa.Storage.get('myshows_current_card', null);  
                var wasWatching = Lampa.Storage.get('myshows_was_watching', false);  

                Log.info('Full start debug:', {  
                    originalName: originalName,  
                    previousCard: previousCard ? (previousCard.original_name || previousCard.original_title || previousCard.title) : null,  
                    wasWatching: wasWatching,  
                    isSerial: currentCard.number_of_seasons > 0 || currentCard.seasons  
                });  
                
                Lampa.Storage.set('myshows_current_card', currentCard);  
                
                // ✅ Если возвращаемся к той же карточке после просмотра  
                if (previousCard &&   
                    (previousCard.original_name || previousCard.original_title || previousCard.title) === originalName &&  
                    wasWatching) {  
                    
                    // Определяем тип контента  
                    var isSerial = currentCard.number_of_seasons > 0 || currentCard.seasons;  
                    
                    // Ждём обновления данных на сервере  
                    setTimeout(function() {  
                        if (isSerial) {  
                            // Для сериалов  
                            loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {  
                                if (cachedResult && cachedResult.shows) {  
                                    var foundShow = cachedResult.shows.find(function(show) {  
                                        return (show.original_name || show.name || show.title) === originalName;  
                                    });  
                                    
                                    if (foundShow && (foundShow.progress_marker || foundShow.next_episode || foundShow.remaining)) {  
                                        Log.info('Updating markers on full page');  
                                        updateMarkersOnFullCard(foundShow.progress_marker, foundShow.next_episode, foundShow.remaining);  
                                    }  
                                }  
                            });
                            loadCacheFromServer('serial_status', 'shows', function(cachedResult) {  
                                if (cachedResult && cachedResult.shows) {  
                                    var foundShow = cachedResult.shows.find(function(show) {  
                                        return show.title === originalName ||   
                                            show.titleOriginal === originalName ||  
                                            (show.title && show.title.toLowerCase() === originalName.toLowerCase()) ||  
                                            (show.titleOriginal && show.titleOriginal.toLowerCase() === originalName.toLowerCase());  
                                    });  
                                    
                                    if (foundShow) {  
                                        Log.info('Updating serial status to:', foundShow.watchStatus);  
                                        updateButtonStates(foundShow.watchStatus, false, true);  
                                        Lampa.Storage.set('myshows_was_watching', false);
                                    }  
                                }  
                            });  
                        } else {  
                            // Для фильмов  
                            loadCacheFromServer('movie_status', 'movies', function(cachedResult) {  
                                if (cachedResult && cachedResult.movies) {  
                                    var foundMovie = cachedResult.movies.find(function(movie) {  
                                        return movie.title === originalName ||   
                                            movie.titleOriginal === originalName ||  
                                            (movie.title && movie.title.toLowerCase() === originalName.toLowerCase()) ||  
                                            (movie.titleOriginal && movie.titleOriginal.toLowerCase() === originalName.toLowerCase());  
                                    });  
                                    
                                    if (foundMovie) {  
                                        Log.info('Updating movie status to:', foundMovie.watchStatus);  
                                        updateButtonStates(foundMovie.watchStatus, true, true);  
                                        Lampa.Storage.set('myshows_was_watching', false);
                                    }  
                                }  
                            });  
                        }  
                    }, 3000);  
                }  
            }  
        }  
        
        if (event.type === 'archive' && (event.component === 'main' || event.component === 'category' || event.component === 'myshows_all')) {  
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
                                
                                var existingCard = findCardInMyShowsSection(originalName);  
                                
                                if (existingCard && foundShow.progress_marker) {  
                                    updateAllMyShowsCards(  
                                        originalName,   
                                        foundShow.progress_marker,   
                                        foundShow.next_episode,
                                        foundShow.remaining   
                                    ); 
                                } else if (!existingCard) {  
                                    insertNewCardIntoMyShowsSection(foundShow);  
                                }  
                            }  
                        }  
                        if (!foundInAPI) {  
                            updateCompletedShowCard(originalName);  
                        }  
                    });  
                }, 3000);  
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
                            updateAllMyShowsCards(originalName, foundShow.progress_marker, foundShow.next_episode, foundShow.remaining);
                        }
                    }  
                });  
            }  
            
            // Очищаем сохраненную карточку после обработки  
            localStorage.removeItem('myshows_current_card');
        }  
    });

    Lampa.Listener.follow('full', function(event) {  
        if (event.type === 'complite' && event.data && event.data.movie) {  
            var movie = event.data.movie;  
            var originalName = movie.original_name || movie.name || movie.title;  
            
            // Загружаем данные MyShows  
            loadCacheFromServer('unwatched_serials', 'shows', function(cachedResult) {  
                if (cachedResult && cachedResult.shows) {  
                    var foundShow = cachedResult.shows.find(function(show) {  
                        return (show.original_name || show.name || show.title) === originalName;  
                    });  
                    
                    if (foundShow && foundShow.progress_marker) {  
                        addProgressMarkerToFullCard(event.body, foundShow);  
                    }  
                }  
            });  
        }  
    });

    function addProgressMarkerToFullCard(bodyElement, showData) {  
        var posterElement = bodyElement.find('.full-start-new__poster');  
        
        if (!posterElement.length) return;  
        
        var posterDom = posterElement[0];
        
        // Находим существующие маркеры
        var existingProgress = posterDom.querySelector('.myshows-progress');
        var existingRemaining = posterDom.querySelector('.myshows-remaining');
        var existingNext = posterDom.querySelector('.myshows-next-episode');
        
        // ✅ Добавляем маркер прогресса
        if (showData.progress_marker) {  
            if (existingProgress) {
                animateFullCardMarker(existingProgress, showData.progress_marker, 'progress');
            } else {
                var progressMarker = document.createElement('div');  
                progressMarker.className = 'myshows-progress';  
                progressMarker.textContent = showData.progress_marker;  
                posterDom.appendChild(progressMarker);  
                
                // ✅ Анимация плавного появления
                setTimeout(function() {  
                    progressMarker.style.opacity = '0';
                    progressMarker.style.transform = 'translateY(10px)';
                    progressMarker.style.transition = 'all 0.4s ease';
                    
                    setTimeout(function() {  
                        progressMarker.style.opacity = '1';
                        progressMarker.style.transform = 'translateY(0)';
                    }, 10);
                    
                    setTimeout(function() {  
                        progressMarker.style.transition = '';
                    }, 410);
                }, 50);  
            }
        } else if (existingProgress) {
            existingProgress.remove();
        }

        // ✅ Добавляем маркер оставшиеся  
        if (showData.remaining !== undefined && showData.remaining !== null) {  
            if (existingRemaining) {
                animateFullCardMarker(existingRemaining, showData.remaining.toString(), 'remaining');
            } else {
                var remainingMarker = document.createElement('div');  
                remainingMarker.className = 'myshows-remaining';  
                remainingMarker.textContent = showData.remaining;  
                posterDom.appendChild(remainingMarker);  
                
                // Анимация плавного появления
                setTimeout(function() {  
                    remainingMarker.style.opacity = '0';
                    remainingMarker.style.transform = 'translateY(10px)';
                    remainingMarker.style.transition = 'all 0.4s ease';
                    
                    setTimeout(function() {  
                        remainingMarker.style.opacity = '1';
                        remainingMarker.style.transform = 'translateY(0)';
                    }, 10);
                    
                    setTimeout(function() {  
                        remainingMarker.style.transition = '';
                    }, 410);
                }, 50);  
            }
        } else if (existingRemaining) {
            existingRemaining.remove();
        }  
        
        // ✅ Добавляем маркер следующей серии  
        if (showData.next_episode) {  
            if (existingNext) {
                animateFullCardMarker(existingNext, showData.next_episode, 'next');
            } else {
                var nextEpisodeMarker = document.createElement('div');  
                nextEpisodeMarker.className = 'myshows-next-episode';  
                nextEpisodeMarker.textContent = showData.next_episode;  
                posterDom.appendChild(nextEpisodeMarker);  
                
                // Анимация плавного появления
                setTimeout(function() {  
                    nextEpisodeMarker.style.opacity = '0';
                    nextEpisodeMarker.style.transform = 'translateY(10px)';
                    nextEpisodeMarker.style.transition = 'all 0.4s ease';
                    
                    setTimeout(function() {  
                        nextEpisodeMarker.style.opacity = '1';
                        nextEpisodeMarker.style.transform = 'translateY(0)';
                    }, 10);
                    
                    setTimeout(function() {  
                        nextEpisodeMarker.style.transition = '';
                    }, 410);
                }, 50);  
            }
        } else if (existingNext) {
            existingNext.remove();
        }  
    }

    function updateMarkersOnFullCard(progressMarker, nextEpisode, remainingMarker) {  
        Log.info('updateMarkersOnFullCard called');  
        
        var posterElement = $('.full-start-new__poster');  
        
        if (!posterElement.length) {  
            Log.warn('Full poster not found via jQuery');  
            return;  
        }  
        
        var posterDom = posterElement[0];
        
        // Находим существующие маркеры
        var existingProgress = posterDom.querySelector('.myshows-progress');
        var existingRemaining = posterDom.querySelector('.myshows-remaining');
        var existingNext = posterDom.querySelector('.myshows-next-episode');
        
        // ✅ Добавляем маркер прогресса
        if (progressMarker) {  
            if (existingProgress) {
                // Если маркер уже есть - анимируем изменение
                animateFullCardMarker(existingProgress, progressMarker, 'progress');
                Log.info('Progress marker UPDATED with animation:', progressMarker);  
            } else {
                // ✅ ИСПРАВЛЕНО: НОВЫЙ МАРКЕР - анимация появления БЕЗ SCALE
                var progressDiv = document.createElement('div');  
                progressDiv.className = 'myshows-progress';  
                progressDiv.textContent = progressMarker;  
                posterDom.appendChild(progressDiv);  
                
                // ✅ Анимация ПЛАВНОГО ПОЯВЛЕНИЯ (не scale!)
                setTimeout(function() {  
                    progressDiv.style.opacity = '0';
                    progressDiv.style.transform = 'translateY(10px)';
                    progressDiv.style.transition = 'all 0.4s ease';
                    
                    // Запускаем анимацию
                    setTimeout(function() {  
                        progressDiv.style.opacity = '1';
                        progressDiv.style.transform = 'translateY(0)';
                    }, 10);
                    
                    // Убираем transition после анимации
                    setTimeout(function() {  
                        progressDiv.style.transition = '';
                    }, 410);
                }, 50);  
                
                Log.info('Progress marker ADDED (first appearance):', progressMarker);  
            }
        } else if (existingProgress) {
            existingProgress.remove();
        }

        // ✅ Добавляем маркер оставшихся  
        if (remainingMarker !== undefined && remainingMarker !== null) {  
            if (existingRemaining) {
                animateFullCardMarker(existingRemaining, remainingMarker.toString(), 'remaining');
                Log.info('Remaining marker updated:', remainingMarker);  
            } else {
                var remainingDiv = document.createElement('div');  
                remainingDiv.className = 'myshows-remaining';  
                remainingDiv.textContent = remainingMarker;  
                posterDom.appendChild(remainingDiv);  
                
                // ✅ Анимация плавного появления
                setTimeout(function() {  
                    remainingDiv.style.opacity = '0';
                    remainingDiv.style.transform = 'translateY(10px)';
                    remainingDiv.style.transition = 'all 0.4s ease';
                    
                    setTimeout(function() {  
                        remainingDiv.style.opacity = '1';
                        remainingDiv.style.transform = 'translateY(0)';
                    }, 10);
                    
                    setTimeout(function() {  
                        remainingDiv.style.transition = '';
                    }, 410);
                }, 50);  
            }
        } else if (existingRemaining) {
            existingRemaining.remove();
        }  
        
        // ✅ Добавляем маркер следующей серии  
        if (nextEpisode) {  
            if (existingNext) {
                animateFullCardMarker(existingNext, nextEpisode, 'next');
                Log.info('Next episode marker updated:', nextEpisode);  
            } else {
                var nextDiv = document.createElement('div');  
                nextDiv.className = 'myshows-next-episode';  
                nextDiv.textContent = nextEpisode;  
                posterDom.appendChild(nextDiv);  
                
                // ✅ Анимация плавного появления
                setTimeout(function() {  
                    nextDiv.style.opacity = '0';
                    nextDiv.style.transform = 'translateY(10px)';
                    nextDiv.style.transition = 'all 0.4s ease';
                    
                    setTimeout(function() {  
                        nextDiv.style.opacity = '1';
                        nextDiv.style.transform = 'translateY(0)';
                    }, 10);
                    
                    setTimeout(function() {  
                        nextDiv.style.transition = '';
                    }, 410);
                }, 50);  
            }
        } else if (existingNext) {
            existingNext.remove();
        }  
    }

    function animateFullCardMarker(markerElement, newValue, markerType) {
        var oldValue = markerElement.textContent || '';
    
        Log.info('=== animateFullCardMarker START ===');
        Log.info('Type:', markerType, 'Old:', oldValue, 'New:', newValue);
        Log.info('Container exists:', !!markerElement);
        
        if (oldValue === newValue) {
            Log.info('Marker unchanged:', markerType, oldValue);
            return;
        }
        
        Log.info('Animating', markerType, 'from', oldValue, 'to', newValue);
        
        // Новый маркер
        if (!oldValue.trim()) {
            markerElement.textContent = newValue;
            markerElement.classList.add('digit-animating');
            setTimeout(function() {
                markerElement.classList.remove('digit-animating');
            }, 400);
            return;
        }
        
        // ✅ ПРОГРЕСС
        if (markerType === 'progress') {
            var oldParts = oldValue.split('/');
            var newParts = newValue.split('/');
            
            if (oldParts.length === 2 && newParts.length === 2) {
                var oldWatched = parseInt(oldParts[0], 10);
                var newWatched = parseInt(newParts[0], 10);
                var oldTotal = oldParts[1];
                var newTotal = newParts[1];
                
                if (!isNaN(oldWatched) && !isNaN(newWatched) && 
                    oldTotal === newTotal && oldWatched !== newWatched) {
                    animateDigitByDigit(markerElement, oldWatched, newWatched, newTotal);
                    return;
                }
            }
        }
        // ✅ ОСТАВШИЕСЯ
        else if (markerType === 'remaining') {
            var oldRemaining = parseInt(oldValue, 10);
            var newRemaining = parseInt(newValue, 10);
            
            if (!isNaN(oldRemaining) && !isNaN(newRemaining) && oldRemaining !== newRemaining) {
                animateCounter(markerElement, oldRemaining, newRemaining, 'remaining');
                return;
            }
        }
        
        // ✅ СЛЕДУЮЩАЯ СЕРИЯ
        else if (markerType === 'next') {
            animateNextEpisode(markerElement, oldValue, newValue);
            return;
        }
        
        // Простое обновление
        markerElement.textContent = newValue;
        markerElement.classList.add('digit-animating');
        setTimeout(function() {
            markerElement.classList.remove('digit-animating');
        }, 400);
    }

    function animateCounter(container, startNum, endNum, type) {
        Log.info('animateCounter:', type, startNum, '→', endNum);
        
        // Если значения одинаковые или разница 1 - простая анимация
        if (startNum === endNum) {
            container.classList.add('counter-pulse');
            setTimeout(function() {
                container.classList.remove('counter-pulse');
            }, 400);
            return;
        }
        
        var direction = startNum < endNum ? 'up' : 'down';
        var current = startNum;
        var speed = 250; // Нормальная скорость для 1-2 шагов
        
        // ✅ Упрощаем: не меняем цвета
        function updateCounter() {
            container.textContent = current;
            
            // Легкая анимация пульсации
            // container.style.transform = 'scale(1.05)';
            
            setTimeout(function() {
                // container.style.transform = 'scale(1)';
                
                // Переход к следующему числу
                if (direction === 'up' && current < endNum) {
                    current++;
                    setTimeout(updateCounter, speed);
                } else if (direction === 'down' && current > endNum) {
                    current--;
                    setTimeout(updateCounter, speed);
                }
            }, 80);
        }
        
        updateCounter();
    }

    function animateNextEpisode(container, oldEpisode, newEpisode) {
        Log.info('>>> animateNextEpisode START:', {
            oldEpisode: oldEpisode,
            newEpisode: newEpisode,
            areEqual: oldEpisode === newEpisode
        });
        
        // ✅ Исправляем: добавляем trim и точное сравнение
        var oldTrimmed = (oldEpisode || '').toString().trim();
        var newTrimmed = (newEpisode || '').toString().trim();
        
        if (oldTrimmed === newTrimmed) {
            Log.info('Episode unchanged, skipping animation');
            return;
        }
        
        Log.info('Parsing episodes...');
        
        var oldMatch = oldTrimmed.match(/S(\d+)\/E(\d+)/);
        var newMatch = newTrimmed.match(/S(\d+)\/E(\d+)/);
        
        if (!oldMatch || !newMatch) {
            Log.info('Not episode format or parsing failed');
            simpleUpdate(container, newTrimmed);
            return;
        }
        
        var oldSeason = parseInt(oldMatch[1], 10);
        var oldEpNum = parseInt(oldMatch[2], 10);
        var newSeason = parseInt(newMatch[1], 10);
        var newEpNum = parseInt(newMatch[2], 10);
        
        Log.info('Parsed values:', {
            oldSeason: oldSeason,
            oldEpNum: oldEpNum,
            newSeason: newSeason,
            newEpNum: newEpNum
        });
        
        // ✅ ПРАВИЛО 1: Сезон уменьшился
        if (newSeason < oldSeason) {
            Log.info('Rule 1: Season decreased');
            countDownEpisodes(container, oldSeason, oldEpNum, newSeason, newEpNum);
            return;
        }
        
        // ✅ ПРАВИЛО 2: Сезон увеличился
        if (newSeason > oldSeason) {
            Log.info('Rule 2: Season increased');
            animateSeasonTransition(container, oldSeason, oldEpNum, newSeason, newEpNum);
            return;
        }
        
        // ✅ ПРАВИЛО 3: Тот же сезон, эпизод изменился
        if (oldSeason === newSeason && oldEpNum !== newEpNum) {
            Log.info('Rule 3: Same season, episode changed');
            // Определяем направление
            if (oldEpNum < newEpNum) {
                animateInSameSeason(container, oldSeason, oldEpNum, newEpNum, 'forward');
            } else {
                animateInSameSeason(container, oldSeason, oldEpNum, newEpNum, 'backward');
            }
            return;
        }
        
        // ✅ ПРАВИЛО 4: Ничего не изменилось (но мы уже проверили)
        Log.info('Rule 4: No significant change');
        simpleUpdate(container, newTrimmed);
    }

    function countDownEpisodes(container, oldSeason, oldEpNum, newSeason, newEpNum) {
        Log.info('countDownEpisodes:', oldSeason, oldEpNum, '→', newSeason, newEpNum);
        
        // ✅ Упрощаем: просто анимируем уменьшение номера эпизода
        // Не делаем предположений о количестве эпизодов в сезоне
        
        var currentSeason = oldSeason;
        var currentEp = oldEpNum;
        var speed = 250;
        
        function update() {
            var seasonStr = "S" + currentSeason.toString().padStart(2, '0');
            var epStr = "E" + currentEp.toString().padStart(2, '0');
            container.textContent = seasonStr + "/" + epStr;
            
            // Легкая анимация
            // container.style.transform = 'scale(1.05)';
            
            setTimeout(function() {
                // container.style.transform = 'scale(1)';
                
                // ✅ Логика обратного счета:
                // 1. Если мы в старом сезоне и еще не дошли до E01
                if (currentSeason === oldSeason && currentEp > 1) {
                    currentEp--;
                    setTimeout(update, speed);
                }
                // 2. Если дошли до E01 старого сезона, но нужен другой сезон
                else if (currentSeason === oldSeason && currentEp === 1 && newSeason < oldSeason) {
                    // Переходим к предыдущему сезону
                    currentSeason--;
                    // Начинаем с последнего эпизода? НЕТ - начинаем с E01!
                    currentEp = 1; // Начинаем новый сезон с E01
                    setTimeout(update, speed);
                }
                // 3. Если в новом сезоне, но еще не дошли до целевого эпизода
                else if (currentSeason === newSeason && currentEp < newEpNum) {
                    currentEp++;
                    setTimeout(update, speed);
                }
                // 4. Если в новом сезоне и текущий эпизод больше целевого
                else if (currentSeason === newSeason && currentEp > newEpNum) {
                    currentEp--;
                    setTimeout(update, speed);
                }
                // 5. Достигли цели
                else {
                    Log.info('Countdown complete:', currentSeason, '/', currentEp);
                }
            }, 80);
        }
        
        update();
    }

    // ✅ Функция обновления с пульсацией
    function simpleUpdate(container, text) {
        Log.info('simpleUpdate:', text);
        container.textContent = text;
        container.classList.add('digit-animating');
        setTimeout(function() {
            container.classList.remove('digit-animating');
        }, 400);
    }

    // ✅ Переход между сезонами (старый → новый)
    function animateSeasonTransition(container, oldSeason, oldEpNum, newSeason, newEpNum) {
        Log.info('animateSeasonTransition:', oldSeason, oldEpNum, '→', newSeason, newEpNum);
        
        var speed = 250;
        
        // ✅ ВАРИАНТ 1: Плавный единый счетчик
        // Просто считаем от старого эпизода к новому, меняя сезон по пути
        
        var currentSeason = oldSeason;
        var currentEp = oldEpNum;
        
        function update() {
            var seasonStr = "S" + currentSeason.toString().padStart(2, '0');
            var epStr = "E" + currentEp.toString().padStart(2, '0');
            container.textContent = seasonStr + "/" + epStr;
            
            // Легкая анимация
            // container.style.transform = 'scale(1.05)';
            
            setTimeout(function() {
                // container.style.transform = 'scale(1)';
                
                // ✅ Логика: если еще не в нужном сезоне, сначала меняем сезон
                if (currentSeason < newSeason) {
                    // Переходим к следующему сезону, начиная с E01
                    currentSeason++;
                    currentEp = 1;
                    setTimeout(update, speed);
                }
                // ✅ Если в нужном сезоне, но еще не дошли до нужного эпизода
                else if (currentSeason === newSeason && currentEp < newEpNum) {
                    currentEp++;
                    setTimeout(update, speed);
                }
                // ✅ Достигли цели
                else {
                    Log.info('Season transition complete');
                }
            }, 80);
        }
        
        update();
    }

    // ✅ Счетчик в одном сезоне
    function animateInSameSeason(container, season, startEp, endEp, direction) {
        Log.info('animateInSameSeason:', season, startEp, '→', endEp, 'direction:', direction);
        
        var seasonPrefix = "S" + season.toString().padStart(2, '0') + "/E";
        var current = startEp;
        var speed = 250;
        
        Log.info('Starting counter with prefix:', seasonPrefix);
        
        function update() {
            var epStr = current.toString().padStart(2, '0');
            var fullText = seasonPrefix + epStr;
            Log.info('Update step:', current, '->', fullText);
            
            container.textContent = fullText;
            // container.style.transform = 'scale(1.05)';
            
            setTimeout(function() {
                // container.style.transform = 'scale(1)';
                
                var shouldContinue = false;
                if (direction === 'forward' && current < endEp) {
                    current++;
                    shouldContinue = true;
                    Log.info('Moving forward to:', current);
                } else if (direction === 'backward' && current > endEp) {
                    current--;
                    shouldContinue = true;
                    Log.info('Moving backward to:', current);
                } else {
                    Log.info('Counter complete at:', current);
                }
                
                if (shouldContinue) {
                    setTimeout(update, speed);
                }
            }, 80);
        }
        
        update();
    }

    function updateCompletedShowCard(showName) {  
        var cards = document.querySelectorAll('.card');  
        
        for (var i = 0; i < cards.length; i++) {  
            var cardElement = cards[i];  
            var cardData = cardElement.card_data || {};  
            
            var cardName = cardData.original_title || cardData.original_name || cardData.name || cardData.title;  
            
            if (cardName === showName && cardData.progress_marker) {  
                Log.info('Found matching card for:', showName);  
                
                // ✅ Помечаем карточку как удаляемую  
                cardElement.dataset.removing = 'true';  
                
                var releasedEpisodes = cardData.released_count;  
                var totalEpisodes = cardData.total_count;  
                
                if (releasedEpisodes && totalEpisodes) {  
                    var newProgressMarker = releasedEpisodes + '/' + totalEpisodes;  
                    cardData.progress_marker = newProgressMarker;  
                    
                    // ✅ ИСПРАВЛЕНО: Передаём класс маркера  
                    updateCardWithAnimation(cardElement, newProgressMarker, 'myshows-progress');  
                    
                    var parentSection = cardElement.closest('.items-line');  
                    var allCards = parentSection.querySelectorAll('.card');  
                    var currentIndex = Array.from(allCards).indexOf(cardElement);  
                    
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
        // cardElement.style.transform = 'scale(0.8)';    
        
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

    function findMyShowsSection() {
        var titleElements = document.querySelectorAll('.items-line__title');
        for (var i = 0; i < titleElements.length; i++) {
            var titleText = titleElements[i].textContent || titleElements[i].innerText;
            if (titleText.indexOf('MyShows') !== -1) {
                return titleElements[i].closest('.items-line');
            }
        }
        return null;
    }

    function getCardName(cardData) {
        if (!cardData) return '';
        return cardData.original_title || cardData.original_name || cardData.name || cardData.title;
    }

    function findCardInMyShowsSection(showName) {
        var section = findMyShowsSection();
        if (!section) return null;
        
        var cards = section.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var cardData = cardElement.card_data || {};
            var cardName = getCardName(cardData);
            if (cardName === showName) {
                return cardElement;
            }
        }
        return null;
    }

    function insertNewCardIntoMyShowsSection(showData, retryCount) {  
        Log.info('insertNewCardIntoMyShowsSection called with:', {  
            name: showData.name || showData.title,  
            progress_marker: showData.progress_marker,  
            remaining: showData.remaining, 
            next_episode: showData.next_episode  
        });  
        
        if (typeof retryCount === 'undefined') {  
            retryCount = 0;  
        }  
        
        if (retryCount > 5) {  
            Log.error('Max retries reached for:', showData.name || showData.title);  
            return;  
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
        
        if (!targetSection) {  
            Log.warn('MyShows section not found, retrying in 500ms... (attempt ' + (retryCount + 1) + ')');  
            setTimeout(function() {  
                insertNewCardIntoMyShowsSection(showData, retryCount + 1);  
            }, 500);  
            return;  
        }  
        
        Log.info('Found MyShows section');  
        
        var scrollElement = targetSection.querySelector('.scroll');  
        
        if (!scrollElement) {  
            Log.error('Scroll element not found');  
            return;  
        }  
        
        if (!scrollElement.Scroll) {  
            Log.warn('Scroll.Scroll not available, retrying in 500ms... (attempt ' + (retryCount + 1) + ')');  
            setTimeout(function() {  
                insertNewCardIntoMyShowsSection(showData, retryCount + 1);  
            }, 500);  
            return;  
        }  
        
        var scroll = scrollElement.Scroll;  
        Log.info('Scroll object available');  
        
        try {  
            // ✅ ИСПРАВЛЕНО: Используем прямой конструктор Card  
            var newCard = new Lampa.Card(showData, {  
                object: { source: 'tmdb' },  
                card_category: true  
            });  
            
            Log.info('Card created');  
            
            // ✅ Создаём карточку через create()  
            newCard.create();  
            
            // ✅ Настраиваем обработчики  
            newCard.onEnter = function(target, card_data) {  
                Lampa.Activity.push({  
                    url: card_data.url,  
                    component: 'full',  
                    id: card_data.id,  
                    method: 'tv',  
                    card: card_data,  
                    source: 'tmdb'  
                });  
            };  
            
            // ✅ Получаем DOM-элемент  
            var cardElement = newCard.render(true);  
            
            if (cardElement) {  
                Log.info('Card rendered');  
                
                // ✅ Сохраняем кастомные данные  
                cardElement.card_data = cardElement.card_data || {};  
                cardElement.card_data.progress_marker = showData.progress_marker;  
                cardElement.card_data.remaining = showData.remaining;
                cardElement.card_data.next_episode = showData.next_episode;  
                cardElement.card_data.watched_count = showData.watched_count;  
                cardElement.card_data.total_count = showData.total_count;  
                cardElement.card_data.released_count = showData.released_count;  
                
                // ✅ Подписываемся на события  
                cardElement.addEventListener('visible', function() {  
                    Log.info('New card visible event fired');  
                    addProgressMarkerToCard(cardElement, cardElement.card_data);  
                });  
                
                cardElement.addEventListener('update', function() {  
                    Log.info('New card update event fired');  
                    addProgressMarkerToCard(cardElement, cardElement.card_data);  
                });  
                
                // ✅ Добавляем в scroll  
                scroll.append(cardElement);  
                Log.info('Card appended to scroll');  
                
                if (window.Lampa && window.Lampa.Controller) {  
                    window.Lampa.Controller.collectionAppend(cardElement);  
                    Log.info('Card added to controller collection');  
                }  
                
                Log.info('Card successfully added to DOM');  
            } else {  
                Log.error('Card element is null after render');  
            }  
        } catch (error) {  
            Log.error('Error creating card:', error);  
        }  
    }

    function addProgressMarkerStyles() {          
        var style = document.createElement('style');          
        style.textContent = `          
            .myshows-progress {    
                position: absolute;    
                left: 0em;    
                bottom: 0em;    
                padding: 0.2em 0.4em;    
                font-size: 1.2em;    
                border-radius: 0.5em;    
                font-weight: bold;    
                z-index: 2;    
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);    
                background: #4CAF50;    
                color: #fff;  
                transition: all 0.3s ease, transform 0.15s ease !important;
                will-change: transform, color, background-color;
            }

            /* Стили для анимации перелистывания */
            @keyframes digitFlip {
                0% { 
                    transform: translateY(0) scale(1); 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
                50% { 
                    transform: scale(1); 
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                100% { 
                    transform: translateY(0) scale(1); 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
            }

            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1); }
                100% { transform: scale(1); }
            }

            .digit-animating {
                animation: digitFlip 0.6s ease;
            }

            .marker-update {
                animation: pulse 0.6s ease;
            }

            /* Анимация для счетчика */
            .counter-animating {
                animation: counterPulse 0.8s ease;
            }

            @keyframes counterPulse {
                0% { 
                    transform: scale(1); 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
                25% { 
                    transform: scale(1); 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                }
                50% { 
                    transform: scale(1); 
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                }
                100% { 
                    transform: scale(1); 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
            }

            /* Анимация для смены серии */
            /* .episode-changing {
                animation: episodeChange 0.6s ease;
            }

            @keyframes episodeChange {
                0% { 
                    transform: translateY(0) scale(1); 
                    opacity: 1;
                }
                50% { 
                    transform: translateY(-8px) scale(1); 
                    opacity: 0.7;
                }
                100% { 
                    transform: translateY(0) scale(1); 
                    opacity: 1;
                }
            } */

            .myshows-remaining {    
                position: absolute;    
                right: 0em;    
                top: 0em;    
                padding: 0.2em 0.4em;    
                font-size: 1.2em;    
                border-radius: 1em;    
                font-weight: bold;    
                z-index: 2;      
                background: rgba(0, 0, 0, 0.5);    
                color: #fff;  
                transition: all 0.3s ease;  /* ✅ Добавьте transition */  
            }    
            
            .myshows-next-episode {    
                position: absolute;    
                left: 0em;    
                bottom: 1.5em;    
                padding: 0.2em 0.4em;    
                font-size: 1.2em;    
                border-radius: 0.5em;    
                font-weight: bold;    
                z-index: 2;    
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);    
                letter-spacing: 0.04em;    
                line-height: 1.1;    
                background: #2196F3;    
                color: #fff;  
                transition: all 0.3s ease;  /* ✅ Добавьте transition */  
            }    

            .full-start-new__poster {  
                position: relative;  
            }  
            
            .full-start-new__poster .myshows-progress,  
            .full-start-new__poster .myshows-next-episode {  
                position: absolute;  
                left: 0.5em;  
                z-index: 3;  
            }  
            
            .full-start-new__poster .myshows-progress,
            .full-start-new__poster .myshows-remaining,
            .full-start-new__poster .myshows-next-episode {
                transition: all 0.3s ease !important;
                will-change: transform, color, background-color;
            }

            .full-start-new__poster .myshows-progress.digit-animating,
            .full-start-new__poster .myshows-remaining.digit-animating,
            .full-start-new__poster .myshows-next-episode.digit-animating {
                animation: digitFlip 0.6s ease;
            }

            .full-start-new__poster .marker-update {
                animation: gentlePulse 0.6s ease;
            }

            @keyframes gentlePulse {
                0% { transform: scale(1); }
                50% { transform: scale(1); }
                100% { transform: scale(1); }
            }
                        
            .full-start-new__poster .myshows-progress {  
                bottom: 0.5em;  
            }  
            
            .full-start-new__poster .myshows-next-episode {  
                bottom: 2em;  
            }

            /* Мобильная версия для full-карточки */  
            body.true--mobile.orientation--portrait .full-start-new__poster .myshows-progress {  
                bottom: 15em;  
            }  
            
            body.true--mobile.orientation--portrait .full-start-new__poster .myshows-next-episode {  
                bottom: 17em;  
            }  
            
            /* Планшеты (альбомная ориентация) или широкие экраны */  
            body.true--mobile.orientation--landscape .full-start-new__poster .myshows-progress {  
                bottom: 2.5em;  
            }  
            
            body.true--mobile.orientation--landscape .full-start-new__poster .myshows-next-episode {  
                bottom: 4em;  
            }  
            
            /* Дополнительно: медиа-запрос для планшетов по ширине экрана */  
            @media screen and (min-width: 580px) and (max-width: 1024px) {  
                body.true--mobile .full-start-new__poster .myshows-progress {  
                    bottom: 2.5em;  
                    font-size: 1.1em;  
                }  
                
                body.true--mobile .full-start-new__poster .myshows-next-episode {  
                    bottom: 4em;  
                    font-size: 1.1em;  
                }  
            }
            
            /* Поддержка glass-стиля */    
            body.glass--style.platform--browser .card .myshows-progress,    
            body.glass--style.platform--nw .card .myshows-progress,    
            body.glass--style.platform--apple .card .myshows-progress {    
                background-color: rgba(76, 175, 80, 0.8);    
                -webkit-backdrop-filter: blur(1em);    
                backdrop-filter: blur(1em);    
            }    
            
            body.glass--style.platform--browser .card .myshows-next-episode,    
            body.glass--style.platform--nw .card .myshows-next-episode,    
            body.glass--style.platform--apple .card .myshows-next-episode {    
                background-color: rgba(33, 150, 243, 0.8);    
                -webkit-backdrop-filter: blur(1em);    
                backdrop-filter: blur(1em);    
            }    
            
            /* ✅ Анимация */  
            .myshows-progress.marker-update,  
            .myshows-next-episode.marker-update {  
                font-weight: 900;    
                animation: gentleAppear 0.4s ease;
            }  
            
            @keyframes gentleAppear {
                0% { 
                    opacity: 0;
                    transform: translateY(10px);
                }
                100% { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes gentlePulse {
                0% { transform: scale(1); }
                50% { transform: scale(1); } 
                100% { transform: scale(1); }
            }

            /* Для scale анимации (только при изменениях) */
            .scale-animation {
                animation: gentlePulse 0.6s ease;
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
                            line_type: 'myshows_unwatched'     
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

    ////// Статус сериалов и фильмов. (Смотрю, Буду смотреть, Не смотрел) //////
    function createMyShowsButtons(e, currentStatus, isMovie) {
        if (!e || !e.object || !e.object.activity) return;

        var container = e.object.activity
            .render()
            .find('.full-start-new__buttons');

        if (!container.length) return;

        if (container.data('myshows-initialized')) {
            return;
        }

        container.data('myshows-initialized', true);

        if (container.find('.myshows-btn').length) {
            container.data('myshows-initialized', true);
            return;
        }

        // Конфигурация кнопок в зависимости от типа контента
        var buttonsConfig = isMovie ? [
            { title: 'Просмотрел', status: 'finished' },
            { title: 'Буду смотреть', status: 'later' },
            { title: 'Не смотрел', status: 'remove' }
        ] : [
            { title: 'Смотрю', status: 'watching' },
            { title: 'Буду смотреть', status: 'later' },
            { title: 'Перестал смотреть', status: 'cancelled' },
            { title: 'Не смотрю', status: 'remove' }
        ];

        // РАЗДЕЛЬНЫЕ классы для сериалов и фильмов
        var statusToClass = {
            // Сериалы
            'watching': 'myshows-watching',
            'later': 'myshows-scheduled', 
            'cancelled': 'myshows-thrown',
            'remove': 'myshows-cancelled',
            // Фильмы  
            'finished': 'myshows-movie-watched',
            'later_movie': 'myshows-movie-later', // разные имена для фильмов
            'remove_movie': 'myshows-movie-remove'
        };

        // Общий маппинг статусов на иконки
        var statusToIcon = {
            'watching': watch_icon,
            'finished': watch_icon,
            'later': later_icon,
            'later_movie': later_icon,
            'cancelled': cancelled_icon,
            'remove': remove_icon,
            'remove_movie': remove_icon
        };

        buttonsConfig.forEach(function(buttonData) {
            // Для фильмов используем специальные ключи статусов
            var statusKey = buttonData.status;
            if (isMovie) {
                if (buttonData.status === 'later') statusKey = 'later_movie';
                if (buttonData.status === 'remove') statusKey = 'remove_movie';
            }
            
            var buttonClass = statusToClass[statusKey];
            var buttonIcon = statusToIcon[statusKey];
            var isActive = currentStatus === buttonData.status;
            var activeClass = isActive ? ' myshows-active' : '';
            
            var btn = $('<div class="full-start__button selector myshows-btn ' + buttonClass + activeClass + '">' +
                buttonIcon +
                '<span>' + buttonData.title + '</span>' +
                '</div>');

            btn.on('hover:enter', function() {
                // Сначала снимаем выделение со всех кнопок
                updateButtonStates(null, isMovie, false);
                
                var setStatusFunction = isMovie ? setMyShowsMovieStatus : setMyShowsStatus;
                
                setStatusFunction(e.data.movie, buttonData.status, function(success) {
                    if (success) {
                        Lampa.Noty.show('Статус "' + buttonData.title + '" установлен на MyShows');
                        updateButtonStates(buttonData.status, isMovie, false);
                    } else {
                        Lampa.Noty.show('Ошибка установки статуса');
                        updateButtonStates(currentStatus, isMovie, false);
                    }
                });
            });
            
            if (!isMovie) {
                e.object.activity.render()
                    .find('.full-start-new__buttons')
                    .addClass('myshows-btn-series');
            }
            
            e.object.activity.render().find('.full-start-new__buttons').append(btn);
        });

        // Общая логика инициализации контроллера
        if (window.Lampa && window.Lampa.Controller) {
            var container = e.object.activity.render().find('.full-start-new__buttons');
            var allButtons = container.find('> *').filter(function(){
                return $(this).is(':visible');
            });
            
            Lampa.Controller.collectionSet(container);
            if (allButtons.length > 0) {
                Lampa.Controller.collectionFocus(allButtons.eq(0)[0], container);
            }
        }
    }

    function updateButtonStates(newStatus, isMovie, useAnimation) {
        var selector = '.full-start__button[class*="myshows-"]';
        
        var statusMap = isMovie ? {
            'finished': 'myshows-movie-watched',
            'later': 'myshows-movie-later',
            'remove': 'myshows-movie-remove'
        } : {
            'watching': 'myshows-watching',
            'later': 'myshows-scheduled', 
            'cancelled': 'myshows-thrown',
            'remove': 'myshows-cancelled'
        };
        
        var buttons = document.querySelectorAll(selector);
        
        buttons.forEach(function(button) {
            var svg = button.querySelector('svg');
            
            button.classList.remove('myshows-active');
            
            if (useAnimation && svg) {
                svg.style.transition = 'color 0.5s ease, filter 0.5s ease';
            }
            
            if (newStatus && statusMap[newStatus] && button.classList.contains(statusMap[newStatus])) {
                button.classList.add('myshows-active');
            }
        });
    }

    function getShowStatus(showId, callback) {  
        loadCacheFromServer('serial_status', 'shows', function(showsData) {
            if (showsData && showsData.shows) {
                var numericShowId = parseInt(showId);
                var userShow = showsData.shows.find(function(item) {  
                    return item.id === numericShowId;  
                }); 
                callback(userShow ? userShow.watchStatus : 'remove');
            } else {
                callback('remove');
            }
        }) 
    }

    function addMyShowsButtonStyles() {  
        if (getProfileSetting('myshows_button_view', true) && getProfileSetting('myshows_token', false)) {

            var style = document.createElement('style');  
            style.textContent = `  
                /* Общие transition для всех кнопок */  
                .full-start__button[class*="myshows-"] svg {  
                    transition: color 0.5s ease, filter 0.5s ease;  
                }  
                
                /* СЕРИАЛЫ */  
                .full-start__button.myshows-watching.myshows-active svg {  
                    color: #FFC107;  
                    filter: drop-shadow(0 0 3px rgba(255, 193, 7, 0.8));  
                }  
                .full-start__button.myshows-scheduled.myshows-active svg {  
                    color: #2196F3;  
                    filter: drop-shadow(0 0 3px rgba(33, 150, 243, 0.8));  
                }  
                .full-start__button.myshows-thrown.myshows-active svg {  
                    color: #FF9800;  
                    filter: drop-shadow(0 0 3px rgba(255, 152, 0, 0.8));  
                }  
                .full-start__button.myshows-cancelled.myshows-active svg {  
                    color: #F44336;  
                    filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.8));  
                }  
                
                /* ФИЛЬМЫ */  
                .full-start__button.myshows-movie-watched.myshows-active svg {  
                    color: #4CAF50;  
                    filter: drop-shadow(0 0 3px rgba(76, 175, 80, 0.8));  
                }  
                .full-start__button.myshows-movie-later.myshows-active svg {  
                    color: #2196F3;  
                    filter: drop-shadow(0 0 3px rgba(33, 150, 243, 0.8));  
                }  
                .full-start__button.myshows-movie-remove.myshows-active svg {  
                    color: #F44336;  
                    filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.8));  
                }  

                /* Дополнительно: медиа-запрос для телефонов по ширине экрана */  
                @media screen and (max-width: 580px) {

                    /* по умолчанию (фильмы) */
                    .full-start-new__buttons {
                        flex-wrap: nowrap;
                    }

                    /* только если есть сериалы */
                    .full-start-new__buttons.myshows-btn-series {
                        flex-wrap: wrap;
                    }

                    /* разрыв строки */
                    .full-start-new__buttons.myshows-btn-series::after {
                        content: '';
                        flex-basis: 100%;
                        width: 100%;
                        order: 1;
                        margin-bottom: 0.75em;
                    }

                    /* кнопки сериалов идут вниз */
                    .full-start-new__buttons.myshows-btn-series .myshows-btn {
                        order: 2;
                    }
                }
            `;  
            document.head.appendChild(style);  
        }
    }

    function getStatusByTitle(title, isMovie, callback) {
        var cacheType = isMovie ? 'movie_status' : 'serial_status';
        var dataKey = isMovie ? 'movies' : 'shows';
        var statusField = isMovie ? 'watchStatus' : 'watchStatus';
        
        loadCacheFromServer(cacheType, dataKey, function(cachedData) {
            if (cachedData && cachedData[dataKey]) {
                var items = cachedData[dataKey];
                var foundItem = items.find(function(item) {
                    return item.title === title || 
                        item.titleOriginal === title ||
                        (item.title && item.title.toLowerCase() === title.toLowerCase()) ||
                        (item.titleOriginal && item.titleOriginal.toLowerCase() === title.toLowerCase());
                });
                
                callback(foundItem ? foundItem[statusField] : 'remove');
            } else {
                callback('remove');
            }
        });
    }

    function addToHistory(contentData) {
        Lampa.Favorite.add('history', contentData)
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

    // Cинхронизация
    function syncMyShows(callback) {      
        syncInProgress = true;    
        var screensaver = Lampa.Storage.get('screensaver', 'true');
        Lampa.Storage.set('screensaver', 'false'); 
        
        Log.info('Starting sequential sync process');      
        Log.info('syncInProgress', syncInProgress);      
        
        // Массив для накопления всех таймкодов  
        var allTimecodes = [];  
        
        // Получаем фильмы      
        watchedMoviesData(function(movies, error) {      
            if (error) {      
                // restoreTimelineListener();    
                Log.error('Movie sync error:', error);      
                if (callback) callback(false, 'Ошибка синхронизации фильмов: ' + error);      
                return;      
            }      
            
            Log.info('Got', movies.length, 'movies');      
            
            // Обрабатываем фильмы последовательно      
            processMovies(movies, allTimecodes, function(movieResult) {      
                Log.info('Movies processed:', movieResult.processed, 'errors:', movieResult.errors);      
                
                // Получаем сериалы      
                getWatchedShows(function(shows, showError) {      
                    if (showError) {      
                        // restoreTimelineListener();    
                        Log.error('Show sync error:', showError);      
                        if (callback) callback(false, 'Ошибка синхронизации сериалов: ' + showError);      
                        return;      
                    }      
                    
                    Log.info('Got', shows.length, 'shows');      
                    
                    // Обрабатываем сериалы последовательно      
                    processShows(shows, allTimecodes, function(showResult) {      
                        Log.info('Shows processed:', showResult.processed, 'errors:', showResult.errors);      
                        
                        var totalProcessed = movieResult.processed + showResult.processed;      
                        var totalErrors = movieResult.errors + showResult.errors;      
                        
                        if (allTimecodes.length > 0) {  
                            Log.info('Syncing', allTimecodes.length, 'timecodes to database');  
                            Lampa.Noty.show('Синхронизация таймкодов: ' + allTimecodes.length + ' записей');  
                            
                            syncTimecodesToDatabase(allTimecodes, function(syncSuccess) {  
                                if (syncSuccess) {  
                                    Log.info('Timecodes synced successfully');  
                                    
                                    // Добавляем все карточки в избранное      
                                    addAllCardsAtOnce(cardsToAdd);      
                                    
                                    // Обновляем кеши после завершения синхронизации      
                                    fetchStatusMovies(function(data) {      
                                        fetchShowStatus(function(data) {      
                                            if (callback) {    
                                                callback(true, 'Синхронизация завершена. Обработано: ' + totalProcessed + ', ошибок: ' + totalErrors);    
                                            }    

                                        if (screensaver) {
                                            localStorage.removeItem('screensaver');
                                        }

                                            // ✅ ДОБАВЛЕНО: Показываем уведомление и перезагружаем  
                                            Lampa.Noty.show('Синхронизация завершена! Приложение будет перезагружено через 3 секунды...');  
                                            
                                            setTimeout(function() {  
                                                // Перезагружаем приложение  
                                                window.location.reload();  
                                            }, 3000); 
                                        });      
                                    });  
                                } else {  
                                    if (callback) {  
                                        callback(false, 'Ошибка записи таймкодов в базу данных');  
                                    }  
                                }  
                            });  
                        } else {  
                            // Нет таймкодов для синхронизации  
                            addAllCardsAtOnce(cardsToAdd);      
                            
                            fetchStatusMovies(function(data) {      
                                fetchShowStatus(function(data) {      
                                    if (callback) {    
                                        callback(true, 'Синхронизация завершена. Обработано: ' + totalProcessed + ', ошибок: ' + totalErrors);    
                                    }    
                                });      
                            });  
                        }  
                    });      
                });      
            });      
        });    
    } 

    // ✅ НОВАЯ ФУНКЦИЯ: Пакетная запись таймкодов в базу данных  
    function syncTimecodesToDatabase(timecodes, callback) {  
        var network = new Lampa.Reguest();  
        
        var uid = Lampa.Storage.get('lampac_unic_id', '');    
        var profileId = Lampa.Storage.get('lampac_profile_id', '');    
        
        if (!uid) {    
            Log.error('No lampac_unic_id found');    
            callback(false);    
            return;    
        }  
        
        // ✅ Добавляем uid и profile_id в URL  
        var url = window.location.origin + '/timecode/batch_add?uid=' + encodeURIComponent(uid);  
        if (profileId) {  
            url += '&profile_id=' + encodeURIComponent(profileId);  
        }   
        
        var payload = {    
            timecodes: timecodes    
        };  
        
        Log.info('Sending batch timecode request to:', url);    
        Log.info('Payload:', payload); 
        
        network.timeout(1000 * 60); // 60 секунд таймаут  
        network.native(url, function(response) {  
            Log.info('Batch sync response:', response);  
            
            if (response && response.success) {  
                Log.info('Successfully synced', response.added, 'added,', response.updated, 'updated');  
                callback(true);  
            } else {  
                Log.error('Batch sync failed:', response);  
                callback(false);  
            }  
            }, function(error) {  
                Log.error('Batch sync error:', error);  
                callback(false);  
            }, JSON.stringify(payload), {  
                headers: {  
                    'Content-Type': 'application/json'  
                }  
            });
    }  

    // ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ: processMovies теперь накапливает таймкоды  
    function processMovies(movies, allTimecodes, callback) {    
        var processed = 0;    
        var errors = 0;    
        var currentIndex = 0;    
        
        function processNextMovie() {    
            if (currentIndex >= movies.length) {    
                callback({processed: processed, errors: errors});    
                return;    
            }    
            
            var movie = movies[currentIndex];    
            Log.info('Processing movie', (currentIndex + 1), 'of', movies.length, ':', movie.title);    
            
            Lampa.Noty.show('Обрабатываю фильм: ' + movie.title + ' (' + (currentIndex + 1) + '/' + movies.length + ')');    
            
            // Ищем TMDB ID    
            findTMDBId(movie.title, movie.titleOriginal, movie.year, movie.imdbId, movie.kinopoiskId, false, function(tmdbId, tmdbData) {    
                if (tmdbId) {    
                    // Получаем полную карточку    
                    getTMDBCard(tmdbId, false, function(card, error) {    
                        if (card) {    
                            try {    
                                // ✅ ВМЕСТО Lampa.Timeline.update() - добавляем в массив для пакетной записи  
                                var hash = Lampa.Utils.hash([movie.titleOriginal || movie.title].join(''));  
                                var duration = movie.runtime ? movie.runtime * 60 : 7200;  
                                
                                allTimecodes.push({  
                                    card_id: tmdbId + '_movie',  
                                    item: hash.toString(),  
                                    data: JSON.stringify({  
                                        duration: duration,  
                                        time: duration,  
                                        percent: 100  
                                    })  
                                });  
                                
                                // Добавляем в историю    
                                cardsToAdd.push(card);    
                                processed++;    
                            } catch (e) {    
                                Log.error('Error processing movie:', movie.title, e);    
                                errors++;    
                            }    
                        } else {    
                            errors++;    
                        }    
                        
                        currentIndex++;    
                        setTimeout(processNextMovie, 1);    
                    });    
                } else {    
                    errors++;    
                    currentIndex++;    
                    setTimeout(processNextMovie, 50);    
                }    
            });    
        }    
        
        processNextMovie();    
    } 

    // ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ: processShows теперь накапливает таймкоды  
    function processShows(shows, allTimecodes, callback) {    
        var processed = 0;    
        var errors = 0;    
        var currentShowIndex = 0;    
        var tmdbCache = {};  
        
        function processNextShow() {    
            if (currentShowIndex >= shows.length) {    
                callback({processed: processed, errors: errors});    
                return;    
            }    
            
            var show = shows[currentShowIndex];    
            Log.info('Processing show', (currentShowIndex + 1), 'of', shows.length, ':', show.title);    
            
            Lampa.Noty.show('Обрабатываю сериал: ' + show.title + ' (' + (currentShowIndex + 1) + '/' + shows.length + ')');    
            
            findTMDBId(show.title, show.titleOriginal, show.year, show.imdbId, show.kinopoiskId, true, function(tmdbId, tmdbData) {    
                if (tmdbId) {    
                    getTMDBCard(tmdbId, true, function(card, error) {    
                        if (card) {    
                            tmdbCache[show.myshowsId] = card;    
                            
                            // ✅ Обрабатываем эпизоды и добавляем таймкоды в массив  
                            processShowEpisodes(show, card, tmdbId, allTimecodes, function(episodeResult) {    
                                processed += episodeResult.processed;    
                                errors += episodeResult.errors;    
                                
                                currentShowIndex++;    
                                setTimeout(processNextShow, 1);    
                            });    
                        } else {    
                            errors++;    
                            currentShowIndex++;    
                            setTimeout(processNextShow, 50);    
                        }    
                    });    
                } else {    
                    errors++;    
                    currentShowIndex++;    
                    setTimeout(processNextShow, 50);    
                }    
            });    
        }    
        
        processNextShow();    
    } 

    // ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ: processShowEpisodes теперь накапливает таймкоды  
    function processShowEpisodes(show, tmdbCard, tmdbId, allTimecodes, callback) {    
        Log.info('Processing episodes for show:', show.title, 'Episodes count:', show.episodes ? show.episodes.length : 0);    
        
        var watchedEpisodeIds = show.watchedEpisodes.map(function(ep) { return ep.id; });    
        var processedEpisodes = 0;    
        var errorEpisodes = 0;    
        var currentEpisodeIndex = 0;    
        
        function processNextEpisode() {    
            if (currentEpisodeIndex >= show.episodes.length) {    
                Log.info('Finished processing show:', show.title, 'Processed:', processedEpisodes, 'Errors:', errorEpisodes);    
                cardsToAdd.push(tmdbCard);    
                callback({processed: processedEpisodes, errors: errorEpisodes});    
                return;    
            }    
            
            var episode = show.episodes[currentEpisodeIndex];    
            Log.info('Processing episode:', episode.seasonNumber + 'x' + episode.episodeNumber, 'for show:', show.title);    
            
            if (watchedEpisodeIds.indexOf(episode.id) !== -1) {    
                try {    
                    // ✅ ВМЕСТО Lampa.Timeline.update() - добавляем в массив для пакетной записи  
                    var hash = Lampa.Utils.hash([    
                        episode.seasonNumber,    
                        episode.seasonNumber > 10 ? ':' : '',    
                        episode.episodeNumber,    
                        show.titleOriginal || show.title    
                    ].join(''));    
                    
                    var duration = episode.runtime ? episode.runtime * 60 : (show.runtime ? show.runtime * 60 : 2700);  
                    
                    Log.info('Adding timecode for episode:', episode.seasonNumber + 'x' + episode.episodeNumber, 'Hash:', hash);    
                    
                    allTimecodes.push({  
                        card_id: tmdbId + '_tv',  
                        item: hash.toString(),  
                        data: JSON.stringify({  
                            duration: duration,  
                            time: duration,  
                            percent: 100  
                        })  
                    });  
                    
                    processedEpisodes++;    
                    Log.info('Successfully processed episode:', episode.seasonNumber + 'x' + episode.episodeNumber);    
                } catch (timelineError) {    
                    Log.error('Error processing episode:', episode.seasonNumber + 'x' + episode.episodeNumber, timelineError);    
                    errorEpisodes++;    
                }    
            } else {    
                Log.info('Episode not watched, skipping:', episode.seasonNumber + 'x' + episode.episodeNumber);    
            }    
            
            currentEpisodeIndex++;    
            setTimeout(processNextEpisode, 1);    
        }    
        
        processNextEpisode();    
    }

    function getFirstEpisodeYear(show) {  
        if (!show.episodes || show.episodes.length === 0) {  
            return show.year;  
        }  
        
        // Ищем первый эпизод с episodeNumber >= 1 (не специальный)  
        var firstRealEpisode = show.episodes.find(function(episode) {  
            return episode.seasonNumber === 1 && episode.episodeNumber >= 1 && !episode.isSpecial;  
        });  
        
        if (firstRealEpisode && firstRealEpisode.airDate) {  
            var airDate = new Date(firstRealEpisode.airDate);  
            return airDate.getFullYear();  
        }  
        
        // Fallback к году сериала  
        return show.year;  
    } 
  
    function findTMDBId(title, originalTitle, year, imdbId, kinopoiskId, isTV, callback, showData) {  
        var network = new Lampa.Reguest();  
        
        Log.info('Searching for:', title, 'Original:', originalTitle, 'IMDB:', imdbId, 'Year:', year);  
        
        // Шаг 1: Поиск по IMDB ID  
        if (imdbId) {  
            var imdbIdFormatted = imdbId.toString().replace('tt', '');  
            var url = Lampa.TMDB.api('find/tt' + imdbIdFormatted + '?external_source=imdb_id&api_key=' + Lampa.TMDB.key());  
            
            network.timeout(1000 * 10);  
            network.silent(url, function(results) {  
                var items = isTV ? results.tv_results : results.movie_results;  
                if (items && items.length > 0) {  
                    Log.info('Found by IMDB ID:', items[0].id, 'for', title);  
                    callback(items[0].id, items[0]);  
                    return;  
                }  
                Log.info('No IMDB results, trying title search');  
                searchByTitle();  
            }, function(error) {  
                Log.error('IMDB search error:', error);  
                searchByTitle();  
            });  
            return;  
        }  
        
        searchByTitle();  
        
        function searchByTitle() {  
            var searchQueries = [];  
            if (originalTitle && originalTitle !== title) {  
                searchQueries.push(originalTitle);  
            }  
            searchQueries.push(title);  
            
            var currentQueryIndex = 0;  
            
            function tryNextQuery() {  
                if (currentQueryIndex >= searchQueries.length) {  
                    Log.info('Not found in TMDB, using fallback hash for:', title);  
                    callback(Lampa.Utils.hash(originalTitle || title), null);  
                    return;  
                }  
                
                var searchQuery = searchQueries[currentQueryIndex];  
                var searchType = isTV ? 'tv' : 'movie';  
                
                // Сначала пробуем с годом  
                tryWithYear(searchQuery, year);  
                
                function tryWithYear(query, searchYear) {  
                    var url = Lampa.TMDB.api('search/' + searchType + '?query=' + encodeURIComponent(query) + '&api_key=' + Lampa.TMDB.key());  
                    
                    if (searchYear) {  
                        url += '&' + (isTV ? 'first_air_date_year' : 'year') + '=' + searchYear;  
                    }  
                    
                    Log.info('Title search:', url, 'Query:', query, 'Year:', searchYear || 'no year');  
                    
                    network.timeout(1000 * 10);  
                    network.silent(url, function(results) {  
                        Log.info('Title search results:', query, 'year:', searchYear, results);  
                        
                        if (results && results.results && results.results.length > 0) {  
                            // Ищем точное совпадение по названию  
                            var exactMatch = null;  
                            for (var i = 0; i < results.results.length; i++) {  
                                var item = results.results[i];  
                                var itemTitle = isTV ? (item.name || item.original_name) : (item.title || item.original_title);  
                                
                                if (itemTitle.toLowerCase() === query.toLowerCase()) {  
                                    exactMatch = item;  
                                    break;  
                                }  
                            }  
                            
                            // Если нашли точное совпадение, используем его  
                            if (exactMatch) {  
                                Log.info('Found exact match:', exactMatch.id, exactMatch.title || exactMatch.name);  
                                callback(exactMatch.id, exactMatch);  
                                return;  
                            }  
                            
                            // Если один результат, используем его  
                            if (results.results.length === 1) {  
                                var singleMatch = results.results[0];  
                                Log.info('Single result found:', singleMatch.id, singleMatch.title || singleMatch.name);  
                                callback(singleMatch.id, singleMatch);  
                                return;  
                            }  
                            
                            // Если множественные результаты и поиск БЕЗ года, фильтруем по году первого эпизода  
                            if (results.results.length > 1 && !searchYear && showData && isTV) {  
                                var firstEpisodeYear = getFirstEpisodeYear(showData);  
                                if (firstEpisodeYear) {  
                                    Log.info('Multiple results, filtering by S01E01 year:', firstEpisodeYear);  
                                    
                                    var yearFilteredResults = results.results.filter(function(item) {  
                                        if (item.first_air_date) {  
                                            var itemYear = new Date(item.first_air_date).getFullYear();  
                                            return Math.abs(itemYear - firstEpisodeYear) <= 1; // Допуск ±1 год  
                                        }  
                                        return false;  
                                    });  
                                    
                                    if (yearFilteredResults.length === 1) {  
                                        var filteredMatch = yearFilteredResults[0];  
                                        Log.info('Found by S01E01 year filter:', filteredMatch.id, filteredMatch.name);  
                                        callback(filteredMatch.id, filteredMatch);  
                                        return;  
                                    } else if (yearFilteredResults.length > 1) {  
                                        // Берем первый из отфильтрованных  
                                        var firstFiltered = yearFilteredResults[0];  
                                        Log.info('Using first from S01E01 filtered results:', firstFiltered.id, firstFiltered.name);  
                                        callback(firstFiltered.id, firstFiltered);  
                                        return;  
                                    }  
                                }  
                            }  
                            
                            // Используем первый результат как fallback  
                            var fallbackMatch = results.results[0];  
                            Log.info('Using first result as fallback:', fallbackMatch.id, fallbackMatch.title || fallbackMatch.name);  
                            callback(fallbackMatch.id, fallbackMatch);  
                            return;  
                        }  
                        
                        // Если поиск с годом не дал результатов, пробуем без года  
                        if (searchYear) {  
                            Log.info('No results with year, trying without year');  
                            tryWithYear(query, null);  
                            return;  
                        }  
                        
                        // Если поиск без года тоже не дал результатов, пробуем год первого эпизода  
                        if (showData && isTV && !searchYear) {  
                            var firstEpisodeYear = getFirstEpisodeYear(showData);  
                            if (firstEpisodeYear && firstEpisodeYear !== year) {  
                                Log.info('No results without year, trying S01E01 year:', firstEpisodeYear);  
                                tryWithYear(query, firstEpisodeYear);  
                                return;  
                            }  
                        }  
                        
                        // Переходим к следующему запросу  
                        currentQueryIndex++;  
                        tryNextQuery();  
                        
                    }, function(error) {  
                        Log.error('Title search error:', error);  
                        
                        // При ошибке также пробуем без года, если искали с годом  
                        if (searchYear) {  
                            tryWithYear(query, null);  
                            return;  
                        }  
                        
                        currentQueryIndex++;  
                        tryNextQuery();  
                    });  
                }
            }  
            
            tryNextQuery();  
        }
    }  

    function getTMDBCard(tmdbId, isTV, callback) {  
        // Добавляем проверку входных параметров  
        if (!tmdbId || typeof tmdbId !== 'number') {  
            Log.info('Invalid TMDB ID:', tmdbId);  
            callback(null, 'Invalid TMDB ID');  
            return;  
        }  
        
        var method = isTV ? 'tv' : 'movie';  
        var params = {  
            method: method,  
            id: tmdbId  
        };  
        
        // Используем API Lampa для получения полной информации о карточке  
        Lampa.Api.full(params, function(response) {  
            
            // Извлекаем данные фильма/сериала из правильного места в ответе  
            var movieData = response.movie || response.tv || response;  
            
            // Добавляем валидацию ответа - проверяем movieData, а не response  
            if (movieData && movieData.id && (movieData.title || movieData.name)) {  
                if (response.persons) movieData.credits = response.persons;  
                if (response.videos) movieData.videos = response.videos;  
                if (response.recomend) movieData.recommendations = response.recomend;  
                if (response.simular) movieData.similar = response.simular;  
                    callback(movieData, null);  
                } else {  
                    Log.info('Invalid card response for ID:', tmdbId, response);  
                    callback(null, 'Invalid card data');  
                }  
        }, function(error) {  
            callback(null, error);  
        });  
    }

    var cardsToAdd = [];

    function addAllCardsAtOnce(cards) {  
        try {  
            Log.info('Adding', cards.length, 'cards to favorites');  
            
            // Сортируем карточки по дате (от новых к старым)  
            var sortedCards = cards.sort(function(a, b) {  
                var dateA, dateB;  
                
                // Для сериалов используем last_air_date, для фильмов - release_date  
                if (a.number_of_seasons || a.seasons) {  
                    dateA = a.last_air_date || a.first_air_date || '0000-00-00';  
                } else {  
                    dateA = a.release_date || '0000-00-00';  
                }  
                
                if (b.number_of_seasons || b.seasons) {  
                    dateB = b.last_air_date || b.first_air_date || '0000-00-00';  
                } else {  
                    dateB = b.release_date || '0000-00-00';  
                }  
                
                // Сортируем от новых к старым  
                return new Date(dateB) - new Date(dateA);  
            });  
            
            // Берем первые 100 карточек и делаем reverse для правильного порядка добавления  
            var cardsToAddToHistory = sortedCards.slice(0, 100).reverse();  
            
            Log.info('Adding', cardsToAddToHistory.length, 'cards to history with limit 100');  
            
            // Добавляем карточки - теперь самая старая добавится первой, а самая новая последней  
            for (var i = 0; i < cardsToAddToHistory.length; i++) {  
                Lampa.Favorite.add('history', cardsToAddToHistory[i], 100);  
            }  
            
            Log.info('Successfully added', cardsToAddToHistory.length, 'cards to history');  
            
        } catch (error) {  
            Log.error('Error adding cards:', error);  
        }  
    }

    function watchedMoviesData(callback) {  
        getWatchedMovies(function(watchedMoviesData) {  
            if (watchedMoviesData && watchedMoviesData.result) {  
                var movies = watchedMoviesData.result.map(function(movie) {  
                    return {  
                        myshowsId: movie.id,  
                        title: movie.title,  
                        titleOriginal: movie.titleOriginal,  
                        year: movie.year,  
                        runtime: movie.runtime,  
                        imdbId: movie.imdbId,  
                        kinopoiskId: movie.kinopoiskId  
                    };  
                });  
                
                Log.info('===== СПИСОК ФИЛЬМОВ =====');  
                Log.info('Всего фильмов:', movies.length);  
                Log.info('===== КОНЕЦ СПИСКА ФИЛЬМОВ =====');  
                
                callback(movies, null);  
            } else {  
                callback(null, 'Ошибка получения фильмов');  
            }  
        });  
    }
    
    function getWatchedShows(callback) {  
        makeAuthenticatedRequest({  
            method: 'POST',  
            headers: JSON_HEADERS,  
            body: createJSONRPCRequest('profile.Shows', {  
                page: 0,  
                pageSize: 1000  
            })  
        }, function(showsData) {  
            if (!showsData || !showsData.result || showsData.result.length === 0) {  
                callback([], null);  
                return;  
            }  
            
            var shows = [];  
            // var processedShows = 0;  
            var totalShows = showsData.result.length;  
            var currentIndex = 0;  
            
            // Обрабатываем сериалы последовательно с задержками  
            function processNextShow() {  
                if (currentIndex >= totalShows) {  
                    Log.info('===== СПИСОК СЕРИАЛОВ =====');  
                    Log.info('Всего сериалов с просмотренными эпизодами:', shows.length);  
                    Log.info('===== КОНЕЦ СПИСКА СЕРИАЛОВ =====');  
                    callback(shows, null);  
                    return;  
                }  
                
                var userShow = showsData.result[currentIndex];  
                var showId = userShow.show.id;  
                var showTitle = userShow.show.title;  

                Lampa.Noty.show('Получаю просмотренные эпизоды для сериала: ' + showTitle + ' (' + (currentIndex + 1) + '/' + totalShows + ')');
                
                // Получаем детали сериала  
                makeAuthenticatedRequest({  
                    method: 'POST',  
                    headers: JSON_HEADERS,  
                    body: createJSONRPCRequest('shows.GetById', {  
                        showId: showId  
                    })  
                }, function(showDetailsData) {  
                    
                    // Получаем просмотренные эпизоды  
                    makeAuthenticatedRequest({  
                        method: 'POST',  
                        headers: JSON_HEADERS,  
                        body: createJSONRPCRequest('profile.Episodes', {  
                            showId: showId
                        })  
                    }, function(episodesData) {  
                        
                        if (showDetailsData && showDetailsData.result &&   
                            episodesData && episodesData.result && episodesData.result.length > 0) {  
                            
                            var showData = showDetailsData.result;  
                            var watchedEpisodes = episodesData.result;  
                            
                            shows.push({  
                                myshowsId: showData.id,  
                                title: showData.title,  
                                titleOriginal: showData.titleOriginal,  
                                year: showData.year,  
                                imdbId: showData.imdbId,  
                                kinopoiskId: showData.kinopoiskId,  
                                totalSeasons: showData.totalSeasons,  
                                runtime: showData.runtime,  
                                episodes: showData.episodes || [],  
                                watchedEpisodes: watchedEpisodes  
                            });  
                        }  
                        
                        currentIndex++;  
                        // Добавляем задержку между запросами  
                        setTimeout(processNextShow, 10);  
                        
                    }, function(error) {  
                        Log.info('Error getting episodes for show', showId, error);  
                        currentIndex++;  
                        setTimeout(processNextShow, 100);  
                    });  
                    
                }, function(error) {  
                    Log.info('Error getting show details for', showId, error);  
                    currentIndex++;  
                    setTimeout(processNextShow, 100);  
                });  
            }  
            
            processNextShow();  
            
        }, function(error) {  
            Log.info('Error getting shows:', error);  
            callback(null, 'Ошибка получения сериалов');  
        });  
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

    if (window.Lampa && Lampa.Player && Lampa.Player.listener) {  
        Lampa.Player.listener.follow('start', function(data) {  
            Lampa.Storage.set('myshows_was_watching', true);  
        });  
          
        // Для внешнего плеера  
        Lampa.Player.listener.follow('external', function(data) {  
            Lampa.Storage.set('myshows_was_watching', true);  
        });  
    }  

    // Обработчики
    Lampa.Listener.follow('full', function(e) {    
        if (e.type == 'complite' && e.data && e.data.movie) {    
            var identifiers = getCardIdentifiers(e.data.movie);
            if (!identifiers) return;
            
            var isTV = !isMovieContent(e.data.movie); 
            var title = identifiers.title;
            var originalTitle = identifiers.originalName;
            
            if (isTV) {
                // Для сериалов
                getStatusByTitle(originalTitle, false, function(cachedStatus) {
                    Log.info('cachedStatus TV', cachedStatus);  
                    
                    if (!cachedStatus || cachedStatus === 'remove') {
                        updateButtonStates('remove', false, false);
                    }

                    if (getProfileSetting('myshows_button_view', true) && getProfileSetting('myshows_token', false)) {
                        createMyShowsButtons(e, cachedStatus, false);
                    }
                });
                
                // Асинхронная проверка актуального статуса
                getShowIdByExternalIds(
                    identifiers.imdbId, 
                    identifiers.kinopoiskId, 
                    title, 
                    originalTitle, 
                    identifiers.tmdbId, 
                    identifiers.year, 
                    identifiers.alternativeTitles, 
                    function(showId) { 
                        if (showId) {    
                            getShowStatus(showId, function(currentStatus) {    
                                Log.info('currentStatus TV', currentStatus);  
                                updateButtonStates(currentStatus, false, true);    
                            });    
                        }    
                    }
                );
                
            } else {
                // Для фильмов
                getStatusByTitle(originalTitle, true, function(cachedStatus) {  
                    Log.info('cachedStatus Movie', cachedStatus);  
                    
                    if (!cachedStatus || cachedStatus === 'remove') {  
                        updateButtonStates('remove', true, false); 
                    }  

                    if (getProfileSetting('myshows_button_view', true) && getProfileSetting('myshows_token', false)) {
                        createMyShowsButtons(e, cachedStatus, true);   
                    }
                });  
            }
        }    
    });

    //
    var cachedShuffledItems = {}; 
    // Создаем API через фабрику  
    function ApiMyShows() {    
        
        Log.info('=== ApiMyShows Factory START ===');    
        
        function myshowsWatchlist(object, oncomplite, onerror) {    
            Log.info('=== API myshowsWatchlist START ===');    
            Log.info('API myshowsWatchlist: object params:', {    
                url: object.url,    
                title: object.title,    
                component: object.component,    
                page: object.page    
            });     
            
            makeMyShowsJSONRPCRequest('profile.Shows', {}, function(success, showsData) {    
                Log.info('API myshowsWatchlist: Shows request - success:', success);    
                Log.info('API myshowsWatchlist: Shows data:', showsData ? JSON.stringify(showsData).substring(0, 200) + '...' : 'null');    
                
                makeMyShowsJSONRPCRequest('profile.UnwatchedMovies', {    
                }, function(success, moviesData) {    
                    Log.info('API myshowsWatchlist: Movies request - success:', success);    
                    Log.info('API myshowsWatchlist: Movies data:', moviesData ? JSON.stringify(moviesData).substring(0, 200) + '...' : 'null');    
                    
                    var allItems = [];    
                    
                    // Обработка сериалов    
                    if (showsData && showsData.result) {    
                        Log.info('API myshowsWatchlist: Processing', showsData.result.length, 'shows');    
                        for (var i = 0; i < showsData.result.length; i++) {    
                            var item = showsData.result[i];    
                            if (item.watchStatus === 'later') {    
                                allItems.push({    
                                    myshowsId: item.show.id,    
                                    title: item.show.title,    
                                    originalTitle: item.show.titleOriginal,    
                                    year: item.show.year,    
                                    watchStatus: item.watchStatus,    
                                    type: 'show'    
                                });    
                            }    
                        }    
                    }    
                    
                    // Обработка фильмов    
                    if (moviesData && moviesData.result) {    
                        Log.info('API myshowsWatchlist: Processing', moviesData.result.length, 'movies');    
                        for (var i = 0; i < moviesData.result.length; i++) {    
                            var movie = moviesData.result[i];    
                            allItems.push({    
                                myshowsId: movie.id,    
                                title: movie.title,    
                                originalTitle: movie.titleOriginal,    
                                year: movie.year,    
                                watchStatus: 'later',    
                                type: 'movie'    
                            });    
                        }    
                    }    
                    
                    Log.info('API myshowsWatchlist: Total items before TMDB:', allItems.length);    

                    // Создаем ключ для кеширования  
                    var cacheKey = 'watchlist';  
                    
                    // Если массив еще не перемешан, перемешиваем и кешируем  
                    if (!cachedShuffledItems[cacheKey]) {  
                        Lampa.Arrays.shuffle(allItems);  
                        cachedShuffledItems[cacheKey] = allItems.slice(); // Копируем массив  
                    } else {  
                        allItems = cachedShuffledItems[cacheKey].slice(); // Используем кешированный  
                    } 
                    
                    // --- виртуальная пагинация ---  
                    var PAGE_SIZE = 20;  
                    var currentPage = object.page || 1;  
                    var totalPages = Math.ceil(allItems.length / PAGE_SIZE);  
                    var start = (currentPage - 1) * PAGE_SIZE;  
                    var end = start + PAGE_SIZE;  
                    var itemsForPage = allItems.slice(start, end);  
                    
                    Log.info('myshowsWatchlist: page ' + currentPage + '/' + totalPages + ', sending ' + itemsForPage.length + ' items');  
                    Log.info('API myshowsWatchlist: allItems:', allItems);
                    
                    // Обогащение через TMDB только для текущей страницы  
                    getTMDBDetailsSimple(itemsForPage, function(result) {    
                        result.page = currentPage;  
                        result.total_pages = totalPages;  
                        result.total_results = allItems.length;
                        
                        Log.info('API myshowsWatchlist: TMDB enrichment complete');    
                        Log.info('API myshowsWatchlist: Final result count:', result.results ? result.results.length : 0);    
                        Log.info('=== API myshowsWatchlist END ===');    
                        oncomplite(result);    
                    });    
                });    
            });    
        }    
        
        function myshowsWatched(object, oncomplite, onerror) {  
            Log.info('=== API myshowsWatched START (Virtual Pagination) ===');  
    
            var PAGE_SIZE = 20;                   
            var currentPage = object.page || 1;  
    
            makeMyShowsJSONRPCRequest('profile.Shows', {}, function(success, showsData) {  
                makeMyShowsJSONRPCRequest('profile.WatchedMovies', {}, function(success, moviesData) {  
    
                    var allItems = [];  
    
                    // --- сериалы ---  
                    if (showsData && showsData.result) {  
                        for (var i = 0; i < showsData.result.length; i++) {  
                            var item = showsData.result[i];  
                            if (item.watchStatus === 'watching' || item.watchStatus === 'finished') {  
                                allItems.push({  
                                    myshowsId: item.show.id,  
                                    title: item.show.title,  
                                    originalTitle: item.show.titleOriginal,  
                                    year: item.show.year,  
                                    watchStatus: item.watchStatus,  
                                    type: 'show'  
                                });  
                            }  
                        }  
                    }  
    
                    // --- фильмы ---  
                    if (moviesData && moviesData.result) {  
                        for (var i = 0; i < moviesData.result.length; i++) {  
                            var movie = moviesData.result[i];  
                            allItems.push({  
                                myshowsId: movie.id,  
                                title: movie.title,  
                                originalTitle: movie.titleOriginal,  
                                year: movie.year,  
                                watchStatus: 'finished',  
                                type: 'movie'  
                            });  
                        }  
                    }  
    
                    Log.info('myshowsWatched: TOTAL ITEMS = ' + allItems.length);  

                    // Создаем ключ для кеширования  
                    var cacheKey = 'watched';  
                    
                    // Если массив еще не перемешан, перемешиваем и кешируем  
                    if (!cachedShuffledItems[cacheKey]) {  
                        Lampa.Arrays.shuffle(allItems);  
                        cachedShuffledItems[cacheKey] = allItems.slice(); // Копируем массив  
                    } else {  
                        allItems = cachedShuffledItems[cacheKey].slice(); // Используем кешированный  
                    }  
    
                    // --- виртуальная пагинация ---  
                    var totalPages = Math.ceil(allItems.length / PAGE_SIZE);  
                    var start = (currentPage - 1) * PAGE_SIZE;  
                    var end = start + PAGE_SIZE;  
                    var itemsForPage = allItems.slice(start, end);  
    
                    Log.info(  
                        'myshowsWatched: page ${currentPage}/${totalPages}, sending ${itemsForPage.length} items'  
                    );  
    
                    // Загружаем TMDB только для текущей страницы!  
                    getTMDBDetailsSimple(itemsForPage, function(result) {  
                        result.page = currentPage;  
                        result.total_pages = totalPages;  
                        result.total_results = allItems.length;
    
                        Log.info('=== API myshowsWatched END ===');  
                        oncomplite(result);  
                    });  
                });  
            });  
        }  
    
        function myshowsCancelled(object, oncomplite, onerror) {    
            Log.info('=== API myshowsCancelled START ===');    
            
            makeMyShowsJSONRPCRequest('profile.Shows', {}, function(success, showsData) {    
                var allItems = [];    
                
                if (showsData && showsData.result) {    
                    for (var i = 0; i < showsData.result.length; i++) {    
                        var item = showsData.result[i];    
                        if (item.watchStatus === 'cancelled') {    
                            allItems.push({    
                                myshowsId: item.show.id,    
                                title: item.show.title,    
                                originalTitle: item.show.titleOriginal,    
                                year: item.show.year,    
                                watchStatus: item.watchStatus,    
                                type: 'show'    
                            });    
                        }    
                    }    
                }    

                // Создаем ключ для кеширования  
                var cacheKey = 'cancelled';  
                
                // Если массив еще не перемешан, перемешиваем и кешируем  
                if (!cachedShuffledItems[cacheKey]) {  
                    Lampa.Arrays.shuffle(allItems);  
                    cachedShuffledItems[cacheKey] = allItems.slice(); // Копируем массив  
                } else {  
                    allItems = cachedShuffledItems[cacheKey].slice(); // Используем кешированный  
                }  
                
                // --- виртуальная пагинация ---  
                var PAGE_SIZE = 20;  
                var currentPage = object.page || 1;  
                var totalPages = Math.ceil(allItems.length / PAGE_SIZE);  
                var start = (currentPage - 1) * PAGE_SIZE;  
                var end = start + PAGE_SIZE;  
                var itemsForPage = allItems.slice(start, end);  
                
                Log.info('myshowsCancelled: page ' + currentPage + '/' + totalPages + ', sending ' + itemsForPage.length + ' items');  
                
                // Обогащение через TMDB только для текущей страницы  
                getTMDBDetailsSimple(itemsForPage, function(result) {    
                    result.page = currentPage;  
                    result.total_pages = totalPages;  
                    result.total_results = allItems.length;
                    
                    Log.info('=== API myshowsCancelled END ===');    
                    oncomplite(result);    
                });    
            });    
        }    
        
        Log.info('=== ApiMyShows Factory END ===');    
        
        return {    
            myshowsWatchlist: myshowsWatchlist,    
            myshowsWatched: myshowsWatched,    
            myshowsCancelled: myshowsCancelled    
        };    
    }  
        
    // Создаем экземпляр API  
    var Api = ApiMyShows();  
    Log.info('Api object created:', typeof Api, 'methods:', Object.keys(Api));
   
    // Регистрируем компоненты      
    function addMyShowsComponents() {  
        
        Lampa.Component.add('myshows_all', function(object) {  
            var comp = Lampa.Maker.make('Main', object);  
            
            comp.use({  
                onCreate: function() {  
                    this.activity.loader(true);  
                    
                    var token = getProfileSetting('myshows_token', '');  
                    
                    // Проверяем токен только при создании компонента
                    if (!token) {  
                        this.empty();  
                        this.activity.loader(false);  
                        return;  
                    }  
                    
                    var allData = {};  
                    var loaded = 0;  
                    var total = 3;  
                    
                    function checkComplete() {  
                        loaded++;  
                        if (loaded === total) {  
                            buildLines.call(this);  
                        }  
                    }  
                    
                    Api.myshowsWatchlist({page: 0}, function(result) {  
                        allData.watchlist = result;  
                        checkComplete.call(this);  
                    }.bind(this));  
                    
                    Api.myshowsWatched({page: 0}, function(result) {  
                        allData.watched = result;  
                        checkComplete.call(this);  
                    }.bind(this));  
                    
                    Api.myshowsCancelled({page: 0}, function(result) {  
                        allData.cancelled = result;  
                        checkComplete.call(this);  
                    }.bind(this));
                    
                    function buildLines() {  
                        Log.info('Watchlist total_pages:', allData.watchlist.total_pages);  
                        Log.info('Watched total_pages:', allData.watched.total_pages);  
                        Log.info('Cancelled total_pages:', allData.cancelled.total_pages);
                        var lines = [];  

                        getUnwatchedShowsWithDetails(function(result) {  
                            if (result && result.shows && result.shows.length > 0) {  
                                lines.unshift({  
                                    title: 'Непросмотренные сериалы (MyShows)',  
                                    results: result.shows,  
                                    params: {  
                                        module: Lampa.Maker.module('Line').only('Items', 'Create', 'More', 'Event'),  
                                        emit: {  
                                            onMore: function() {  
                                                Lampa.Activity.push({  
                                                    url: '',  
                                                    title: 'Непросмотренные сериалы (MyShows)',  
                                                    component: 'myshows_unwatched',  
                                                    page: 2  
                                                });  
                                            }  
                                        }  
                                    }  
                                });  
                            }  
                            
                            // Добавляем остальные линии  
                            if (allData.watchlist && allData.watchlist.results && allData.watchlist.results.length) {  
                                lines.push({  
                                    title: 'Хочу посмотреть',  
                                    results: allData.watchlist.results,  
                                    total_pages: allData.watchlist.total_pages || 1,  
                                    params: {  
                                        module: Lampa.Maker.module('Line').only('Items', 'Create', 'More', 'Event'),  
                                        emit: {  
                                            onMore: function() {  
                                                Lampa.Activity.push({  
                                                    url: '',  
                                                    title: 'Хочу посмотреть (MyShows)',  
                                                    component: 'myshows_watchlist',  
                                                    page: 1  
                                                });  
                                            }  
                                        }  
                                    }  
                                });  
                            }  
                            
                            if (allData.watched && allData.watched.results && allData.watched.results.length) {    
                                Log.info('allData.watched', allData.watched);  
                            
                                lines.push({  
                                    title: 'История',  
                                    results: allData.watched.results,  
                                    total_pages: allData.watched.total_pages || 1,  
                                    params: {  
                                        module: Lampa.Maker.module('Line').only('Items', 'Create', 'More', 'Event'),  
                                        emit: {  
                                            onMore: function() {  
                                                Log.info('onMore: opening watched page');  
                                                Lampa.Activity.push({  
                                                    url: '',  
                                                    title: 'История (MyShows)',  
                                                    component: 'myshows_watched',  
                                                    page: 1  
                                                });  
                                            }  
                                        }  
                                    }  
                                });
                            }
                            
                            if (allData.cancelled && allData.cancelled.results && allData.cancelled.results.length) {  
                                lines.push({  
                                    title: 'Бросил смотреть',  
                                    results: allData.cancelled.results,  
                                    total_pages: allData.cancelled.total_pages || 1,  
                                    params: {  
                                        module: Lampa.Maker.module('Line').only('Items', 'Create', 'More', 'Event'),  
                                        emit: {  
                                            onMore: function() {  
                                                Lampa.Activity.push({  
                                                    url: '',  
                                                    title: 'Бросил смотреть (MyShows)',  
                                                    component: 'myshows_cancelled',  
                                                    page: 1  
                                                });  
                                            }  
                                        }  
                                    }  
                                });
                            }   
                            
                            if (lines.length) {  
                                this.build(lines);  
                            } else {  
                                this.empty();  
                            }  
                            
                            this.activity.loader(false);  
                        }.bind(this));  
                    }
                },  
                
                onInstance: function(item, data) {  
                    item.use({  
                        onInstance: function(card, data) {  
                            card.use({  
                                onEnter: function() {  
                                    Lampa.Activity.push({  
                                        url: '',  
                                        component: 'full',  
                                        id: data.id,  
                                        method: data.name ? 'tv' : 'movie',  
                                        card: data  
                                    });  
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
        
        Lampa.Component.add('myshows_watchlist', function(object) {  
            var comp = Lampa.Maker.make('Category', object, function(module) {   
                return module.toggle(module.MASK.base, 'Pagination');    
            });   
            
            comp.use({    
                onCreate: function() {    
                    this.activity.loader(true);    
                    
                    var token = getProfileSetting('myshows_token', '');  
                    
                    // Проверяем токен только при создании компонента
                    if (!token) {  
                        this.empty();  
                        this.activity.loader(false);  
                        return;  
                    }  
                    
                    Api.myshowsWatchlist(object, function(result) {    
                        this.build(Lampa.Utils.addSource(result, 'myshows'));    
                    }.bind(this), function(error) {    
                        this.empty();    
                    }.bind(this));    
                },    
                onNext: function(resolve, reject) {    
                    Api.myshowsWatchlist(object, function(result) {    
                        resolve(Lampa.Utils.addSource(result, 'myshows'));    
                    }, function(error) {    
                        reject();    
                    });    
                },    
                onInstance: function(item, data) {    
                    item.use({    
                        onEnter: function() {    
                            Lampa.Activity.push({    
                                url: '',    
                                component: 'full',    
                                id: data.id,    
                                method: data.name ? 'tv' : 'movie',    
                                card: data    
                            });    
                        },    
                        onFocus: function() {    
                            Lampa.Background.change(Lampa.Utils.cardImgBackground(data));    
                        }    
                    });    
                }    
            });    
            
            return comp;    
        });
        
        // myshows_watched  
        Lampa.Component.add('myshows_watched', function(object) {  
            var comp = Lampa.Maker.make('Category', object, function(module) { 
                return module.toggle(module.MASK.base, 'Pagination');  
            }); 
            
            comp.use({  
                onCreate: function() {  
                    this.activity.loader(true);  
                    
                    var token = getProfileSetting('myshows_token', '');  
                    
                    // Проверяем токен только при создании компонента
                    if (!token) {  
                        this.empty();  
                        this.activity.loader(false);  
                        return;  
                    }  
                    
                    // НЕ перезаписывайте page - используйте переданный параметр  
                    Api.myshowsWatched(object, function(result) {  
                        this.build(Lampa.Utils.addSource(result, 'myshows'));  
                    }.bind(this), function(error) {  
                        this.empty();  
                    }.bind(this));  
                },  
                onNext: function(resolve, reject) {  
                    Api.myshowsWatched(object, function(result) {  
                        resolve(Lampa.Utils.addSource(result, 'myshows'));  
                    }, function(error) {  
                        reject();  
                    });  
                },  
                onInstance: function(item, data) {  
                    item.use({  
                        onEnter: function() {  
                            Lampa.Activity.push({  
                                url: '',  
                                component: 'full',  
                                id: data.id,  
                                method: data.name ? 'tv' : 'movie',  
                                card: data  
                            });  
                        },  
                        onFocus: function() {  
                            Lampa.Background.change(Lampa.Utils.cardImgBackground(data));  
                        }  
                    });  
                }  
            });  
            
            return comp;  
        });
        
        // myshows_cancelled  
        Lampa.Component.add('myshows_cancelled', function(object) {  
            var comp = Lampa.Maker.make('Category', object, function(module) {   
                return module.toggle(module.MASK.base, 'Pagination');    
            });   
            
            comp.use({    
                onCreate: function() {    
                    this.activity.loader(true);    
                    
                    var token = getProfileSetting('myshows_token', '');  
                    
                    // Проверяем токен только при создании компонента
                    if (!token) {  
                        this.empty();  
                        this.activity.loader(false);  
                        return;  
                    }  
                    
                    Api.myshowsCancelled(object, function(result) {    
                        this.build(Lampa.Utils.addSource(result, 'myshows'));    
                    }.bind(this), function(error) {    
                        this.empty();    
                    }.bind(this));    
                },    
                onNext: function(resolve, reject) {    
                    Api.myshowsCancelled(object, function(result) {    
                        resolve(Lampa.Utils.addSource(result, 'myshows'));    
                    }, function(error) {    
                        reject();    
                    });    
                },    
                onInstance: function(item, data) {    
                    item.use({    
                        onEnter: function() {    
                            Lampa.Activity.push({    
                                url: '',    
                                component: 'full',    
                                id: data.id,    
                                method: data.name ? 'tv' : 'movie',    
                                card: data    
                            });    
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

    function getTMDBDetailsSimple(items, callback) {  
        Log.info('getTMDBDetailsSimple: Started with', items.length, 'items to enrich');  
            
        var data = { results: [] }; 
        
        if (items.length === 0) {    
            Log.info('getTMDBDetailsSimple: No items to process, returning empty result');    
            callback({  
                page: 1,  
                results: [],  
                total_pages: 0,  
                total_results: 0 
            });    
            return;    
        }
            
        var status = new Lampa.Status(items.length);  
        status.onComplite = function() {  
            Log.info('getTMDBDetailsSimple: All requests completed, have', data.results.length, 'enriched items');    
            callback({results: data.results});  
        };  
            
        for (var i = 0; i < items.length; i++) {  
            var item = items[i];  
                
            (function(currentItem, index) {
                if (currentItem.type === 'movie') {  
                    var searchUrl = 'search/movie' +   
                        '?api_key=' + Lampa.TMDB.key() +   
                        '&query=' + encodeURIComponent(currentItem.originalTitle || currentItem.title) +   
                        '&year=' + currentItem.year +   
                        '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                        
                    var network = new Lampa.Reguest();  
                    network.silent(Lampa.TMDB.api(searchUrl), function (searchResponse) {  
                        if (searchResponse && searchResponse.results && searchResponse.results.length > 0) {  
                            var foundMovie = searchResponse.results[0];  
                            // ВАЖНО: Устанавливаем правильные ID  
                            foundMovie.id = foundMovie.id; // TMDB ID  
                            foundMovie.myshowsId = currentItem.myshowsId; // Сохраняем MyShows ID  
                            foundMovie.watchStatus = currentItem.watchStatus;  
                            foundMovie.type = 'movie';  
                            data.results.push(foundMovie);  
                            Log.info('getTMDBDetailsSimple: Added movie with TMDB ID:', foundMovie.id, 'for MyShows ID:', currentItem.myshowsId);  
                        }  
                        status.append('movie_' + index, {});  
                    }, function(error) {  
                        Log.info('getTMDBDetailsSimple: Movie search error for', currentItem.title, ':', error);  
                        status.error();  
                    });  
                } else {  
                    var searchUrl = 'search/tv' +   
                        '?api_key=' + Lampa.TMDB.key() +   
                        '&query=' + encodeURIComponent(currentItem.originalTitle || currentItem.title) +   
                        '&year=' + currentItem.year +   
                        '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');  
                        
                    var network = new Lampa.Reguest();  
                    network.silent(Lampa.TMDB.api(searchUrl), function (searchResponse) {  
                        if (searchResponse && searchResponse.results && searchResponse.results.length > 0) {  
                            var foundShow = searchResponse.results[0];  
                            foundShow.id = foundShow.id; // TMDB ID  
                            foundShow.myshowsId = currentItem.myshowsId; // Сохраняем MyShows ID  
                            foundShow.watchStatus = currentItem.watchStatus;  
                            foundShow.type = 'tv';  
                            foundShow.last_episode_date = foundShow.first_air_date;  
                            data.results.push(foundShow);  
                            Log.info('getTMDBDetailsSimple: Added TV show with TMDB ID:', foundShow.id, 'for MyShows ID:', currentItem.myshowsId);  
                        }  
                        status.append('tv_' + index, {});  
                    }, function(error) {  
                        Log.info('getTMDBDetailsSimple: TV search error for', currentItem.title, ':', error);  
                        status.error();  
                    });  
                }
            })(item, i);
        }  
    }

    function addMyShowsMenuItems() {  
        // Функция обновления пункта меню
        function updateMyShowsMenuItem() {
            var token = getProfileSetting('myshows_token', '');  
            var menuItem = $('.menu__item.selector .menu__text:contains("MyShows")').closest('.menu__item');
            
            // Если токен есть, добавляем кнопку (если её ещё нет)
            if (token) {
                if (menuItem.length === 0) {
                    var allButton = $('<li class="menu__item selector">' +  
                        '<div class="menu__ico">' + myshows_icon + '</div>' +  
                        '<div class="menu__text">MyShows</div>' +  
                        '</li>');  
                    
                    allButton.on('hover:enter', function() {  
                        Lampa.Activity.push({  
                            url: '',  
                            title: 'MyShows',  
                            component: 'myshows_all',  
                        });  
                    });  
                    
                    $('.menu .menu__list').eq(0).append(allButton);  
                    Log.info('MyShows menu item added for profile');
                }
            } 
            // Если токена нет, удаляем кнопку
            else {
                if (menuItem.length > 0) {
                    menuItem.remove();
                    Log.info('MyShows menu item removed for profile');
                }
            }
        }
        
        // Инициализация
        updateMyShowsMenuItem();
        
        // Слушаем изменения профиля для обновления меню Lampac
        Lampa.Listener.follow('profile', function(e) {
            if (e.type === 'changed') {
                Log.info('Profile changed, updating MyShows menu');
                setTimeout(updateMyShowsMenuItem, 100);
                setTimeout(addMyShowsButtonStyles, 100); 
                setTimeout(addProgressMarkerStyles, 100);
            }
        });

        // Слушаем изменения профиля для обновления меню Lampa
        Lampa.Listener.follow('state:changed', function(e) {  
            if (e.target === 'favorite' && e.reason === 'profile') {   
                Log.info('Profile changed, updating MyShows menu');
                setTimeout(updateMyShowsMenuItem, 100);  
            }  
        });
    }

    //

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

    function init() {  
        if (typeof Lampa === 'undefined' || !Lampa.Storage) {  
            setTimeout(init, 100);  
            return;  
        }  
        
        // ✅ Глобальный обработчик для ВСЕХ карточек (включая те, что ещё не отрендерены)  
        document.addEventListener('visible', function(e) {  
            var cardElement = e.target;  
            
            // Проверяем, что это карточка из секции MyShows  
            if (cardElement && cardElement.classList.contains('card')) {  
                var cardData = cardElement.card_data;  
                
                // Проверяем наличие кастомных данных MyShows  
                if (cardData && (cardData.progress_marker || cardData.next_episode || cardData.remaining)) {  
                    Log.info('Card visible, adding markers:', cardData.original_title || cardData.title);  
                    addProgressMarkerToCard(cardElement, cardData);  
                }  
            }  
        }, true); // true = capture phase для перехвата события до его обработки  
        
        // ✅ Обновляем карточки при изменении timeline  
        Lampa.Listener.follow('timeline', function(e) {  
            setTimeout(function() {  
                var cards = document.querySelectorAll('.card');  
                cards.forEach(function(cardElement) {  
                    var cardData = cardElement.card_data;  
                    if (cardData && (cardData.progress_marker || cardData.next_episode || cardData.remaining)) {  
                        addProgressMarkerToCard(cardElement, cardData);  
                    }  
                });  
            }, 100);  
        });  
    }  

    function addProgressMarkerToCard(htmlElement, cardData) {  
        var cardElement = htmlElement;  
        
        if (htmlElement && (htmlElement.get || htmlElement.jquery)) {  
            cardElement = htmlElement.get ? htmlElement.get(0) : htmlElement[0];  
        }  
        
        if (!cardElement) return;  
        
        if (!cardData) {  
            cardData = cardElement.card_data || cardElement.data;  
        }  
        
        if (!cardData) return;  
        
        var cardView = cardElement.querySelector('.card__view');  
        if (!cardView) return;  
        
        // ✅ Маркер прогресса
        if (cardData.progress_marker) {  
            var progressMarker = cardView.querySelector('.myshows-progress');  
            
            if (progressMarker) {  
                var oldText = progressMarker.textContent || '';
                var newText = cardData.progress_marker;
                
                if (oldText !== newText) {  
                    // ✅ Запускаем анимацию для прогресса
                    updateCardWithAnimation(cardElement, newText, 'myshows-progress');
                }  
            } else {  
                // Создаем новый маркер
                progressMarker = document.createElement('div');  
                progressMarker.className = 'myshows-progress';  
                progressMarker.textContent = cardData.progress_marker;  
                cardView.appendChild(progressMarker);  
                
                // Анимация появления
                setTimeout(function() {  
                    progressMarker.classList.add('digit-animating');  
                    setTimeout(function() {  
                        progressMarker.classList.remove('digit-animating');  
                    }, 600);  
                }, 50);  
            }  
        }  

        // ✅ Маркер оставшихся серий (СЕЙЧАС ТОЖЕ С АНИМАЦИЕЙ!)
        if (cardData.remaining !== undefined && cardData.remaining !== null) {  
            var remainingMarker = cardView.querySelector('.myshows-remaining');  
            
            if (remainingMarker) {  
                var oldRemaining = remainingMarker.textContent || '';
                var newRemaining = cardData.remaining.toString();
                
                if (oldRemaining !== newRemaining) {  
                    // ✅ Запускаем анимацию для оставшихся
                    updateCardWithAnimation(cardElement, newRemaining, 'myshows-remaining');
                }  
            } else {  
                remainingMarker = document.createElement('div');  
                remainingMarker.className = 'myshows-remaining';  
                remainingMarker.textContent = cardData.remaining;  
                cardView.appendChild(remainingMarker);  
                
                // Анимация появления
                setTimeout(function() {  
                    remainingMarker.classList.add('digit-animating');  
                    setTimeout(function() {  
                        remainingMarker.classList.remove('digit-animating');  
                    }, 600);  
                }, 50);  
            }  
        } else {
            // Удаляем если не нужно
            var existingRemaining = cardView.querySelector('.myshows-remaining');
            if (existingRemaining) existingRemaining.remove();
        }  
        
        // ✅ Маркер следующей серии (СЕЙЧАС ТОЖЕ С АНИМАЦИЕЙ!)
        if (cardData.next_episode) {  
            var nextEpisodeMarker = cardView.querySelector('.myshows-next-episode');  
            
            if (nextEpisodeMarker) {  
                var oldNext = nextEpisodeMarker.textContent || '';
                var newNext = cardData.next_episode;
                
                if (oldNext !== newNext) {  
                    // ✅ Запускаем анимацию для следующей серии
                    updateCardWithAnimation(cardElement, newNext, 'myshows-next-episode');
                }  
            } else {  
                nextEpisodeMarker = document.createElement('div');  
                nextEpisodeMarker.className = 'myshows-next-episode';  
                nextEpisodeMarker.textContent = cardData.next_episode;  
                cardView.appendChild(nextEpisodeMarker);  
                
                // Анимация появления
                setTimeout(function() {  
                    nextEpisodeMarker.classList.add('digit-animating');  
                    setTimeout(function() {  
                        nextEpisodeMarker.classList.remove('digit-animating');  
                    }, 600);  
                }, 50);  
            }  
        } else {
            // Удаляем если не нужно
            var existingNext = cardView.querySelector('.myshows-next-episode');
            if (existingNext) existingNext.remove();
        }  
    }

    // Функция инициализации
    function initMyShowsPlugin() {
        // Сначала проверяем среду
        checkLampacEnvironment(function(isLampac) {
            IS_LAMPAC = isLampac;
            Log.info('✅ Среда:', IS_LAMPAC ? 'Lampac' : 'Обычная Lampa');
            
            addMyShowsToTMDB();  
            addMyShowsToCUB();  
            // Небольшая задержка для стабильности
            setTimeout(function() {
                // Инициализируем все компоненты
                initCurrentProfile();  
                initSettings();    
                initMyShowsCaches();  
                addMyShowsComponents();
                addMyShowsMenuItems();
                cleanupOldMappings();  
                initTimelineListener();    
                addProgressMarkerStyles();  
                addMyShowsButtonStyles();  
                init();
            }, 50);
        });
    }

    // Проверка Lampac
    function checkLampacEnvironment(callback) {
        
        // Проверка через /version
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/version', true);
        
        xhr.onload = function() {
            callback(xhr.status === 200);
        };
        
        xhr.onerror = function() {
            callback(false);
        };
        
        xhr.send();
    }

    // Запуск
    if (window.appready) {  
        initMyShowsPlugin();
    } else {    
        Lampa.Listener.follow('app', function (event) {    
            if (event.type === 'ready') {   
                initMyShowsPlugin();
            }    
        });    
    }
})();