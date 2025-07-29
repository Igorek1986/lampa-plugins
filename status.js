(function() {
    'use strict';

    // Стили (оставляем без изменений)
    var style = document.createElement('style');
    style.textContent = [
        '.card__type {',
        '    position: absolute;',
        '    left: 0;',
        '    top: 0.8em;',
        '    padding: 0.2em 0.8em;',
        '    font-size: 0.9em;',
        '    border-radius: 0.5em;',
        '    text-transform: uppercase;',
        '    font-weight: bold;',
        '    z-index: 2;',
        '    box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
        '    letter-spacing: 0.04em;',
        '    line-height: 1.1;',
        '    background: #ff4242;',
        '    color: #fff;',
        '}',
        '.card__status {',
        '    position: absolute;',
        '    right: -0.8em;',
        '    padding: 0.2em 0.8em;',
        '    font-size: 0.9em;',
        '    border-radius: 0.5em;',
        '    text-transform: uppercase;',
        '    font-weight: bold;',
        '    z-index: 2;',
        '    box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
        '    letter-spacing: 0.04em;',
        '    line-height: 1.1;',
        '}',
        '.card__status[data-status="ended"] {',
        '    background: #4CAF50;',
        '    color: #fff;',
        '}',
        '.card__status[data-status="airing"] {',
        '    background: #2196F3;',
        '    color: #fff;',
        '}',
        '.card__status[data-status="paused"] {',
        '    background: #FFC107;',
        '    color: #222;',
        '}',
        '.card__type + .card__status, .card__status + .card__type {',
        '    top: 0.8em;',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // Настройки
    var SETTINGS_COMPONENT = 'serial_status_settings';
    var GLOBAL_KEY = 'serial_status_enabled_global';
    var GLOBAL_DEFAULT = true;

    if (typeof Lampa !== 'undefined' && Lampa.SettingsApi) {
        Lampa.SettingsApi.addComponent({
            component: SETTINGS_COMPONENT,
            name: 'Статус сериалов',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#2196F3"/><rect x="4" y="6" width="16" height="12" rx="1" fill="#fff"/></svg>'
        });
        
        Lampa.SettingsApi.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: GLOBAL_KEY,
                type: 'trigger',
                default: GLOBAL_DEFAULT
            },
            field: {
                name: 'Показывать статус сериалов',
                description: 'Включить или отключить отображение статуса (в эфире/завершён) и метки TV на всех карточках сериалов во всех разделах.'
            },
            onChange: function(value) {
                Lampa.Storage.set(GLOBAL_KEY, value === true || value === 'true');
                if (!value) removeAllStatuses();
                else scanAllCards();
            }
        });
    }

    // Основные функции
    var isEnabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
    var processedCards = [];

    function isCardProcessed(card) {
        for (var i = 0; i < processedCards.length; i++) {
            if (processedCards[i] === card) return true;
        }
        return false;
    }

    function addCardToProcessed(card) {
        if (!isCardProcessed(card)) {
            processedCards.push(card);
        }
    }

    function addStatusToCard(card) {
        if (!isEnabled || isCardProcessed(card)) return;
        
        var cardView = card.querySelector('.card__view');
        if (!cardView) return;
        
        var data = card.card_data || card.data || {};
        var typeElement = cardView.querySelector('.card__type');
        var isTv = data.type === 'tv' || 
                  card.classList.contains('card--tv') || 
                  (typeElement && typeElement.textContent.trim().toUpperCase() === 'TV');
        
        if (!isTv) return;

        // Удаляем старые метки если есть
        var old = cardView.querySelectorAll('.card__type, .card__status');
        for (var i = 0; i < old.length; i++) {
            old[i].parentNode.removeChild(old[i]);
        }

        // Добавляем TV метку
        var typeElem = document.createElement('div');
        typeElem.className = 'card__type';
        typeElem.textContent = 'TV';
        cardView.appendChild(typeElem);

        // Определяем статус
        var status = (data.status || '').toLowerCase();

        // Добавляем статус
        var statusElement = document.createElement('div');
        statusElement.className = 'card__status';
        
        if (status === 'ended') {
            statusElement.setAttribute('data-status', 'ended');
            statusElement.textContent = 'Завершён';
        } else if (status === 'on hiatus' || status === 'paused') {
            statusElement.setAttribute('data-status', 'paused');
            statusElement.textContent = 'Пауза';
        } else if (status === 'returning series' || status === 'airing') {
            statusElement.setAttribute('data-status', 'airing');
            statusElement.textContent = 'В эфире';
        } else {
            return;
        }
        
        cardView.appendChild(statusElement);
        addCardToProcessed(card);
    }

    function removeAllStatuses() {
        var elements = document.querySelectorAll('.card__status, .card__type');
        for (var i = 0; i < elements.length; i++) {
            elements[i].parentNode.removeChild(elements[i]);
        }
        processedCards = [];
    }

    function scanAllCards() {
        if (!isEnabled) return;
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) {
            if (!isCardProcessed(cards[i])) {
                addStatusToCard(cards[i]);
            }
        }
    }

    // Инициализация через перехват событий
    if (typeof Lampa !== 'undefined') {
        // Перехватываем событие создания карточки
        Lampa.Listener.follow('card', function(event) {
            if (event.type === 'build' && isEnabled) {
                addStatusToCard(event.object.card);
            }
        });

        // Перехватываем событие добавления элементов в линию
        Lampa.Listener.follow('line', function(event) {
            if (event.type === 'append' && isEnabled && event.items) {
                for (var i = 0; i < event.items.length; i++) {
                    var item = event.items[i];
                    if (item.querySelector) {
                        var cards = item.querySelectorAll('.card');
                        for (var j = 0; j < cards.length; j++) {
                            if (!isCardProcessed(cards[j])) {
                                addStatusToCard(cards[j]);
                            }
                        }
                    }
                }
            }
        });

        // Перехватываем событие загрузки категории
        Lampa.Listener.follow('activity', function(event) {
            if ((event.component === 'category' || event.component === 'catalog') && isEnabled) {
                setTimeout(scanAllCards, 300);
            }
        });

        // Обработка кнопки "Показать больше"
        Lampa.Listener.follow('line', function(event) {
            if (event.type === 'append' && isEnabled) {
                var buttons = document.querySelectorAll('.items-line__more.selector');
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].addEventListener('click', function() {
                        setTimeout(scanAllCards, 300);
                    });
                }
            }
        });

        // Первоначальный запуск
        if (isEnabled) {
            setTimeout(scanAllCards, 500);
            setTimeout(scanAllCards, 1500);
        }
    }
})();