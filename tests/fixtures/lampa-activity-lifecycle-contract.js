// Unchanged ActivitySlide start/refresh/runRefresh functions from the supplied Lampa 3.3.4 snapshot.
// Snapshot SHA-256: 6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda
(function() {
  var Controller = {add: function(){}, toggle: function(){}};
  var Activity = Lampa.Activity, Noty = Lampa.Noty;
  window.__nativeActivityLifecycleContract = {
    start: function start() {
        this.is_started = true;
        this.is_stopped = false;
        Controller.add('content', {
          invisible: true,
          toggle: function toggle() {
            Controller.clear();
          },
          left: function left() {
            Controller.toggle('menu');
          },
          up: function up() {
            Controller.toggle('head');
          },
          back: function back() {
            Activity.backward();
          }
        });
        Controller.toggle('content');
        if (this.waite_refresh) this.runRefresh();else {
          try {
            this.component.start();
          } catch (e) {
            console.log('Activity', 'start error:', e.stack);
            Noty.show('Activity start error:' + e.message + ' ' + e.stack);
          }
        }
      },
    refresh: function refresh() {
        if (this.waite_refresh) return;
        this.waite_refresh = true;
        if (Activity.own(this.component)) this.runRefresh();
      },
    runRefresh: function runRefresh() {
        var _this = this;

        // Если нет пометки на обновление, то не обновляем
        if (!this.waite_refresh) return;
        clearTimeout(this.timer_refresh); // При переходе назад текушая активность уничтожается через 200мс, поэтому ждем на удаление и запускаем обновление

        this.timer_refresh = setTimeout(function () {
          if (_this.component.beforeRefresh) _this.component.beforeRefresh();
          Activity.replace();
        }, 400);
        this.loader(true);
      }
  };
})();
