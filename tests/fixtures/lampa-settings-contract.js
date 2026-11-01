// Unchanged function extracts from the actual Lampa 3.3.4 client snapshot.
// Source: https://github.com/yumata/lampa-source (framework snapshot supplied by task).
// Snapshot SHA-256: 6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda
// Only environment dependencies and an export wrapper are supplied below.
(function() {
  var readed = {}, reserve = {}, values = {}, defaults = {}, params$3 = {};
  var Arrays = {isObject: function(value) {return value !== null && typeof value === 'object' && !Array.isArray(value);},
    isArray: Array.isArray, getKeys: Object.keys};
  var listener = {send: function() {}}, listener$1 = listener;
  var $ = function(element) {return element;};
  var Select = {show: function(options) {window.__nativeSelect = options;}};
  var Controller = {enabled: function() {return {name: 'settings'};}, toggle: function() {}};
  var Lang = {translate: function(value) {
    if (value === '#{settings_param_yes}') return 'Да';
    if (value === '#{settings_param_no}') return 'Нет';
    return String(value);
  }};
  var Storage = {get: get$1, set: set, field: field$1};
  var Params = {trigger: trigger, select: select, field: field$1};
  function get$1(name, empty) {
    var item;
    var value = readed[name];

    if (typeof value == 'undefined') {
      item = window.localStorage.getItem(name);
      value = item;

      if (item == null && reserve[name]) {
        value = reserve[name];
      }
    }

    value = value || empty || '';
    if (value == 'true' || value == 'false') return value == 'true' ? true : false;
    if (readed[name] && (Arrays.isObject(value) || Arrays.isArray(value))) return readed[name];
    var convert = parseInt(value);
    if (!isNaN(convert) && /^\d+$/.test(value)) return convert;
    var i = typeof value == 'string' ? value[0] : '';

    if (i == '[' || i == '{') {
      try {
        value = JSON.parse(value);
      } catch (error) {}
    }

    readed[name] = value;
    return value;
  }

  function set(name, value, nolisten, callerror) {
    readed[name] = value;
    var write = '';

    try {
      write = Arrays.isObject(value) || Arrays.isArray(value) ? JSON.stringify(value) : value;
    } catch (e) {
      console.log('Storage', name, 'JSON.stringify error:', e, value);
    }

    try {
      window.localStorage.setItem(name, write);
    } catch (e) {
      if (e.name == 'QuotaExceededError') {
        console.log('Storage', 'QuotaExceededError:', name, value);
        window.localStorage.removeItem(name);
        Cache.rewriteData('storage', name, {
          key: name,
          value: write
        }).then(function () {
          reserve[name] = write;
        })["catch"](function (e) {
          console.log('Storage', 'Cache error:', e.message, e.stack, e);
        });
        if (callerror) callerror(e);
      }
    }

    if (!nolisten) listener.send('change', {
      name: name,
      value: value
    });
  }

  function trigger(name, value_default) {
    values[name] = {
      'true': '#{settings_param_yes}',
      'false': '#{settings_param_no}'
    };
    defaults[name] = value_default;
  }

  function select(name, select_data, select_default_value) {
    values[name] = select_data;
    defaults[name] = select_default_value;
  }

  function field$1(name) {
    return Storage.get(name, defaults[name] + '');
  }

  function bind(elems, elems_html) {
    elems.on('hover:enter', function (event) {
      var elem = $(event.target);
      var type = elem.data('type');
      var name = elem.data('name');
      var onChange = elem.data('onChange');

      if (type == 'toggle') {
        var params = values[name];
        var keys = Arrays.isArray(params) ? params : Arrays.getKeys(params),
            value = Storage.get(name, defaults[name]) + '',
            position = keys.indexOf(value);
        position++;
        if (position >= keys.length) position = 0;
        position = Math.max(0, Math.min(keys.length - 1, position));
        value = keys[position];
        Storage.set(name, value);
        update$3(elem, elems, elems_html);
        if (onChange) onChange(value);
      }

      if (type == 'input') {
        Input.edit({
          elem: elem,
          name: name,
          nomic: true,
          value: elem.data('string') ? window.localStorage.getItem(name) || defaults[name] : Storage.get(name, defaults[name]) + ''
        }, function (new_value) {
          Storage.set(name, new_value);
          update$3(elem, elems, elems_html);
          if (onChange) onChange(new_value);
        });
      }

      if (type == 'button') {
        listener$1.send('button', {
          name: name
        });
        if (onChange) onChange();
      }

      if (type == 'add') {
        Input.edit({
          value: ''
        }, function (new_value) {
          if (new_value && Storage.add(name, new_value)) {
            displayAddItem(elem, new_value);
            listener$1.send('update_scroll');
          }
        });
      }

      if (type == 'select') {
        var _params = values[name];

        var _value = Storage.get(name, defaults[name]) + '';

        var items = [];

        for (var i in _params) {
          items.push({
            title: Lang.translate(_params[i]),
            value: i,
            selected: i == _value
          });
        }

        var enabled = Controller.enabled().name;
        Select.show({
          title: Lang.translate('title_choice'),
          items: items,
          onBack: function onBack() {
            Controller.toggle(enabled);
          },
          onSelect: function onSelect(a) {
            Storage.set(name, a.value);
            update$3(elem, elems, elems_html);
            Controller.toggle(enabled);
            if (onChange) onChange(a.value);
          }
        });
      }
    }).on('hover:hover hover:touch', function (e) {
      Navigator.focused(e.target);
    }).each(function () {
      if (!$(this).data('static')) update$3($(this), elems, elems_html);
    });

    if (elems.eq(0).data('type') == 'add') {
      displayAddList(elems.eq(0));
    }
  }

  function update$3(elem, elems, elems_html) {
    var name = elem.data('name');
    var key = elem.data('string') ? window.localStorage.getItem(name) || defaults[name] : Storage.get(name, defaults[name] + '');
    var val = typeof values[name] == 'string' ? key : values[name][key] || values[name][defaults[name]];
    var plr = elem.attr('placeholder');
    if (!val && plr) val = plr;
    elem.find('.settings-param__value').text(Lang.translate(val));
    var children = elem.data('children');

    if (children) {
      var parent = elems_html ? elems_html.find('[data-parent="' + children + '"]') : elems.filter('[data-parent="' + children + '"]');
      var value = elem.data('children-value');
      var visibl = value ? Storage.field(name) !== value : !Storage.field(name);
      if (elem.data('children-reverse')) visibl = !visibl;
      parent.toggleClass('hide', visibl);
      parent.filter('[data-visible-value]').each(function () {
        $(this).toggleClass('hide', $(this).data('visible-value') !== key);
      });
      parent.filter('[data-visible-value-in]').each(function () {
        var valueStr = this.getAttribute('data-visible-value-in');
        var valueList = valueStr.split(',').map(function (item) {
          return item.trim().toLowerCase();
        });
        var isVisible = false;

        for (var i = 0; i < valueList.length; i++) {
          if (key.toLowerCase().indexOf(valueList[i]) !== -1) {
            isVisible = true;
            break;
          }
        }

        $(this).toggleClass('hide', !isVisible);
      });
      listener$1.send('update_scroll_position');
    }

    updateInfuseLaunchVisibility(elems_html);
  }

  function isInfusePlayerSelected() {
    return ['player', 'player_iptv', 'player_torrent'].some(function (name) {
      return Storage.field(name) === 'infuse';
    });
  }

  function updateInfuseLaunchVisibility(elems_html) {
    if (!elems_html || !elems_html.length) return;
    elems_html.find('[data-infuse-launch]').toggleClass('hide', !isInfusePlayerSelected());
  }

  function addParam(data) {
    if (!params$3[data.component]) params$3[data.component] = [];
    params$3[data.component].push(data);
    if (data.param.type == 'select' || data.param.type == 'input') Params.select(data.param.name, data.param.values, data.param["default"]);
    if (data.param.type == 'trigger') Params.trigger(data.param.name, data.param["default"]);
  }
  window.__nativeSettingsContract = {Storage: Storage, addParam: addParam, bind: bind, update: update$3};
})();
