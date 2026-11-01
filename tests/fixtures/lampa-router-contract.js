// Unchanged Router call/get, category_full route and Arrays helpers from supplied Lampa 3.3.4.
// Snapshot SHA-256: 6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda
(function() {
  var Activity = Lampa.Activity, Storage = Lampa.Storage, Lang = Lampa.Lang;
  function isObject(a) {
    return Object.prototype.toString.call(a) === '[object Object]';
  }
  var Arrays = {extend: function extend(a, b, replase) {
    for (var i in b) {
      if (isObject(b[i])) {
        if (a[i] == undefined) a[i] = {};
        this.extend(a[i], b[i], replase);
      } else if (a[i] == undefined || replase) a[i] = b[i];
    }
  }};
  window.__nativeRouterContract = {
    routes: [{name: "category_full", callback: function (data) {
    return {
      genres: data.genres || '',
      keywords: data.keywords || '',
      companies: data.companies || '',
      query: data.query || '',
      filter: data.filter || '',
      title: data.title || Lang.translate('title_category')
    };
  }}],
    get: function get(name) {
        return this.routes.find(function (route) {
          return route.name === name;
        });
      },
    call: function call(name, data) {
        var route = this.get(name);

        if (route) {
          var push = route.callback(data);
          Arrays.extend(push, {
            url: data.url || '',
            component: route.name,
            source: data.source || Storage.field('source'),
            page: data.page || 1
          });
          Activity.push(push);
        } else {
          Arrays.extend(data, {
            url: data.url || '',
            component: name,
            source: data.source || Storage.field('source'),
            page: data.page || 1
          });
          Activity.push(data);
        }
      }
  };
})();
