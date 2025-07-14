(function() {
    'use strict';

    // Стили для статуса и метки TV
    var style = document.createElement('style');
    style.textContent = `
        .card__type {
            position: absolute;
            left: -0;
            top: 0.8em;
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
            top: 0.8em;
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
            top: 2.2em;
        }
    `;
    document.head.appendChild(style);

    // Оставляем только один глобальный переключатель
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
            }
        });
    }

    function getCardView(card) {
        if (!card) return null;
        if (card.card && card.card.querySelector) return card.card.querySelector('.card__view');
        if (card.element && card.element.querySelector) return card.element.querySelector('.card__view');
        if (card.querySelector) return card.querySelector('.card__view');
        return null;
    }

    function getCardData(card) {
        if (card.card_data) return card.card_data;
        if (card.data) return card.data;
        if (card.dataset && card.dataset.id) return card.dataset;
        return card;
    }

    function isTvCard(card, data) {
        if ((data && data.type === 'tv') || (card.classList && card.classList.contains('card--tv'))) return true;
        // Fallback: если есть .card__type с текстом TV
        const cardView = getCardView(card);
        if (cardView) {
            const typeElem = cardView.querySelector('.card__type');
            if (typeElem && typeElem.textContent.trim().toUpperCase() === 'TV') return true;
        }
        return false;
    }

    function addTypeToCard(card) {
        const cardView = getCardView(card);
        if (!cardView) return;
        // Удаляем старые метки
        let oldType = cardView.querySelector('.card__type');
        if (oldType) oldType.remove();
        let oldStatus = cardView.querySelector('.card__status');
        if (oldStatus) oldStatus.remove();
        // Добавляем TV
        let typeElem = document.createElement('div');
        typeElem.className = 'card__type';
        typeElem.textContent = 'TV';
        cardView.insertBefore(typeElem, cardView.firstChild);
        return typeElem;
    }

    function addStatusToCard(card) {
        const data = getCardData(card);
        const cardView = getCardView(card);
        if (!cardView) return;
        if (!isTvCard(card, data)) return;
        // Удаляем старые метки
        let oldType = cardView.querySelector('.card__type');
        if (oldType) oldType.remove();
        let oldStatus = cardView.querySelector('.card__status');
        if (oldStatus) oldStatus.remove();
        // Сначала TV, потом статус
        addTypeToCard(card);
        let status = (data && data.status ? data.status : '').toLowerCase();
        if (!status && card.classList && card.classList.contains('card--tv')) {
            status = 'airing';
        }
        if (!status) {
            if (data && (data.ended || data.isEnded)) status = 'ended';
            else status = 'airing';
        }
        let statusElement = document.createElement('div');
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
    }

    function scanAllCards() {
        // Обход всех карточек во всех возможных контейнерах
        var containers = document.querySelectorAll('.category-full, .items-cards, .items-cards > div, .category-full > div');
        containers.forEach(function(container) {
            var cards = container.querySelectorAll('.card');
            cards.forEach(addStatusToCard);
        });
    }

    // Главная страница (линии)
    Lampa.Listener.follow('line', function(event) {
        if (event.type !== 'append') return;
        if (!event.items || !event.items.length) return;
        var enabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
        if (!enabled) return;
        event.items.forEach(addStatusToCard);
    });

    // Универсальный MutationObserver для всех разделов
    var observers = {};
    function observeSection(sectionKey, selectors) {
        if (observers[sectionKey]) {
            observers[sectionKey].forEach(obs => obs.disconnect());
            observers[sectionKey] = null;
        }
        var enabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
        if (!enabled) return;
        var containers = [];
        selectors.forEach(function(sel) {
            containers = containers.concat(Array.from(document.querySelectorAll(sel)));
        });
        observers[sectionKey] = [];
        containers.forEach(function(container) {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType !== 1) return;
                        if (node.classList.contains('card')) {
                            addStatusToCard(node);
                        } else {
                            var cards = node.querySelectorAll && node.querySelectorAll('.card');
                            if (cards && cards.length) {
                                cards.forEach(addStatusToCard);
                            }
                        }
                    });
                });
                // Через небольшой таймаут повторяем обход на случай, если карточки появились с задержкой
                setTimeout(scanAllCards, 100);
            });
            observer.observe(container, { childList: true, subtree: true });
            observers[sectionKey].push(observer);
            // Инициализация для уже существующих карточек
            var cards = container.querySelectorAll('.card');
            cards.forEach(addStatusToCard);
        });
    }

    // Отключение всех наблюдателей
    function disconnectAllObservers() {
        Object.keys(observers).forEach(function(key) {
            if (observers[key]) {
                observers[key].forEach(obs => obs.disconnect());
                observers[key] = null;
            }
        });
    }

    if (typeof Lampa !== 'undefined' && Lampa.Listener) {
        Lampa.Listener.follow('activity', function(event) {
            if (!event || !event.component) return;
            disconnectAllObservers();
            // Главная страница
            if (event.component === 'main') {
                var enabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
                if (enabled) {
                    observeSection('main', ['.category-full', '.items-cards']);
                    scanAllCards();
                    setTimeout(scanAllCards, 500);
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.category-full .card, .items-cards .card');
                        cards.forEach(addStatusToCard);
                    }, 300);
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.category-full .card, .items-cards .card');
                        cards.forEach(addStatusToCard);
                    }, 1000);
                }
            }
            // Категории/все сериалы
            if (event.component === 'category' || event.component === 'category_full' || event.component === 'catalog') {
                var enabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
                if (enabled) {
                    observeSection('category', ['.category-full', '.items-cards']);
                    scanAllCards();
                    setTimeout(scanAllCards, 500);
                    // Сразу обработать все уже существующие карточки
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.category-full .card, .items-cards .card');
                        cards.forEach(addStatusToCard);
                    }, 300);
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.category-full .card, .items-cards .card');
                        cards.forEach(addStatusToCard);
                    }, 1000);
                }
            }
            // История
            if (event.component === 'history') {
                var enabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
                if (enabled) {
                    observeSection('history', ['.category-full', '.items-cards']);
                    scanAllCards();
                    setTimeout(scanAllCards, 500);
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.category-full .card, .items-cards .card');
                        cards.forEach(addStatusToCard);
                    }, 300);
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.category-full .card, .items-cards .card');
                        cards.forEach(addStatusToCard);
                    }, 1000);
                }
            }
            // Избранное
            if (event.component === 'favorite') {
                var enabled = Lampa.Storage.get(GLOBAL_KEY, GLOBAL_DEFAULT);
                if (enabled) {
                    observeSection('favorite', [
                        '.category-full',
                        '.items-cards',
                        '.favorite',
                        '.items-line--type-cards .items-cards'
                    ]);
                    scanAllCards();
                    setTimeout(scanAllCards, 500);
                    setTimeout(function() {
                        var cards = document.querySelectorAll(
                            '.favorite .card, ' +
                            '.items-line--type-cards .items-cards .card, ' +
                            '.category-full .card'
                        );
                        cards.forEach(addStatusToCard);
                    }, 300);
                    setTimeout(function() {
                        var cards = document.querySelectorAll(
                            '.favorite .card, ' +
                            '.items-line--type-cards .items-cards .card, ' +
                            '.category-full .card'
                        );
                        cards.forEach(addStatusToCard);
                    }, 1000);
                }
            }
        });
    }

})();