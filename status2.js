(function() {
    'use strict';

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
        '.card__status[data-status="canceled"] {',
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
                // else scanAllCards();
            }
        });
    }

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
            data.first_air_date ||    
            data.number_of_seasons ||    
            card.classList.contains('card--tv') ||     
            (typeElement && typeElement.textContent.trim().toUpperCase() === 'TV');  
        
        if (!isTv) return;  
    
        var existingStatus = (data.status || (data.movie && data.movie.status) || '').toLowerCase();  
        if (existingStatus) {  
            addStatusToCardView(existingStatus, cardView, card);  
            return;  
        }  
    
        // Если нет статуса, запрашиваем из TMDB  
        if (data.id && !data.status) {    
            fetchSeriesStatusFromTMDB(data.id, function(status) {    
                if (status) {    
                    data.status = status.toLowerCase();  
                    addStatusToCardView(status.toLowerCase(), cardView, card);  
                } else {  
                    // Если статус не получен, показываем только TV метку  
                    addStatusToCardView(null, cardView, card);  
                }  
            });    
        } else {  
            // Если нет ID, показываем только TV метку  
            addStatusToCardView(null, cardView, card);  
        }  
    }

    // Функция для добавления статуса (вынесена отдельно)  
    function addStatusToCardView(status, cardView, card) {  
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

        // Добавляем статус только если он есть  
        if (status) {  
            var statusElement = document.createElement('div');  
            statusElement.className = 'card__status';  
            
            if (status === 'ended') {  
                statusElement.setAttribute('data-status', 'ended');  
                statusElement.textContent = 'Завершён';  
            } else if (status === 'on hiatus' || status === 'paused') {  
                statusElement.setAttribute('data-status', 'paused');  
                statusElement.textContent = 'Пауза';  
            } else if (status === 'canceled') {  
                statusElement.setAttribute('data-status', 'canceled');  
                statusElement.textContent = 'Отменен';  
            } else if (status === 'returning series' || status === 'airing' || status === 'in production') {  
                statusElement.setAttribute('data-status', 'airing');  
                statusElement.textContent = 'В эфире';  
            } else {  
                // Если статус неизвестен, показываем только TV метку  
                addCardToProcessed(card);  
                return;  
            }  
            
            cardView.appendChild(statusElement);  
        }  
        
        addCardToProcessed(card);  
    }  


    function fetchSeriesStatusFromTMDB(seriesId, callback) {  
        // Используем существующую TMDB API инфраструктуру  
        var url = 'tv/' + seriesId + '?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.get('language', 'ru');  
        
        var network = new Lampa.Reguest();  
        network.timeout(1000 * 5);  
        network.silent(Lampa.TMDB.api(url), function(json) {  
            callback(json.status || null);  
        }, function() {  
            callback(null);  
        });  
    }  
    
    function removeAllStatuses() {
        var elements = document.querySelectorAll('.card__status, .card__type');
        for (var i = 0; i < elements.length; i++) {
            elements[i].parentNode.removeChild(elements[i]);
        }
        processedCards = [];
    }

    function updateStoredStatuses() {  

        // Обновляем историю  
        updateStatusesForType('history');  
        
        // Обновляем избранное (используем 'book', а не 'bookmarks')  
        updateStatusesForType('book');  
    }  

    function updateStatusesForType(type) {  
        var items;  
        try {  
            items = Lampa.Favorite.get({type: type});  
        } catch (error) {  
            setTimeout(function() {  
                updateStatusesForType(type);  
            }, 1000);  
            return;  
        }    
        
        if (items && items.length > 0) {      
            var hasUpdates = false;    
            var completedRequests = 0;  
            var totalRequests = 0;  
            
            // Подсчитываем количество запросов  
            for (var i = 0; i < items.length; i++) {  
                var item = items[i];  
                if (item.type === 'tv' || item.number_of_seasons || item.first_air_date) {  
                    if (item.id) {  
                        totalRequests++;  
                    }  
                }  
            }  
            
            if (totalRequests === 0) return;  
            
            // Функция для проверки завершения всех запросов  
            function checkCompletion() {  
                completedRequests++;  
                if (completedRequests === totalRequests) {  
                    // Все запросы завершены - сохраняем данные  
                    var storageKey = type === 'book' ? 'favorite' : type;    
                    var currentData = Lampa.Storage.get(storageKey, {});    
                    
                    if (currentData.card) {    
                        Lampa.Storage.set(storageKey, currentData);    
                    }  

                    if (hasUpdates) {  
                        setTimeout(function() {  
                            updateVisibleCards();  
                        }, 100);  
                    }
                }  
            }  
            
            // Выполняем запросы  
            for (var j = 0; j < items.length; j++) {  
                var item = items[j];  
                if (item.type === 'tv' || item.number_of_seasons || item.first_air_date) {      
                    if (item.id) {      
                        (function(currentItem) {  
                            fetchSeriesStatusFromTMDB(currentItem.id, function(newStatus) {      
                                if (newStatus && newStatus.toLowerCase() !== currentItem.status) {      
                                    currentItem.status = newStatus.toLowerCase();      
                                    hasUpdates = true;      
                                }  
                                checkCompletion();  
                            });  
                        })(item);  
                    }      
                }      
            }  
        }      
    }
    
    function updateVisibleCards() {  
        // Сбрасываем список обработанных карточек  
        processedCards = [];  
        
        // Получаем обновленные данные из Storage  
        var favoriteData = Lampa.Storage.get('favorite', {});  
        var historyData = Lampa.Storage.get('history', {});  
        
        var cards = document.querySelectorAll('.card');  
        
        for (var i = 0; i < cards.length; i++) {  
            var card = cards[i];  
            var data = card.card_data || card.data || {};  
            
            if (data.type === 'tv' || data.number_of_seasons || data.first_air_date) {  
                // Находим обновленные данные для этой карточки  
                var updatedItem = null;  
                
                // Ищем в избранном  
                if (favoriteData.card) {  
                    updatedItem = favoriteData.card.find(function(item) {  
                        return item.id === data.id;  
                    });  
                }  
                
                // Если не нашли в избранном, ищем в истории
                if (!updatedItem && historyData.card) {  
                    updatedItem = historyData.card.find(function(item) {  
                        return item.id === data.id;  
                    });  
                }  
                
                // Если нашли обновленный статус, обновляем карточку
                if (updatedItem && updatedItem.status !== data.status) {  
                    if (card.card_data) {  
                        card.card_data.status = updatedItem.status;  
                    }  
                    if (card.data) {  
                        card.data.status = updatedItem.status;  
                    }  
                }  
    
                addStatusToCard(card);  
            }  
        }  
    }

    // Инициализация через перехват событий
    if (typeof Lampa !== 'undefined') {
        // Обновляем статусы при инициализации плагина  
        setTimeout(function() {  
            updateStoredStatuses();  
        }, 1000);

        // Перехватываем событие создания карточки
        Lampa.Listener.follow('card', function(event) {
            if (event.type === 'build' && isEnabled) {
                addStatusToCard(event.object.card);
            }
        });
    }

    Lampa.Listener.follow('activity', (data) => {  
        if (data.component === 'bookmarks' && data.type === 'start') {  
            updateStoredStatuses();
        }  
        
        if (data.component === 'favorite' && data.type === 'start') {  
            updateStoredStatuses();
        }  
    })
})();