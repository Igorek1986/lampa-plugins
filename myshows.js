(function () {
  'use strict';

  var DEFAULT_MIN_PROGRESS = 95;
//   var CHECKED_HASHES = {};
  var API_URL = 'https://api.myshows.me/v2/rpc/';
  var STORAGE_KEY = 'myshows_auto_checked';
  var MAP_KEY = 'myshows_hash_map';
  Lampa.Storage.set('myshows_only_current', true);
  // Кэширование списка сериалов
  var CACHE_KEY = 'myshows_watching_list';
  var CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа



  // Добавляем компонент настроек
  Lampa.SettingsApi.addComponent({
    component: 'myshows_auto_check',
    name: 'MyShows AutoCheck',
    // title: 'MyShows AutoCheck',
    icon: '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/></svg>'
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
      default: DEFAULT_MIN_PROGRESS.toString()
    },
    field: {
      name: 'Порог просмотра',
      description: 'Минимальный процент просмотра для отметки эпизода на myshows.me'
    }
  });

  Lampa.SettingsApi.addParam({
    component: 'myshows_auto_check',
    param: {
      name: 'myshows_token',
      type: 'input',
      placeholder: 'Bearer-токен MyShows',
      values: Lampa.Storage.get('myshows_token', ''),
    },
    field: {
      name: 'MyShows Bearer Token',
      description: 'Вставьте ваш Bearer-токен для API myshows.me'
    }
  });

  // Добавляем триггер для переключения режима "отмечать только текущую серию"
  Lampa.SettingsApi.addParam({
    component: 'myshows_auto_check',
    param: {
      name: 'myshows_only_current',
      type: 'trigger',
      default: true,
      onTrigger: function() {
        var current = Lampa.Storage.get('myshows_only_current', true);
        var next = !current;
        Lampa.Storage.set('myshows_only_current', next);
        Lampa.SettingsApi.update('myshows_auto_check', 'myshows_only_current', next);
        // Надо проверить
        // Lampa.Noty.show('Режим "Отмечать только текущую серию": ' + (next ? 'ВКЛ' : 'ВЫКЛ'));
      }
    },
    field: {
      name: 'Режим "Отмечать только текущую серию"',
      description: 'Включите, чтобы отмечалась только серия, которую вы только что досмотрели. По умолчанию включено.'
    }
  });

  function isShowInList(showId, token, callback) {
    fetch('https://api.myshows.me/v2/rpc/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'profile.Shows',
        id: 1
      })
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (!data || !data.result) {
        callback(false);
        return;
      }

      var isInList = data.result.some(function(show) {
        return show.show.id === showId && show.watchStatus === 'watching';
      });
      callback(isInList);
    })
    .catch(function() {
      callback(false);
    });
  }

  function addShowToWatching(showId, token, callback) {
    isShowInList(showId, token, function(isAdded) {
      if (isAdded) {
        callback(true);
        return;
      }

      fetch('https://api.myshows.me/v2/rpc/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'manage.SetShowStatus',
          params: {
            showId: showId,
            status: "Watching"
          },
          id: 1
        })
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        callback(data.result === true);
      })
      .catch(function() {
        callback(false);
      });
    });
  }

  function getWatchingShows(token, callback, forceUpdate) {
    var cachedData = Lampa.Storage.get(CACHE_KEY, null);
    
    if (cachedData && cachedData.expires > Date.now() && !forceUpdate) {
      callback(cachedData.shows);
      return;
    }
    
    fetch('https://api.myshows.me/v2/rpc/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'profile.Shows',
        id: 1
      })
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      var result = data && data.result ? data.result : [];
      Lampa.Storage.set(CACHE_KEY, {
        shows: result,
        expires: Date.now() + CACHE_TTL
      });
      callback(result);
    })
    .catch(function() {
      callback([]);
    });
  }

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
  // function ensureHashMap(card, token, callback) {
  //   var imdbId = card && (card.imdb_id || card.imdbId || (card.ids && card.ids.imdb));
  //   var originalName = card && (card.original_name || card.original_title || card.title);
  //   if(!imdbId || !originalName) { callback({}); return; }
  //   var map = Lampa.Storage.get(MAP_KEY, {});
  //   // Если mapping уже есть — используем
  //   for(var h in map) { if(map.hasOwnProperty(h) && map[h].originalName === originalName) { callback(map); return; } }
  //   // Получаем showId
  //   getShowIdByImdb(imdbId, token, function(showId, nameFromApi){
  //     if(!showId) { callback({}); return; }
  //     getEpisodesByShowId(showId, token, function(episodes){
  //       var usedName = nameFromApi || originalName;
  //       var newMap = buildHashMap(episodes, usedName);
  //       // Сохраняем mapping с привязкой к originalName
  //       for(var k in newMap) if(newMap.hasOwnProperty(k)) map[k] = newMap[k];
  //       Lampa.Storage.set(MAP_KEY, map);
  //       callback(map);
  //     });
  //   });
  // }
  function ensureHashMap(card, token, callback) {
    var imdbId = card && (card.imdb_id || card.imdbId || (card.ids && card.ids.imdb));
    var originalName = card && (card.original_name || card.original_title || card.title);
    
    if (!imdbId || !originalName) {
      callback({});
      return;
    }
    
    var map = Lampa.Storage.get(MAP_KEY, {});
    
    // Проверяем кэш
    for (var h in map) {
      if (map.hasOwnProperty(h) && map[h].originalName === originalName) {
        // Добавляем сериал в список "Смотрю" перед callback
        getShowIdByImdb(imdbId, token, function(showId, nameFromApi) {
          if (showId) {
            addShowToWatching(showId, token, function() {
              callback(map);
            });
          } else {
            callback(map);
          }
        });
        return;
      }
    }
    
    // Получаем showId и добавляем в список
    getShowIdByImdb(imdbId, token, function(showId, nameFromApi) {
      if (!showId) {
        callback({});
        return;
      }
      
      getEpisodesByShowId(showId, token, function(episodes) {
        var usedName = nameFromApi || originalName;
        var newMap = buildHashMap(episodes, usedName);
        
        for (var k in newMap) {
          if (newMap.hasOwnProperty(k)) {
            map[k] = newMap[k];
          }
        }
        
        Lampa.Storage.set(MAP_KEY, map);
        
        // Добавляем сериал в список "Смотрю"
        addShowToWatching(showId, token, function() {
          callback(map);
        });
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
      var onlyCurrent = Lampa.Storage.get('myshows_only_current', false);
      if (onlyCurrent) {
        var lastHash = Lampa.Storage.get('myshows_last_hash', null);
        if (lastHash) {
          scanFileView(lastHash);
        } else {
        }
      }
    });
  }

  // Основная функция проверки file_view
  function scanFileView(currentHash) {
    var onlyCurrent = Lampa.Storage.get('myshows_only_current', false);
    if (onlyCurrent && !currentHash) {
      // В режиме только текущей серии — не отмечаем ничего при автозапуске
      return;
    }
    var fileView = Lampa.Storage.get('file_view', {});
    var minProgress = parseInt(Lampa.Storage.get('myshows_min_progress', DEFAULT_MIN_PROGRESS));
    var token = Lampa.Storage.get('myshows_token', '');
    var checked = Lampa.Storage.get(STORAGE_KEY, {});
    var map = Lampa.Storage.get(MAP_KEY, {});
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

      // Старое поведение — отмечать все подходящие
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

  // Сохраняем последнюю открытую карточку сериала (диагностика)
  function registerCardListener() {
    if (window.Lampa && Lampa.Activity && Lampa.Activity.listener) {
      Lampa.Activity.listener.follow('activity', function(e) {
        if (e && (e.card_data || e.card)) {
          Lampa.Storage.set('myshows_last_card', e.card_data || e.card);
        }
      });
    } else {
    }
  }

  if (window.appready) {
    registerCardListener();
  } else {
    Lampa.Listener.follow('app', function (event) {
      if (event.type === 'ready') {
        registerCardListener();
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