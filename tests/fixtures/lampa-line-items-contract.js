// Unchanged native Line Items from Lampa snapshot SHA-256
// 6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda
(function(){
var Platform = {screen: function(){ return true; }};
var Controller = {own:function(){return true;},collectionAppend:function(){}};
var Layer = {visible:function(){}};
var Arrays = {destroy:function(items){items.forEach(function(item){item.destroy();});}};
var MoreFirst = {};
  var Items$2 = {
    onInit: function onInit() {
      this.tv = Platform.screen('tv');
      this.items = [];
      this.active = 0;
      this.view = this.params.items.view;
    },
    onAppend: function onAppend(item, element) {
      var _this = this;

      var render = item.render(true);
      render.on('hover:focus', function () {
        _this.last = render;
        var prev_active = _this.active;
        _this.active = _this.items.indexOf(item);
        if (_this.active > 0 || prev_active > _this.active) _this.scroll.update(_this.items[_this.active].render(true), _this.params.items.align_left ? false : true);

        _this.emit('active', item, element);
      });
      render.on('hover:touch', function () {
        _this.last = render;
        _this.active = _this.items.indexOf(item);

        _this.emit('active', item, element);
      });
      render.on('hover:enter', function () {
        _this.last = render;
      });
      render.on('visible', function () {
        if (Controller.own(_this)) Controller.collectionAppend(render);
      });

      if (element.params.on && _typeof(element.params.on) == 'object') {
        var _loop = function _loop(e) {
          render.on(e, function () {
            element.params.on[e].call(_this, item, element);
          });
        };

        for (var e in element.params.on) {
          _loop(e);
        }
      }

      this.scroll.append(render);
      this.items.push(item);
      this.emit('push', item, element);
    },
    onCreate: function onCreate() {
      this.scroll.body(true).addClass('mapping--' + this.params.items.mapping);
      this.scroll.onScroll = this.emit.bind(this, 'scroll');
      this.data.results.slice(0, this.view).forEach(this.emit.bind(this, 'createAndAppend'));
    },
    onScroll: function onScroll() {
      var size = this.tv ? (Math.round(this.active / this.view) + 1) * this.view + 1 : this.data.results.length;
      var start = this.items.length;
      if (this.has(MoreFirst)) start -= 1;
      this.data.results.slice(start, size).forEach(this.emit.bind(this, 'createAndAppend'));
      Layer.visible(this.scroll.render(true));
    },
    onDestroy: function onDestroy() {
      Arrays.destroy(this.items);
    }
  };

window.__nativeLineItemsContract = Items$2;
})();
