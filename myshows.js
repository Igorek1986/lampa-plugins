(function () {  
    'use strict';  

    var DEFAULT_ADD_THRESHOLD = '0';  
    var DEFAULT_MIN_PROGRESS = 90;  
    var API_URL = 'https://api.myshows.me/v2/rpc/';  
    var isInitialized = false;  
    var MAP_KEY = 'myshows_hash_map';  
    var PROXY_URL = 'https://numparser.igorek1986.ru/myshows/auth';  
  
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
            
        var addThresholdValue = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString());  
        var progressValue = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();    
        var tokenValue = getProfileSetting('myshows_token', '');    
        var loginValue = getProfileSetting('myshows_login', '');  
        var passwordValue = getProfileSetting('myshows_password', '');   
            
        Lampa.Storage.set('myshows_add_threshold', addThresholdValue, true);  
        Lampa.Storage.set('myshows_min_progress', progressValue, true);    
        Lampa.Storage.set('myshows_token', tokenValue, true);    
        Lampa.Storage.set('myshows_login', loginValue, true);  
        Lampa.Storage.set('myshows_password', passwordValue, true);  
    }    
      
    function hasProfileSetting(key) {    
        var profileKey = getProfileKey(key);    
        return window.localStorage.getItem(profileKey) !== null;    
    }  
  
    // Инициализация компонента настроек  
    function initSettings() {  
        if (isInitialized) {    
            loadProfileSettings();    
            return;    
        }   

        try {  
            if (Lampa.SettingsApi.remove) {  
            Lampa.SettingsApi.remove('myshows_auto_check');  
            }  
        } catch (e) {}  

        Lampa.SettingsApi.addComponent({  
            component: 'myshows_auto_check',  
            name: 'MyShows AutoCheck',  
            icon: '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/></svg>'  
        });  

        isInitialized = true;    
        loadProfileSettings();    

        // Настройки плагина  
        Lampa.SettingsApi.addParam({    
            component: 'myshows_auto_check',    
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
            component: 'myshows_auto_check',  
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
            component: 'myshows_auto_check',  
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
            component: 'myshows_auto_check',  
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
            var settingsPanel = document.querySelector('[data-component="myshows_auto_check"]');
            if (settingsPanel) {
                // Обновляем значения полей
                var addThresholdSelect = settingsPanel.querySelector('select[data-name="myshows_add_threshold"]');  
                if (addThresholdSelect) addThresholdSelect.value = getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString();

                var tokenInput = settingsPanel.querySelector('input[data-name="myshows_token"]');
                if (tokenInput) tokenInput.value = getProfileSetting('myshows_token', '');
                
                var progressSelect = settingsPanel.querySelector('select[data-name="myshows_min_progress"]');
                if (progressSelect) progressSelect.value = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();

                var loginInput = settingsPanel.querySelector('input[data-name="myshows_login"]');
                if (loginInput) loginInput.value = getProfileSetting('myshows_login', '');

                var passwordInput = settingsPanel.querySelector('input[data-name="myshows_password"]');
                if (passwordInput) passwordInput.value = getProfileSetting('myshows_password', '');
            }
            }, 100);
        }
    });
  
    // Получить showId по imdbId 
    function getShowIdByImdb(imdbId, token, callback) {      
        var cleanImdbId = imdbId && imdbId.startsWith('tt') ? imdbId.slice(2) : imdbId;      
                
        makeAuthenticatedRequest(API_URL, {      
            method: 'POST',      
            headers: {      
                'Content-Type': 'application/json'      
            },      
            body: JSON.stringify({      
                jsonrpc: '2.0',      
                method: 'shows.GetByExternalId',      
                params: { id: cleanImdbId, source: 'imdb' },      
                id: 1      
            })      
        }, function(data) {        
            if(data && data.result && data.result.id) {        
                callback(data.result.id);        
            } else {        
                callback(null);        
            }        
        }, function(err) {        
            callback(null);        
        });      
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
            map[hash] = ep.id;  
        }  
        return map;  
    }  
  
    // Автоматически получить mapping для текущего сериала (по imdbId из карточки)  
    function ensureHashMap(card, token, callback) {  
        var imdbId = card && (card.imdb_id || card.imdbId || (card.ids && card.ids.imdb));  
        var originalName = card && (card.original_name || card.original_title || card.title);  
        if(!imdbId || !originalName) { callback({}); return; }  
        var map = Lampa.Storage.get(MAP_KEY, {});  
        // Если mapping уже есть — используем  
        for(var h in map) { if(map.hasOwnProperty(h) && map[h].originalName === originalName) { callback(map); return; } }  
        // Получаем showId  
        getShowIdByImdb(imdbId, token, function(showId){  
            if(!showId) { callback({}); return; }  
            getEpisodesByShowId(showId, token, function(episodes){  
            var newMap = buildHashMap(episodes, originalName);  
            // Сохраняем mapping с привязкой к originalName  
            for(var k in newMap) if(newMap.hasOwnProperty(k)) map[k] = newMap[k];  
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
        getShowIdByImdb(card.imdb_id || card.imdbId || (card.ids && card.ids.imdb), token, function(showId) {          
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
        if (!card) card = Lampa.Storage.get('myshows_last_card', null);  
        if (!card) {  
            var history = Lampa.Storage.get('history', []);  
            if (Array.isArray(history) && history.length) {  
            for (var i = history.length - 1; i >= 0; i--) {  
                if (history[i].number_of_seasons || history[i].original_name) {  
                card = history[i];  
                break;  
                }  
            }  
            }  
        }  
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
            // Отмечаем серию как просмотренную  
            var episodeId = map[hash];  
            if (episodeId) {  

            // Проверяем, нужно ли добавить сериал в "Смотрю"  
            var originalName = card.original_name || card.original_title || card.title;  
            var firstEpisodeHash = Lampa.Utils.hash('11' + originalName);  
            
            // Добавляем сериал только если это первая серия И процент >= порога  
            if (hash === firstEpisodeHash && percent >= addThreshold) {    
                addShowToWatching(card, token);    
            } else if (addThreshold === 0 && hash === firstEpisodeHash) {    
                // Если порог 0%, добавляем при любом проценте первой серии    
                addShowToWatching(card, token);     
            }


            // Отмечаем серию как просмотренную только если достигнут minProgress  
            if (percent >= minProgress) {  
                checkEpisodeMyShows(episodeId, token);     
            }  

            // Сохраняем информацию о просмотренной серии  
            var watchedEpisodes = Lampa.Storage.get('myshows_watched_episodes', {});  
            watchedEpisodes[hash] = {  
                episodeId: episodeId,  
                percent: percent,  
                timestamp: new Date().toISOString()  
            };  
            Lampa.Storage.set('myshows_watched_episodes', watchedEpisodes);  
            }  
        });  
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
        autoSetupToken();
        initTimelineListener();  
    } else {  
        Lampa.Listener.follow('app', function (event) {  
        if (event.type === 'ready') {  
            initSettings();  
            autoSetupToken();
            initTimelineListener();  
        }  
        });  
    }  
})();