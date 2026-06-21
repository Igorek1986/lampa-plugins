---
layout: default
lang: ru
body_class: prose
title: MyShows PRO — Lampa Plugins
---

**Русский** · [English](https://igorek1986.github.io/lampa-plugins/docs/en/myshows_pro)

📺 Плагин MyShows PRO для [Lampac](https://github.com/immisterio/Lampac) и [Lampa](http://lampa.mx/)
Скробблинг просмотра сериалов и фильмов через официальный API MyShows — плашка «смотрит сейчас» в реальном времени.

> **Требуется PRO-аккаунт MyShows** и личный scrobble-токен.
> Подробнее о скробблинге — в [официальной статье MyShows](https://myshows.me/news/12495/scrobbler/) и репозитории [MyShows Scrobbler](https://github.com/myshowsme/myshows-scrobbler#myshows-scrobbler).

---

🔹 Что умеет плагин

- ✅ Скробблинг сериалов и фильмов через [официальный API MyShows](https://myshows.me/scrobble)
- ✅ Плашка «смотрит сейчас» на сайте MyShows.me появляется сразу при старте
- ✅ Прогрессивный скробблинг: `/start` при открытии, `/pause` — периодические обновления, `/stop` — при закрытии плеера
- ✅ Поддержка внешнего плеера — отмечает все серии плейлиста от запущенной до последней
- ✅ Мультипрофильность — отдельный токен на каждый профиль Lampa
- ✅ Проверка токена прямо из настроек

---

⚙️ Настройка

1. Получите scrobble-токен в личном кабинете [MyShows.me](https://myshows.me) (раздел «PRO»)
2. Установите плагин в Lampa → Расширения
3. Откройте Настройки → **MyShows PRO**
4. Включите скробблинг и вставьте токен
5. Нажмите «Проверить токен» — должно появиться уведомление ✅

---

🔧 Технические особенности

- Работает с встроенным и внешним плеером
- Запросы к API идут через нативный HTTP-мост (`Lampa.Reguest.native`) — минуя CORS
  *(в браузере lampa.mx работать не будет — только на ТВ/нативном WebView)*
- Матч контента выполняет сервер MyShows по IMDB/Kinopoisk ID + season/episode
- ES5 — совместим со старыми WebOS, Tizen, Android WebView
