// Unchanged public Activity.replace/extractObject from Lampa snapshot SHA256
// 6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda
(function(){
var active$3 = window.Lampa.Activity.active;
var activites = {pop:function(){}};
var push$3 = function(object){window.__replaceNativePush(object);};
var Lampa = {Listener:{send:function(){}}};
  function extractObject(object) {
    var saved = {};

    for (var i in object) {
      if (!(i == 'activity' || i == 'props' || i == 'params')) saved[i] = object[i];
    }

    return saved;
  }
  function replace() {
    var replace = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var clear = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var object = extractObject(active$3());

    for (var i in replace) {
      object[i] = replace[i];
    }

    var made = active$3();
    made.activity.destroy();
    Lampa.Listener.send('activity', {
      component: made.component,
      type: 'destroy',
      object: made
    });
    activites.pop();
    push$3(clear ? replace : object);
  }
window.__nativeActivityReplaceContract = replace;
})();
