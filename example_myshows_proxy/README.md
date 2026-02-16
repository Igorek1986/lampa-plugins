# MyShows proxy

Прокси для интеграции плагина [MyShows](https://igorek1986.github.io/lampa-plugins/myshows.js) в Lampa/Lampac.

## 🔐 Требования к прокси

- Прокси **обязательно должен работать по HTTPS**.
- На endpoint `/auth` (POST) должен принимать JSON:
  ```json
  { "login": "...", "password": "..." }
  ```
- И возвращать **ровно такой формат**:
  ```json
  { "token": "ваш_токен" }
  ```

## 🛠️ Как использовать свой прокси

Добавьте к URL плагина параметр `?auth_proxy=...`:

```html
https://igorek1986.github.io/lampa-plugins/myshows.js?auth_proxy=https://example.ru/auth"
```

## 📁 Примеры

Пример FastAPI-прокси:  
`example_myshows_proxy/main.py`

Пример конфига Nginx:  
`example_myshows_proxy/nginx_myshows.conf`

Разверните прокси на своём сервере, получите сертификат — и укажите в `auth_proxy`.