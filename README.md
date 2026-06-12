# Lampa Plugins

Набор плагинов для медиацентра [Lampa](http://lampa.mx/) и [Lampac](https://github.com/immisterio/Lampac).
Это обычные `.js`-файлы — без сборки и зависимостей, устанавливаются по ссылке.

🌐 Главная страница: **https://igorek1986.github.io/lampa-plugins/** ([English](https://igorek1986.github.io/lampa-plugins/en))

## Плагины

| Плагин | Установка | Описание |
|--------|-----------|----------|
| **NUMParser** | `https://igorek1986.github.io/lampa-plugins/np.js` | [docs/num](docs/num.md) |
| **Status Serials** | `https://igorek1986.github.io/lampa-plugins/status.js` | [docs/status](docs/status.md) |
| **MyShows** | `https://igorek1986.github.io/lampa-plugins/myshows.js` | [docs/myshows](docs/myshows.md) |
| **Reset Settings** | `https://igorek1986.github.io/lampa-plugins/reset.js` | [docs/reset](docs/reset.md) |

## Варианты файлов

Каждый плагин доступен в трёх **функционально идентичных** вариантах — отличается только содержимое файла:

| Вариант | Пример | Что внутри |
|---------|--------|------------|
| Обычный | `np.js` | Полный код с комментариями и логами |
| Lite | `np.lite.js` | Без комментариев и логов |
| Min | `np.min.js` | То же, что Lite, дополнительно минифицирован (минимальный размер) |

Чтобы выбрать вариант, замените в ссылке `.js` на `.lite.js` или `.min.js`. Для слабых устройств рекомендуется `.min`.

## Модуль для Lampac

- [`module/TimecodeUser`](module/TimecodeUser) — C#-модуль бэкенда для отслеживания таймкодов (требуется для скрытия просмотренного в NUMParser и синхронизации в MyShows).

## Поддержать

[ЮMoney](https://yoomoney.ru/fundraise/1DVU3GIL23V.251112)
