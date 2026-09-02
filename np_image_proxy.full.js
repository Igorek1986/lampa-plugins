 (function () {
    'use strict';

    var VERSION = '1.0.0';

    function createLogMethod(emoji, consoleMethod) {
        var DEBUG = Lampa.Storage.get('numparser_debug_mode', false);
        if (!DEBUG) {
            return function() {};
        }

        return function() {
            var args = Array.prototype.slice.call(arguments);
            if (emoji) {
                args.unshift(emoji);
            }
            args.unshift('NPImageProxy');
            consoleMethod.apply(console, args);
        };
    }

    var Log = {
        info: createLogMethod('ℹ️', console.log),
        error: createLogMethod('❌', console.error)
    };

    function buildProxyUrl(BASE_URL, src, size) {
        if (!src) return '';

        src = '' + src;
        // Если пришёл уже полный URL (так бывает, см. card.backdrop_path
        // в некоторых местах np.js) — вытаскиваем относительный путь.
        var match = src.match(/\/t\/p\/[^\/]+\/(.+)$/);
        if (match) src = '/' + match[1];

        var posterSize = size || Lampa.Storage.field('poster_size') || 'w500';
        var path = ('t/p/' + posterSize + '/' + src).replace(/\/{2,}/g, '/');

        return BASE_URL + '/imgproxy/' + path;
    }

    function init() {
        var tmdb = Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
        if (!tmdb || typeof tmdb.img !== 'function') {
            Log.error('Api.sources.tmdb.img недоступен, не могу подменить');
            return;
        }

        var BASE_URL = Lampa.Storage.get('base_url_numparser', '') || 'https://np.flowbyte.cc';

        // Тот же интерфейс (src, size), что и родной TMDB.img — используется и
        // напрямую (Api.sources.tmdb.img из card.js в ядре Lampa для основной
        // сетки карточек), и через обёртку Lampa.Api.img(). Полностью заменяет
        // родную логику (TMDB.image / зеркала proxy_tmdb) — свой /imgproxy
        // отдаёт картинку сам, ходить в TMDB/зеркала эта функция больше не даёт.
        tmdb.img = function (src, size) {
            return buildProxyUrl(BASE_URL, src, size);
        };

        // Второй, более низкоуровневый путь — Lampa.TMDB.image(url), отдельный
        // модуль ядра (не тот же объект, что Api.sources.tmdb), принимает уже
        // готовый относительный путь целиком (например "t/p/original/logo.png"
        // или "/t/p/w200/abc.jpg"). Используется в обход .img() местами вроде
        // логотипов в int.js, превью таймтейбла и аватарок в уведомлениях —
        // без этой подмены они продолжали бы идти напрямую в TMDB/зеркала.
        if (Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
            Lampa.TMDB.image = function (url) {
                if (!url) return '';
                var path = ('' + url).replace(/^\/+/, '');
                return BASE_URL + '/imgproxy/' + path;
            };
        }

        try {
            Lampa.Manifest.plugins = {
                type: 'other',
                version: VERSION,
                name: 'NP Image Proxy',
                description: 'Подмена TMDB.img — картинки идут через свой /imgproxy вместо TMDB/зеркал'
            };
        } catch (e) {}

        Log.info('включён, картинки идут через', BASE_URL + '/imgproxy');
        console.log('NPImageProxy', 'plugin ready, version', VERSION);
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
