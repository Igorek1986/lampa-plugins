(function() {
    'use strict';

    // Стили (оставляем без изменений)
    var style = document.createElement('style');
    style.textContent = `
        .card__type {
            position: absolute;
            left: 0;
            top: 0.8em;
            // top: 2.2em;
            padding: 0.2em 0.8em;
            font-size: 0.9em;
            border-radius: 0.5em;
            text-transform: uppercase;
            font-weight: bold;
            z-index: 2;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            letter-spacing: 0.04em;
            line-height: 1.1;
            background: #ff4242;
            color: #fff;
        }
        .card__status {
            position: absolute;
            right: -0.8em;
            // top: -0.8em;
            padding: 0.2em 0.8em;
            font-size: 0.9em;
            border-radius: 0.5em;
            text-transform: uppercase;
            font-weight: bold;
            z-index: 2;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            letter-spacing: 0.04em;
            line-height: 1.1;
        }
        .card__status[data-status="ended"] {
            background: #4CAF50;
            color: #fff;
        }
        .card__status[data-status="airing"] {
            background: #2196F3;
            color: #fff;
        }
        .card__status[data-status="paused"] {
            background: #FFC107;
            color: #222;
        }
        .card__type + .card__status, .card__status + .card__type {
            top: 0.8em;
        }
    `;
    document.head.appendChild(style);

    // Настройки (без изменений)
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
            }
        });
    }

    // Оптимизированные функции
    var isEnabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
    var processedCards = new WeakSet();
    var observer;
    var pendingScan = false;

    function getCardView(card) {
        return card.card?.querySelector?.('.card__view') || 
               card.element?.querySelector?.('.card__view') || 
               card.querySelector?.('.card__view');
    }

    function getCardData(card) {
        return card.card_data || card.data || (card.dataset?.id ? card.dataset : card);
    }

    function isTvCard(card, data) {
        if ((data?.type === 'tv') || card.classList?.contains('card--tv')) return true;
        
        const cardView = getCardView(card);
        if (!cardView) return false;
        
        const typeElem = cardView.querySelector('.card__type');
        return typeElem?.textContent.trim().toUpperCase() === 'TV';
    }

    function addStatusToCard(card) {
        if (!isEnabled || processedCards.has(card)) return;

        const cardView = getCardView(card);
        if (!cardView) return;

        const data = getCardData(card);
        if (!isTvCard(card, data)) return;

        // Удаляем старые метки если есть
        cardView.querySelectorAll('.card__type, .card__status').forEach(el => el.remove());

        // Добавляем TV метку
        const typeElem = document.createElement('div');
        typeElem.className = 'card__type';
        typeElem.textContent = 'TV';
        cardView.appendChild(typeElem);

        // Добавляем статус
        let status = (data?.status || '').toLowerCase();
        if (!status && card.classList?.contains('card--tv')) status = 'airing';
        if (!status) status = data?.ended || data?.isEnded ? 'ended' : 'airing';

        const statusElement = document.createElement('div');
        statusElement.className = 'card__status';
        
        if (status === 'ended') {
            statusElement.setAttribute('data-status', 'ended');
            statusElement.textContent = 'Завершён';
        } else if (status === 'on hiatus' || status === 'paused') {
            statusElement.setAttribute('data-status', 'paused');
            statusElement.textContent = 'Пауза';
        } else {
            statusElement.setAttribute('data-status', 'airing');
            statusElement.textContent = 'В эфире';
        }
        
        cardView.appendChild(statusElement);
        processedCards.add(card);
    }

    function removeAllStatuses() {
        document.querySelectorAll('.card__status, .card__type').forEach(el => el.remove());
        processedCards = new WeakSet();
    }

    function scanCards(selector = '.card') {
        if (!isEnabled || pendingScan) return;
        pendingScan = true;
        
        requestAnimationFrame(() => {
            document.querySelectorAll(selector).forEach(card => {
                if (!processedCards.has(card)) {
                    addStatusToCard(card);
                }
            });
            pendingScan = false;
        });
    }

    function handleMoreButton() {
        const moreButton = document.querySelector('.items-line__more.selector');
        if (moreButton) {
            moreButton.addEventListener('click', function() {
                setTimeout(() => {
                    scanCards('.selector__body .card');
                }, 300);
            });
        }
    }

    // Оптимизированный наблюдатель
    function initObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    
                    if (node.classList?.contains('card')) {
                        addStatusToCard(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('.card').forEach(card => {
                            if (!processedCards.has(card)) {
                                addStatusToCard(card);
                            }
                        });
                    }
                    
                    // Обработка кнопки "Еще"
                    if (node.classList?.contains('items-line__more')) {
                        handleMoreButton();
                    }
                }
            }
            
            // Периодическое сканирование для страниц категорий
            if (document.querySelector('.category-full, .items-cards')) {
                scanCards('.category-full .card, .items-cards .card');
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Инициализация
    if (typeof Lampa !== 'undefined') {
        // Обработка событий Lampa
        Lampa.Listener.follow('activity', function(event) {
            initObserver();
            handleMoreButton();
            
            // Специальная обработка для категорий
            if (event.component === 'category' || event.component === 'category_full' || event.component === 'catalog') {
                setTimeout(() => {
                    scanCards('.category-full .card, .items-cards .card');
                }, 300);
                
                setTimeout(() => {
                    scanCards('.category-full .card, .items-cards .card');
                }, 1000);
            }
        });

        Lampa.Listener.follow('line', function(event) {
            if (event.type === 'append' && event.items) {
                event.items.forEach(card => {
                    if (!processedCards.has(card)) {
                        addStatusToCard(card);
                    }
                });
            }
        });

        // Первоначальный запуск
        if (isEnabled) {
            initObserver();
            handleMoreButton();
            
            setTimeout(() => {
                scanCards();
            }, 500);
            
            setTimeout(() => {
                scanCards();
            }, 1500);
        }
    }
})();
