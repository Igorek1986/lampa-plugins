(function () {
    'use strict';

    var VERSION = '1.0.2';

    window.full_hero_plugin = true;

    var DEBUG = false;
    function log(message, data) {
        if (DEBUG) console.log('[FullHero] ' + message, data !== undefined ? data : '');
    }

    // =========================================================================
    // Стили
    // =========================================================================

    var style = document.createElement('style');
    style.textContent = [
        // Маленький постер слева дублирует большой фон full-карточки — но только
        // на широких экранах (от 767px, порог самой Lampa для no--poster). На
        // мобильном отдельного фона нет — постер там единственная картинка,
        // трогать нельзя.
        '@media screen and (min-width: 767px) {',
        '    .full-start-new__left { display: none; }',
        '}',

        // Старые угловые бейджи (status.js + np_unwatched.js) на постере теперь
        // всё равно скрыты вместе с ним, но оставляем правило на случай, если
        // постер вернут (настройками/другим плагином) — тогда бейджи не всплывут.
        '.full-start-new__poster .np-unwatched-progress,',
        '.full-start-new__poster .np-unwatched-remaining,',
        '.full-start-new__poster .np-unwatched-next,',
        '.full-start-new__poster .serial-status__type,',
        '.full-start-new__poster .serial-status__status {',
        '    display: none !important;',
        '}',

        // Год/страна (изначально .full-start-new__head целиком), перенесённые
        // под название — см. moveYearCountryAfterTitle. Рейтинг/PG/статус
        // остаются в head наверху (у него своя стилизация ниже).
        // margin-top: 0 — на десктопе .full-start-new__right это flex-column
        // (см. правило ниже), а там margin соседних элементов НЕ схлопывается
        // как в обычном block-потоке: margin-bottom названия (0.2em от его
        // же огромного font-size 4em, то есть уже сам по себе не маленький)
        // суммировался бы с margin-top меты, а не схлопывался с ним — отсюда
        // непропорционально большой отступ. Отступ снизу оставляем — им же
        // отделяем название+год/страну от описания.
        '.fh-meta {',
        '    color: rgba(255,255,255,.6); font-size: 1.2em;',
        '    display: flex; align-items: center; flex-wrap: wrap; gap: 0.6em;',
        '    margin: 0 0 0.5em;',
        '}',
        '.fh-meta span { color: #fff; }',

        // Краткое описание под названием — тизер (обрезка в 3 строки), полный
        // текст остаётся ниже в "Подробно".
        '.fh-descr {',
        '    color: rgba(255,255,255,.75); font-size: 1em; line-height: 1.4;',
        '    margin: 0.6em 0 1em; max-width: 46em;',
        '}',
        // Оригинальный текст в "Подробно" теперь дублирует тизер выше — прячем
        // только текст, дата/бюджет/страны/теги в том же блоке остаются.
        '.full-descr__text { display: none; }',

        // Details (Сезоны/Серии/жанры), перенесённые в начало "Подробно" —
        // отступ снизу, чтобы не липли к дате/бюджету/странам.
        '.full-descr__left > .full-start-new__details {',
        '    margin-bottom: 0.8em;',
        '}',

        // .full-start-new__head после переноса года/страны в .fh-meta
        // (см. moveYearCountryAfterTitle) содержит только rate-line —
        // margin-left: auto прижимает его к правому краю строки.
        '.full-start-new__head {',
        '    display: flex; align-items: center;',
        '    flex-wrap: wrap; gap: 0.8em;',
        '}',
        '.full-start-new__head .full-start-new__rate-line {',
        '    margin-left: auto;',
        '}',

        // .full-start-new__head (рейтинг/PG/статус) прижат к самому верху,
        // всё остальное (название, год/страна, тизер, реакции, прогресс,
        // кнопки) — единой
        // группой к низу героя, как постеры в int.js. Только на широких
        // экранах (там же, где скрыт маленький постер и есть простор по высоте).
        // У самой Lampa .full-start-new__body { align-items: flex-end } — расчёт
        // на высокий постер слева, текст выравнивается по его низу. Постера
        // больше нет, поэтому это правило прижимало ВСЮ правую колонку целиком
        // к низу (отсюда пустота сверху у head) — переопределяем на stretch,
        // чтобы колонка сама растянулась на всю высоту, а дальше её внутренний
        // flex + margin-top: auto у названия толкает всё, что после head, вниз.
        // min-height у body считаем в JS (см. pinBodyHeight) — реальный отступ
        // сверху (высота шапки) может отличаться на TV с другим масштабом
        // интерфейса, хардкодить px здесь ненадёжно.
        '@media screen and (min-width: 767px) {',
        '    .full-start-new__body { align-items: stretch; }',
        '    .full-start-new__right { display: flex; flex-direction: column; }',
        '    .full-start-new__title { margin-top: auto; }',
        '}',

        // Прогресс — под рядом кнопок, обычным блоком в правой колонке, не
        // поверх картинки.
        // Свёрнут по умолчанию (max-height: 0) и существует в DOM ЕЩЁ ДО того,
        // как появятся данные (см. ensureWrap, вызывается сразу при открытии
        // карточки) — так первое появление прогресса (например, вернулись
        // после самой первой серии) плавно РАСКРЫВАЕТСЯ, а не вставляется
        // резким скачком с эффектом "дёрганья" остального контента.
        '.fh-progress-wrap {',
        '    max-height: 0; margin-top: 0; margin-bottom: 0; opacity: 0; overflow: hidden;',
        '    transition: max-height 0.4s ease, margin 0.4s ease, opacity 0.3s ease;',
        '}',
        '.fh-progress-wrap--show {',
        '    max-height: 6em; margin-top: 1.1em; margin-bottom: 1.1em; opacity: 1;',
        '}',
        '.fh-progress-text {',
        '    color: rgba(255,255,255,.75); font-size: 1em; font-weight: 500; margin-bottom: 0.5em;',
        '    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
        '}',
        '.fh-progress-bar {',
        '    position: relative; height: 0.25em; border-radius: 0.25em;',
        '    background: rgba(255,255,255,.15); overflow: hidden;',
        '}',
        '.fh-progress-bar > div {',
        '    position: absolute; left: 0; top: 0; bottom: 0; width: 0;',
        '    background: #fff; border-radius: 0.25em; transition: width 0.4s ease;',
        '}',

        // Гармонизация ряда кнопок full-start-new__buttons: наши кнопки статуса
        // (np-status-btn — глаз/галка/минус/крест из np_unwatched.js) используют
        // тонкие contour-иконки (stroke-width 2), а нативные кнопки Lampa —
        // жирные sprite-иконки. Чуть утолщаем обводку, чтобы визуальный вес
        // совпадал в одном ряду.
        '.full-start-new__buttons .np-status-btn svg path,',
        '.full-start-new__buttons .np-status-btn svg circle {',
        '    stroke-width: 2.4;',
        '}',
        // Ряд реакций (нативная Lampa .reaction) — та же высота/паддинг, что и
        // кнопки ниже, чтобы оба ряда читались как единый блок, а не два разных.
        '.full-start-new__reactions .reaction {',
        '    height: 2.6em; box-sizing: border-box;',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    // =========================================================================
    // Прогресс на постере full-карточки
    // =========================================================================

    var WATCH_THRESHOLD = 90; // % просмотра эпизода, после которого считаем «просмотрено»
    var EVENT_TIMEOUT = 1500; // сколько ждём np-unwatched-progress, прежде чем считать сами

    function isTvShow(movie) {
        return !!(movie && (movie.number_of_seasons || movie.seasons || movie.first_air_date || movie.original_name));
    }

    function cardIdOf(movie) {
        return movie && movie.id ? movie.id + '_tv' : '';
    }

    function isSameFullCardOpen(movie) {
        if (!movie || !movie.id) return true;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (!active || active.component !== 'full') return false;
        var openCard = active.card_data || active.card || active.movie;
        if (!openCard || !openCard.id) return true;
        return String(openCard.id) === String(movie.id);
    }

    function pad2(n) {
        n = parseInt(n, 10) || 0;
        return n < 10 ? '0' + n : '' + n;
    }

    // Монтируем перед рядом кнопок (.full-start-new__buttons), внутри правой
    // колонки — не на постере (его больше нет, см. стили выше).
    function ensureWrap() {
        var buttons = document.querySelector('.full-start-new__buttons');
        if (!buttons || !buttons.parentNode) return null;
        var wrap = buttons.parentNode.querySelector('.fh-progress-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'fh-progress-wrap';
            wrap.innerHTML = '<div class="fh-progress-text"></div><div class="fh-progress-bar"><div></div></div>';
            buttons.parentNode.insertBefore(wrap, buttons);
        }
        return wrap;
    }

    function renderProgress(watched, total, remaining, nextEpisode) {
        if (!total) return;
        var wrap = ensureWrap();
        if (!wrap) return;
        var text = wrap.querySelector('.fh-progress-text');
        var bar = wrap.querySelector('.fh-progress-bar > div');
        var percent = Math.max(0, Math.min(100, Math.round((watched / total) * 100)));

        var parts = [];
        if (nextEpisode) parts.push(nextEpisode.replace('/', ''));
        if (remaining) parts.push('осталось ' + remaining);
        else parts.push('Просмотрено ' + watched + ' из ' + total);
        text.textContent = parts.join(' · ');

        bar.style.width = percent + '%';
        wrap.classList.add('fh-progress-wrap--show');
    }

    function clearProgress() {
        var wrap = document.querySelector('.fh-progress-wrap');
        if (wrap) wrap.classList.remove('fh-progress-wrap--show');
    }

    // Локальный фолбэк для тех, у кого нет np_unwatched.js (публичный плагин, не
    // завязан на наш бэкенд) — считает по Lampa.Timeline.watchedEpisode, чисто
    // на клиенте. Грубее сервера: не знает дат выхода будущих серий, поэтому
    // "total" — это episode_count каждого сезона целиком (включая ещё не
    // вышедшие эпизоды внутри текущего сезона), не только уже вышедшие.
    function localFallback(movie) {
        if (!window.Lampa || !Lampa.Timeline || !Lampa.Timeline.watchedEpisode) return;
        var seasons = (movie.seasons || []).filter(function (s) {
            return s.season_number > 0 && s.episode_count > 0;
        });
        if (!seasons.length) return;
        seasons.sort(function (a, b) { return a.season_number - b.season_number; });

        var watched = 0, total = 0, nextEp = null;
        for (var i = 0; i < seasons.length; i++) {
            var season = seasons[i];
            for (var ep = 1; ep <= season.episode_count; ep++) {
                total++;
                var percent = 0;
                try { percent = Lampa.Timeline.watchedEpisode(movie, season.season_number, ep) || 0; } catch (e) {}
                if (percent >= WATCH_THRESHOLD) watched++;
                else if (!nextEp) nextEp = 'S' + pad2(season.season_number) + '/E' + pad2(ep);
            }
        }
        if (!watched) return; // не начинали смотреть — показывать нечего
        renderProgress(watched, total, total - watched, nextEp);
    }

    function formatDuration(seconds) {
        var m = Math.round(seconds / 60);
        if (m < 1) return '';
        if (m < 60) return m + ' мин';
        var h = Math.floor(m / 60), mm = m % 60;
        return h + ' ч' + (mm ? ' ' + mm + ' мин' : '');
    }

    function renderMovieProgress(percent, watchedSeconds, remainingSeconds) {
        if (!percent) return;
        var wrap = ensureWrap();
        if (!wrap) return;
        var text = wrap.querySelector('.fh-progress-text');
        var bar = wrap.querySelector('.fh-progress-bar > div');
        var p = Math.max(0, Math.min(100, Math.round(percent)));

        var parts = [];
        var watched = formatDuration(watchedSeconds);
        parts.push(watched ? 'Просмотрено ' + watched : 'Просмотрено');
        var left = formatDuration(remainingSeconds);
        if (left) parts.push('осталось ' + left);
        text.textContent = parts.join(' · ');

        bar.style.width = p + '%';
        wrap.classList.add('fh-progress-wrap--show');
    }

    // Фильмы np_unwatched.js вообще не считает (там только сериалы/эпизоды) —
    // событие np-unwatched-progress для них никогда не придёт, поэтому сразу
    // берём локальный Lampa.Timeline (та же, что двигает "Продолжить
    // просмотр" на самой Lampa) — без ожидания и без похода на бэкенд.
    function movieFallback(movie) {
        if (!window.Lampa || !Lampa.Timeline || !Lampa.Timeline.watched) return;
        var data;
        try { data = Lampa.Timeline.watched(movie, true); } catch (e) { return; }
        if (!data || !data.percent) return;
        var remaining = (data.duration && data.time) ? (data.duration - data.time) : 0;
        renderMovieProgress(data.percent, data.time, remaining);
    }

    // Пересчитывает и обновляет прогресс, БЕЗ clearProgress() — сама полоса
    // (transition: width на .fh-progress-bar > div, см. стили выше) плавно
    // "доливается" от старого значения к новому, вместо мигания. Тот же
    // ре-рендер используется и при первом открытии (после явного clear), и
    // при мягком обновлении по возврату в уже открытую карточку.
    // Подписка на np-unwatched-progress держится, пока открыта ЭТА ЖЕ карточка —
    // np_unwatched.js шлёт это событие не только сразу после открытия, но и
    // живьём при любом обновлении прогресса, пока карточка на экране (в т.ч.
    // когда таймкод/статус меняют с другого устройства или веба через WS).
    // Раньше подписка снималась после первого же ответа — полоса прогресса
    // навсегда застревала на значении из момента открытия карточки. Один
    // слушатель на всё приложение (не по одному на каждый refreshProgress) —
    // повторные вызовы (возврат из плеера) просто переиспользуют его, без
    // накопления дублей.
    var _liveProgressCardId = null;
    function onLiveProgressEvent(e) {
        if (!e.detail || e.detail.card_id !== _liveProgressCardId) return;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        var openCard = active && (active.card_data || active.card || active.movie);
        if (!openCard || cardIdOf(openCard) !== _liveProgressCardId) {
            document.removeEventListener('np-unwatched-progress', onLiveProgressEvent);
            _liveProgressCardId = null;
            return;
        }
        if (e.detail.found) {
            renderProgress(e.detail.watched, e.detail.aired, e.detail.remaining, e.detail.next_episode);
        } else {
            localFallback(openCard);
        }
    }

    function refreshProgress(movie) {
        if (!isTvShow(movie)) {
            movieFallback(movie);
            return;
        }

        var cardId = cardIdOf(movie);
        var gotAnswer = false;

        // np_unwatched.js уже умеет считать это через сервер (учитывает даты
        // выхода, синхронизацию между устройствами) — если он есть, ждём его
        // событие вместо того, чтобы считать грубее самим.
        if (window.np_unwatched_plugin) {
            if (_liveProgressCardId !== cardId) {
                document.removeEventListener('np-unwatched-progress', onLiveProgressEvent);
                _liveProgressCardId = cardId;
                document.addEventListener('np-unwatched-progress', onLiveProgressEvent);
            }
            var onceHandler = function (e) {
                if (!e.detail || e.detail.card_id !== cardId) return;
                gotAnswer = true;
                document.removeEventListener('np-unwatched-progress', onceHandler);
            };
            document.addEventListener('np-unwatched-progress', onceHandler);
            setTimeout(function () {
                document.removeEventListener('np-unwatched-progress', onceHandler);
                if (gotAnswer || !isSameFullCardOpen(movie)) return;
                localFallback(movie);
            }, EVENT_TIMEOUT);
        } else {
            localFallback(movie);
        }
    }

    function onFullCardReady(movie) {
        clearProgress();
        ensureWrap(); // создаём (свёрнутый) плейсхолдер сразу — см. .fh-progress-wrap
        refreshProgress(movie);
    }

    // Возврат в уже открытую карточку (посмотрели серию/начали фильм и
    // вернулись назад) — тем же путём, что и np_unwatched.js
    // (Lampa.Listener.follow('activity', ...), event.type === 'archive'),
    // только без анимации бейджей — здесь достаточно самой полосы прогресса.
    // Задержка та же (1.5с) — не дёргать пересчёт мгновенно на каждый шаг назад.
    Lampa.Listener.follow('activity', function (event) {
        if (event.type !== 'archive' || event.component !== 'full') return;
        var movie = event.object && event.object.card;
        if (!movie) return;
        setTimeout(function () {
            if (!isSameFullCardOpen(movie)) return;
            refreshProgress(movie);
        }, 1500);
    });

    // У некоторых карточек нет backdrop_path (особенно свежие/малоизвестные
    // релизы) — фон остаётся пустым плоским цветом. Раз маленький постер слева
    // всё равно скрыт (см. стили выше), фолбэк: растягиваем сам постер на то
    // же место, что и обычный фон (.full-start__background — те же <img>,
    // которыми управляет сама Lampa, object-fit: cover уже есть в её стилях).
    // Сама Lampa (components/full.js) берёт фон только из backdrop_path, без
    // фолбэка на постер — .full-start__background/wrapper, которые видно на
    // full-карточке, на самом деле принадлежат ГЛОБАЛЬНОМУ Lampa.Background
    // (canvas-слой на body, блюр+градиент+кроссфейд), не самой full-странице —
    // поэтому её и не найти внутри .full-start-new. У Lampa.Utils
    // (cardImgBackgroundBlur) фолбэк на постер уже есть, просто full.js им не
    // пользуется — зовём тот же хелпер сами и обновляем тот же canvas-фон.
    // Сама full-карточка (components/full.js) добавляет <img
    // class="full-start__background"> ПЕРВЫМ элементом в свой корневой
    // контейнер, но если backdrop_path пуст — тут же его УДАЛЯЕТ целиком
    // (не прячет). К моменту события 'complite' элемента уже нет в DOM,
    // поэтому просто пересоздаём его сами с постером вместо backdrop.
    function backdropFallback(movie) {
        if (!movie || movie.backdrop_path || !movie.poster_path) return;
        if (!window.Lampa || !Lampa.Api || !Lampa.Api.img) return;
        var container = document.querySelector('.full-start-new');
        if (!container) return;

        var img = container.querySelector('.full-start__background');
        if (!img) {
            img = document.createElement('img');
            img.className = 'full-start__background';
            container.insertBefore(img, container.firstChild);
        }
        img.onload = function () { img.classList.add('loaded'); };
        img.src = Lampa.Api.img(movie.poster_path, 'w1280');
    }

    // Год/страна изначально и есть весь .full-start-new__head (без обёртки —
    // просто текстовые/span-узлы, см. src/components/full/start.js в
    // dev/lampa-source). Забираем их оттуда в .fh-meta сразу после названия,
    // а в head остаётся место для рейтинга (см. moveRateLineToHead).
    function moveYearCountryAfterTitle() {
        var head = document.querySelector('.full-start-new__head');
        var right = document.querySelector('.full-start-new__right');
        if (!head || !right) return;
        if (right.querySelector('.fh-meta')) return; // уже перенесено

        var meta = document.createElement('div');
        meta.className = 'fh-meta';
        while (head.firstChild) meta.appendChild(head.firstChild);

        var title = right.querySelector('.full-start-new__title');
        if (title) title.parentNode.insertBefore(meta, title.nextSibling);
        else right.insertBefore(meta, right.firstChild);
    }

    // Рейтинг/PG/статус — то, что остаётся в .full-start-new__head после
    // переноса года/страны, прижимается наверх (см. CSS выше). Не полим,
    // оба элемента уже есть на момент 'complite'.
    function moveRateLineToHead() {
        var head = document.querySelector('.full-start-new__head');
        var rateLine = document.querySelector('.full-start-new__rate-line');
        if (!head || !rateLine) return;
        moveYearCountryAfterTitle();
        head.appendChild(rateLine);
    }

    // "Подробно" (.full-descr) — отдельный компонент, обычно рендерится чуть
    // позже основного full-start-new, поэтому ждём его поллингом (как
    // fetchProgress-паттерн в np_unwatched.js). Делаем две вещи:
    // 1) тизер описания под названием (копия текста, 3 строки с обрезкой —
    //    оригинал в "Подробно" не трогаем, только прячем текст там CSS'ом,
    //    остальное — дата/бюджет/страны/теги — остаётся);
    // 2) Сезоны/Серии/жанры (.full-start-new__details) переносим (не
    //    копируем) в начало "Подробно", перед датой/бюджетом/странами.
    function decorateDescr(attempt) {
        var right = document.querySelector('.full-start-new__right');
        if (!right) return;

        var descrLeft = document.querySelector('.full-descr__left');
        var descrTextEl = document.querySelector('.full-descr__text');
        if (!descrLeft || !descrTextEl) {
            if (attempt < 20) setTimeout(function () { decorateDescr((attempt || 0) + 1); }, 300);
            return;
        }
        if (document.querySelector('.full-start-new__right') !== right) return; // ушли на другую карточку

        var old = document.querySelectorAll('.fh-descr');
        for (var i = 0; i < old.length; i++) old[i].remove();

        var tagline = right.querySelector('.full-start-new__tagline');
        var meta = right.querySelector('.fh-meta');
        var title = right.querySelector('.full-start-new__title');
        var anchorAfter = tagline || meta || title;
        var text = descrTextEl.textContent.trim();
        if (anchorAfter && text) {
            var el = document.createElement('div');
            el.className = 'fh-descr';
            el.textContent = text;
            anchorAfter.parentNode.insertBefore(el, anchorAfter.nextSibling);
        }

        var details = right.querySelector('.full-start-new__details');
        if (details) descrLeft.insertBefore(details, descrLeft.firstChild);
    }

    // .scroll__content { padding-top } — общий отступ под шапкой для ЛЮБОЙ
    // прокручиваемой страницы (не только full-карточки), поэтому не трогаем
    // его CSS-правилом глобально — точечно уменьшаем инлайн-стилем только на
    // конкретном инстансе, в который попал full-start-new (у каждой активности
    // свой .scroll__content, так что на другие страницы это не влияет).
    function tightenScrollTop() {
        var node = document.querySelector('.full-start-new');
        while (node && (!node.classList || !node.classList.contains('scroll__content'))) {
            node = node.parentElement;
        }
        if (!node) return;
        node.style.paddingTop = '0.5em';

        // .scroll--mask (родитель .scroll__content) — нативный mask-image
        // Lampa: первые/последние ~8% высоты скролла делает полупрозрачными
        // (плавное появление контента при прокрутке). С нашим тесным отступом
        // .full-start-new__head попадает в эту зону и выглядит "бледным". Она
        // нужна для длинных списков, где реально что-то прокручивается за
        // край — на full-карточке не критична, убираем маску полностью.
        var scrollEl = node.parentElement;
        if (scrollEl && scrollEl.classList && scrollEl.classList.contains('scroll--mask')) {
            scrollEl.style.webkitMaskImage = 'none';
            scrollEl.style.maskImage = 'none';
        }
    }

    // Высота .full-start-new__body для прижатия низа (кнопки+прогресс) к
    // низу экрана — считаем в JS, а не хардкодим px в CSS: реальный отступ
    // сверху (высота шапки) зависит от масштаба интерфейса Lampa, который на
    // TV (10-foot UI) может отличаться от браузера. rem, а не px — отступ
    // снизу тоже должен расти вместе с остальным интерфейсом на TV.
    var BOTTOM_GAP_REM = 2.4;
    function pinBodyHeight() {
        if (window.innerWidth < 767) return; // мобильный — тут нет прижатия низа вообще
        var body = document.querySelector('.full-start-new__body');
        if (!body) return;
        var top = body.getBoundingClientRect().top;
        var rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        var bottomGap = BOTTOM_GAP_REM * rootFontSize;
        var h = window.innerHeight - top - bottomGap;
        if (h > 0) body.style.minHeight = h + 'px';
    }

    Lampa.Listener.follow('full', function (event) {
        if (event.type !== 'complite' || !event.data || !event.data.movie) return;
        tightenScrollTop();
        pinBodyHeight();
        backdropFallback(event.data.movie);
        moveRateLineToHead();
        decorateDescr(0);
        onFullCardReady(event.data.movie);
    });

    log('started', VERSION);
})();
