(function () {
  'use strict';

  var DEFAULT_ADD_THRESHOLD = '0';
  var DEFAULT_MIN_PROGRESS = 90;
  var API_URL = 'https://api.myshows.me/v2/rpc/';
  var isInitialized = false;
  var STORAGE_KEY = 'myshows_auto_check';
  var MAP_KEY = 'myshows_hash_map';
  var PROXY_URL = 'https://numparser.igorek1986.ru/myshows/auth';


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
            // Нормальный ответ или другая ошибка  
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
    // Проверяем существование ключей и устанавливаем значения по умолчанию если их нет  
    if (!hasProfileSetting('myshows_add_threshold')) {    
      setProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD);    
    }  

    if (!hasProfileSetting('myshows_min_progress')) {  
      setProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS);  
    }  
      
    if (!hasProfileSetting('myshows_token')) {  
      setProfileSetting('myshows_token', '');  
    }  
      
    if (!hasProfileSetting('myshows_only_current')) {  
      setProfileSetting('myshows_only_current', true);  
    }

    if (!hasProfileSetting('myshows_login')) {  
      setProfileSetting('myshows_login', '');  
    }

    if (!hasProfileSetting('myshows_password')) {
      setProfileSetting('myshows_password', '');
    }
      
    // Получаем значения из профиль-специфичного хранилища  
    var addThresholdValue = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD).toString());
    var progressValue = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();  
    var tokenValue = getProfileSetting('myshows_token', '');  
    var triggerValue = getProfileSetting('myshows_only_current', true);  
    var loginValue = getProfileSetting('myshows_login', '');
    var passwordValue = getProfileSetting('myshows_password', ''); 
    
    // Устанавливаем в стандартное хранилище ТОЛЬКО для отображения в интерфейсе  
    Lampa.Storage.set('myshows_add_threshold', addThresholdValue, true);
    Lampa.Storage.set('myshows_min_progress', progressValue, true);  
    Lampa.Storage.set('myshows_token', tokenValue, true);  
    Lampa.Storage.set('myshows_only_current', triggerValue, true);
    Lampa.Storage.set('myshows_login', loginValue, true);
    Lampa.Storage.set('myshows_password', passwordValue, true);

  }  
    
  // Вспомогательная функция для проверки существования профиль-специфичного ключа  
  function hasProfileSetting(key) {  
    var profileKey = getProfileKey(key);  
    return window.localStorage.getItem(profileKey) !== null;  
  }

  // Инициализация компонента настроек
  function initSettings() {

    // Предотвращаем повторную инициализацию  
    if (isInitialized) {  
      loadProfileSettings();  
      return;  
    } 

    // Удаляем старый компонент (если существует)
    try {
      if (Lampa.SettingsApi.remove) {
        Lampa.SettingsApi.remove('myshows_auto_check');
      }
    } catch (e) {}

    // Создаем новый компонент с текущими настройками профиля
    Lampa.SettingsApi.addComponent({
      component: 'myshows_auto_check',
      name: 'MyShows AutoCheck',
      icon: '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/></svg>'
    });

    isInitialized = true;  
    loadProfileSettings();  

    // Порог добавления сериала в список  
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

    // Порог просмотра
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

    // Токен MyShows
    Lampa.SettingsApi.addParam({  
      component: 'myshows_auto_check',  
      param: {  
        name: 'myshows_token',  
        type: 'static'  
      },  
      field: {  
        name: 'MyShows Bearer Token',  
        description: 'Токен автоматически обновляется при авторизации'  
      }, 
      onRender: function(item) {  
        var token = getProfileSetting('myshows_token', '');  
        var displayValue = token ? token.substring(0, 10) + '...' : 'Не установлен';  
        item.find('.settings-param__name').after('<div class="settings-param__value">' + displayValue + '</div>');  
      }
    });

    // Логин MyShows
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

    // Пароль MyShows
    Lampa.SettingsApi.addParam({
      component: 'myshows_auto_check',
      param: {
        name: 'myshows_password',
        type: 'input',
        placeholder: 'Пароль',
        values: getProfileSetting('myshows_password', ''),
        default: '',
        password: true // Скрываем ввод
      },
      field: {
        name: 'MyShows Пароль',
        description: 'Введите пароль от аккаунта myshows.me'
      },
      onChange: function(value) {
        setProfileSetting('myshows_password', value);
        // При изменении пароля пробуем авторизоваться
        tryAuthFromSettings();
      }
    });

    // Режим "Только текущая серия"
    Lampa.SettingsApi.addParam({
      component: 'myshows_auto_check',
      param: {
        name: 'myshows_only_current',
        type: 'trigger',
        default: getProfileSetting('myshows_only_current', true),
      },
      field: {
        name: 'Режим "Отмечать только текущую серию"',
        description: 'Включите, чтобы отмечалась только серия, которую вы только что досмотрели.'
      },
      onChange: function(value) {
        setProfileSetting('myshows_only_current', value);
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

          var CurrentTrigger = settingsPanel.querySelector('input[data-name="myshows_only_current"]');
          if (CurrentTrigger) CurrentTrigger.checked = getProfileSetting('myshows_only_current', true);

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
            callback(data.result.id, data.result.titleOriginal || data.result.title);      
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
    getShowIdByImdb(imdbId, token, function(showId, nameFromApi){
      if(!showId) { callback({}); return; }
      getEpisodesByShowId(showId, token, function(episodes){
        var usedName = nameFromApi || originalName;
        var newMap = buildHashMap(episodes, usedName);
        // Сохраняем mapping с привязкой к originalName
        for(var k in newMap) if(newMap.hasOwnProperty(k)) map[k] = newMap[k];
        Lampa.Storage.set(MAP_KEY, map);
        callback(map);
      });
    });
  }

  // Вспомогательная функция для отправки запроса на myshows
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
        callback([]);    
    });    
  }

  // Добавить сериал в "Смотрю" на MyShows
  function addShowToWatching(card, token) {  
    getShowIdByImdb(card.imdb_id || card.imdbId || (card.ids && card.ids.imdb), token, function(showId, title) {        
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

  // Сохраняем карточку при запуске плеера
  if (window.Lampa && Lampa.Player && Lampa.Player.listener) {
      Lampa.Player.listener.follow('start', function(data) {
          
          // 1. Получаем данные карточки ДО начала воспроизведения
          var card = data.card ||   
            (Lampa.Activity.active() && Lampa.Activity.active().movie) ||   
            Lampa.Storage.get('myshows_last_card');  
    
          if (!card) return;  
          
          var token = getProfileSetting('myshows_token', ''); // Используем профиль-специфичный токен  
          if (!token) return; 

          var originalName = card.original_name || card.original_title || card.title;
          if (!originalName) {
              return;
          }

          // 2. Формируем hash для текущего эпизода  
          var hash = null;  
          if (data && data.timeline && data.timeline.hash) {  
              hash = data.timeline.hash;  
          } else if (data && data.hash) {  
              hash = data.hash;  
          } 

          // 3. Формируем hash для первой серии первого сезона  
          var firstEpisodeHash = Lampa.Utils.hash('11' + originalName); // S01E01  
          var addThreshold = parseInt(getProfileSetting('myshows_add_threshold', DEFAULT_ADD_THRESHOLD)); 

          // 4. Если текущий hash совпадает с первой серией - добавляем сериал  
          if (hash && hash === firstEpisodeHash) {  
              Lampa.Storage.set('myshows_pending_show', {  
                  card: card,  
                  token: token,  
                  addThreshold: addThreshold,  
                  hash: hash  
              });  
                
              // Если порог 0% - добавляем сразу  
              if (addThreshold === 0) {  
                  addShowToWatching(card, token);  
              }  
          } 

          // 5. Сохраняем hash для последующей обработки
          if (hash) {  
            Lampa.Storage.set('myshows_last_hash', hash);  
          }  
          if (data && data.card) {  
              Lampa.Storage.set('myshows_last_card', data.card);  
          } else if (Lampa.Activity && Lampa.Activity.active && Lampa.Activity.active() && Lampa.Activity.active().movie) {  
              Lampa.Storage.set('myshows_last_card', Lampa.Activity.active().movie);  
          } 
      });

      Lampa.Player.listener.follow('destroy', function(data) {  
        var onlyCurrent = getProfileSetting('myshows_only_current', true); // Профиль-специфичная настройка  
        if (onlyCurrent) {  
          var lastHash = Lampa.Storage.get('myshows_last_hash', null);  
          if (lastHash) {  
            scanFileView(lastHash);  
          }  
        }  
      });
  }

  // Основная функция проверки file_view
  function scanFileView(currentHash) {
    var onlyCurrent = getProfileSetting('myshows_only_current', true);  
    if (onlyCurrent && !currentHash) {  
      return;  
    }
    var fileView = Lampa.Storage.get('file_view', {});  
    var minProgress = parseInt(getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS));  
    var token = getProfileSetting('myshows_token', '');  
    var checked = Lampa.Storage.get(STORAGE_KEY, {});  
    var card = getCurrentCard();  


    // Проверяем, нужно ли добавить сериал в список  
    var pendingShow = Lampa.Storage.get('myshows_pending_show', null);  
    if (pendingShow && pendingShow.addThreshold > 0) {  
        var entry = fileView[pendingShow.hash];  
        if (entry && entry.percent >= pendingShow.addThreshold) {  
            addShowToWatching(pendingShow.card, pendingShow.token);  
            Lampa.Storage.remove('myshows_pending_show'); // Убираем из ожидания  
        }  
    }

    if(!card) { return; }
    ensureHashMap(card, token, function(map){
      if (onlyCurrent && currentHash) {
        var entry = fileView[currentHash];
        if (entry) {
          if (entry.percent >= minProgress) {
            var episodeId = map[currentHash];
            if (episodeId) {
              checkEpisodeMyShows(episodeId, token);
              checked[currentHash] = true;
            }
          }
        }
        Lampa.Storage.set(STORAGE_KEY, checked);
        return;
      }

      // отмечать все подходящие
      for (var hash in fileView) {
        if (!fileView.hasOwnProperty(hash)) continue;
        var entry = fileView[hash];
        if (entry.percent >= minProgress) {
          var episodeId = map[hash];
          if (episodeId) {
            checkEpisodeMyShows(episodeId, token);
            checked[hash] = true; // Можно оставить для статистики, но не блокировать повторную отправку
          }
        }
      }
      Lampa.Storage.set(STORAGE_KEY, checked);
    });
  }

  if (window.appready) {
    initSettings();
  } else {
    Lampa.Listener.follow('app', function (event) {
      if (event.type === 'ready') {
        initSettings();
      }
    });
  }

  // Сканировать file_view при запуске и при изменениях
  scanFileView();
  Lampa.Storage.listener.follow('change', function (e) {
    if (e.name === 'file_view') {
      scanFileView();
    }
  });

})(); 