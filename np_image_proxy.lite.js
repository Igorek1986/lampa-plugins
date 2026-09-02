(function() {
    "use strict";
    var VERSION = "1.0.0";
    function createLogMethod(emoji, consoleMethod) {
        var DEBUG = Lampa.Storage.get("numparser_debug_mode", false);
        if (!DEBUG) return function() {};
        return function() {
            var args = Array.prototype.slice.call(arguments);
            if (emoji) args.unshift(emoji);
            args.unshift("NPImageProxy");
            consoleMethod.apply(console, args);
        };
    }
    var Log = {
        info: createLogMethod("ℹ️", console.log),
        error: createLogMethod("❌", console.error)
    };
    function buildProxyUrl(BASE_URL, src, size) {
        if (!src) return "";
        src = "" + src;
        var match = src.match(/\/t\/p\/[^\/]+\/(.+)$/);
        if (match) src = "/" + match[1];
        var posterSize = size || Lampa.Storage.field("poster_size") || "w500";
        var path = ("t/p/" + posterSize + "/" + src).replace(/\/{2,}/g, "/");
        return BASE_URL + "/imgproxy/" + path;
    }
    function init() {
        var tmdb = Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
        if (!tmdb || typeof tmdb.img !== "function") return;
        var BASE_URL = Lampa.Storage.get("base_url_numparser", "") || "https://np.flowbyte.cc";
        tmdb.img = function(src, size) {
            return buildProxyUrl(BASE_URL, src, size);
        };
        if (Lampa.TMDB && typeof Lampa.TMDB.image === "function") Lampa.TMDB.image = function(url) {
            if (!url) return "";
            var path = ("" + url).replace(/^\/+/, "");
            return BASE_URL + "/imgproxy/" + path;
        };
        try {
            Lampa.Manifest.plugins = {
                type: "other",
                version: VERSION,
                name: "NP Image Proxy",
                description: "Подмена TMDB.img — картинки идут через свой /imgproxy вместо TMDB/зеркал"
            };
        } catch (e) {}
        console.log("NPImageProxy", "plugin ready, version", VERSION);
    }
    if (window.appready) init(); else Lampa.Listener.follow("app", function(e) {
        if (e.type === "ready") init();
    });
})();