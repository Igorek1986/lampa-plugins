(function () {
  'use strict';

  var DEFAULT_MIN_PROGRESS = 90;
  var API_URL = 'https://api.myshows.me/v2/rpc/';
  var isInitialized = false;
  var STORAGE_KEY = 'myshows_auto_check';
  var MAP_KEY = 'myshows_hash_map';

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
    if (!hasProfileSetting('myshows_min_progress')) {  
      setProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS);  
    }  
      
    if (!hasProfileSetting('myshows_token')) {  
      setProfileSetting('myshows_token', '');  
    }  
      
    if (!hasProfileSetting('myshows_only_current')) {  
      setProfileSetting('myshows_only_current', true);  
    }  
      
    // Получаем значения из профиль-специфичного хранилища  
    var progressValue = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();  
    var tokenValue = getProfileSetting('myshows_token', '');  
    var triggerValue = getProfileSetting('myshows_only_current', true);  
      
    // Устанавливаем в стандартное хранилище ТОЛЬКО для отображения в интерфейсе  
    Lampa.Storage.set('myshows_min_progress', progressValue, true);  
    Lampa.Storage.set('myshows_token', tokenValue, true);  
    Lampa.Storage.set('myshows_only_current', triggerValue, true);  
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
        type: 'input',
        placeholder: 'Bearer-токен MyShows',
        values: getProfileSetting('myshows_token', ''),
        default: ''
      },
      field: {
        name: 'MyShows Bearer Token',
        description: 'Вставьте ваш Bearer-токен для API myshows.me'
      },
      onChange: function(value) {
        setProfileSetting('myshows_token', value);
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
          var tokenInput = settingsPanel.querySelector('input[data-name="myshows_token"]');
          if (tokenInput) tokenInput.value = getProfileSetting('myshows_token', '');
          
          var progressSelect = settingsPanel.querySelector('select[data-name="myshows_min_progress"]');
          if (progressSelect) progressSelect.value = getProfileSetting('myshows_min_progress', DEFAULT_MIN_PROGRESS).toString();
        }
      }, 100);
    }
  });

  // Получить showId по imdbId
  function getShowIdByImdb(imdbId, token, callback) {
    var cleanImdbId = imdbId && imdbId.startsWith('tt') ? imdbId.slice(2) : imdbId;
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'shows.GetByExternalId',
        params: { id: cleanImdbId, source: 'imdb' },
        id: 1
      })
    })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(data && data.result && data.result.id) callback(data.result.id, data.result.titleOriginal || data.result.title);
      else callback(null);
    })
    .catch(function(err){ 
      callback(null); 
    });
  }

  // Получить список эпизодов по showId
  function getEpisodesByShowId(showId, token, callback) {
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'shows.GetById',
        params: { showId: showId, withEpisodes: true },
        id: 1
      })
    })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(data && data.result && data.result.episodes) callback(data.result.episodes);
      else callback([]);
    })
    .catch(function(err){ 
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
  
    fetch(API_URL, {  
      method: 'POST',  
      headers: {  
        'Content-Type': 'application/json',  
        'Authorization': 'Bearer ' + token  
      },  
      body: JSON.stringify({  
        jsonrpc: '2.0',  
        method: 'manage.CheckEpisode',  
        params: { id: episodeId, rating: 0 },  
        id: 1  
      })  
    })  
    .then(response => {  
      if (!response.ok) {  
        throw new Error(`HTTP ${response.status}`);  
      }  
      return response.json();  
    })  
    .then(data => {  
      if (data.error) {  
        Lampa.Noty.show('Ошибка при отметке эпизода: ' + (data.error.message || 'Неизвестная ошибка'));
      }
    })  
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

          // 2. Проверяем file_view ДО начала просмотра
          var fileView = Lampa.Storage.get('file_view', {});
          var firstEpisodeHash = Lampa.Utils.hash('11' + originalName); // S01E01

          // 3. Если первая серия не найдена - добавляем сериал
          if (!fileView[firstEpisodeHash]) {
              
              getShowIdByImdb(card.imdb_id || card.imdbId || (card.ids && card.ids.imdb), token, function(showId, title) {
                  if (!showId) {
                      return;
                  }

                  fetch(API_URL, {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': 'Bearer ' + token
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
                  })
                  .then(function(response) {
                      return response.json();
                  })
              });
          }

          // 4. Сохраняем хэш для последующей обработки
          var hash = null;
          if (data && data.timeline && data.timeline.hash) {
              hash = data.timeline.hash;
          } else if (data && data.hash) {
              hash = data.hash;
          }
          
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