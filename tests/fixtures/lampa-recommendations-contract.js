// Unchanged native ContentRows/Recomends functions from the supplied Lampa 3.3.4 snapshot.
// Source: https://github.com/yumata/lampa-source
// Snapshot SHA-256: 6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda
(function() {
  var rows = [], data = [], component$o = 'content_rows';
  var Storage = Lampa.Storage, Arrays = Lampa.Arrays, Lang = Lampa.Lang;
  var Favorite = {get: function() {return [];}};
  var Timer = {add: function() {window.__recommendationTimers = (window.__recommendationTimers || 0) + 1;}};
  var router = Lampa.Router;
  var _typeof = function(value) {return typeof value;};
  var ContentRows = {add: add$b, call: call$1};
  var Recomends = {init: init$w, get: get$4, page: page};
  function add$b(row) {
    if (_typeof(row) == 'object' && typeof row.call == 'function') {
      if (rows.indexOf(row) == -1) {
        rows.push(row);

        if (!row.name || !row.title) {
          console.warn('Content row must have name and title', row);
        }
      }
    } else {
      console.warn('Content row must be an object with a call function', row);
    }
  }

  function call$1(screen, params, calls) {
    var stop = ['genres', 'keywords'];
    if (stop.find(function (a) {
      return params[a];
    })) return;
    rows.filter(function (row) {
      return row.screen ? Arrays.isArray(row.screen) ? row.screen.indexOf(screen) >= 0 : row.screen == screen : false;
    }).filter(function (row) {
      return Storage.get(component$o + '_' + (row.name || 'unknown'), 'true');
    }).forEach(function (row) {
      var result = row.call(params, screen);

      if (Arrays.isArray(result)) {
        result.forEach(function (callback, i) {
          if (typeof callback == 'function') {
            Arrays.insert(calls, (row.index || 0) + i, callback);
          } else if (Arrays.isObject(callback)) {
            Arrays.insert(calls, (row.index || 0) + i, callback);
          }
        });
      } else if (Arrays.isObject(result)) {
        Arrays.insert(calls, row.index || 0, result);
      } else if (typeof result == 'function') {
        Arrays.insert(calls, row.index || 0, result);
      }
    });
  }

  function init$w() {
    data = Storage.cache('recomends_scan', 300, []);
    Timer.add(120 * 1000, function () {
      var history = Favorite.get({
        type: 'history'
      });
      var added = 0;
      console.log('Recomendations', 'find history:', history.length);
      history.forEach(function (elem) {
        if (['cub', 'tmdb'].indexOf(elem.source) >= 0) {
          var id = data.filter(function (a) {
            return a.id == elem.id;
          });

          if (!id.length) {
            data.push({
              id: elem.id,
              tv: elem.number_of_seasons || elem.seasons
            });
            added++;
          }
        }
      });
      console.log('Recomendations', 'added to scan:', added, 'ready:', data.length);
      Storage.set('recomends_scan', data);
      search();
    });
    ContentRows.add({
      name: 'recomend_watch',
      title: Lang.translate('title_recomend_watch'),
      index: 1,
      screen: ['main', 'category'],
      call: function call(params, screen) {
        if (params.url == 'anime') return;
        var media = screen == 'main' ? 'movie' : params.url;
        var all = get$4(media);
        var results = Arrays.shuffle(all).slice(0, 20);
        var total_pages = Math.ceil(all.length / 20);
        if (!results.length) return;
        return function (call) {
          call({
            results: results,
            title: Lang.translate('title_recomend_watch'),
            total_pages: total_pages,
            page: 1,
            params: {
              emit: {
                onlyMore: function onlyMore() {
                  router.call('recomend', {
                    media: media,
                    total_pages: total_pages
                  });
                }
              }
            }
          });
        };
      }
    });
  }

  function get$4(type) {
    var all = Storage.get('recomends_list', '[]');
    var items = all.filter(function (e) {
      return type == 'tv' ? e.number_of_seasons || e.first_air_date : !(e.number_of_seasons || e.first_air_date);
    }).reverse();
    var history = Favorite.get({
      type: 'history'
    });
    items = items.filter(function (e) {
      return !history.find(function (h) {
        return h.id == e.id;
      });
    });
    return items;
  }

  function page(object, call, empty) {
    var all = get$4(object.media);
    var page = object.page || 1;
    var result = all.slice((page - 1) * 20, page * 20);
    if (result.length == 0) return empty({
      status: 404
    });
    call({
      results: result,
      title: Lang.translate('title_recomend_watch'),
      total_pages: Math.ceil(all.length / 20),
      page: page
    });
  }
  window.__nativeRecommendationsContract = {ContentRows: ContentRows, Recomends: Recomends};
})();
