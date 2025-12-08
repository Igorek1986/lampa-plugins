(function() {    
    'use strict';    
    
    var DEBUG = false;    
        
    function log(message, data) {    
        if (DEBUG) {    
            console.log('[SerialStatus] ' + message, data !== undefined ? data : '');    
        }    
    }    
    
    log('Plugin initialization started');    
    
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
        '    left: 0;',    
        '    top: 2.8em;',      
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
    ].join('\n');    
    document.head.appendChild(style);    
    log('CSS styles injected');    
    
    var SETTINGS_COMPONENT = 'serial_status_settings';    
    var BASE_KEY = 'serial_status_enabled';    
    var GLOBAL_DEFAULT = true;    
    
    // ✅ Функции для работы с профиль-специфичными настройками
    function getProfileKey(baseKey) {    
        var profileId = Lampa.Storage.get('lampac_profile_id', '');    
        return baseKey + '_profile' + profileId;    
    }    
    
    function getProfileSetting(key, defaultValue) {    
        return Lampa.Storage.get(getProfileKey(key), defaultValue);    
    }    
    
    function setProfileSetting(key, value) {    
        Lampa.Storage.set(getProfileKey(key), value);    
    }  
      
    function hasProfileSetting(key) {    
        return Lampa.Storage.get(getProfileKey(key)) !== undefined;    
    }  
      
    // ✅ Инициализация настроек профиля  
    function loadProfileSettings() {    
        if (!hasProfileSetting(BASE_KEY)) {        
            setProfileSetting(BASE_KEY, GLOBAL_DEFAULT);        
        }  
    }  
    
    function init() {      
        log('Init function called');      
              
        if (typeof Lampa === 'undefined' || !Lampa.Storage) {      
            log('Lampa not ready, retrying...');      
            setTimeout(init, 100);      
            return;      
        }      
      
        log('Lampa is ready');      
        log('Is Lampa 3.0+:', Lampa.Manifest && Lampa.Manifest.app_digital >= 300);      
              
        var isLampa3 = Lampa.Manifest && Lampa.Manifest.app_digital >= 300;      
          
        // ✅ Загружаем настройки профиля  
        loadProfileSettings();  
          
        var processedCards = [];    
      
        log('Profile ID:', Lampa.Storage.get('lampac_profile_id', ''));    
        log('Settings key:', getProfileKey(BASE_KEY));    
        log('Plugin enabled:', getProfileSetting(BASE_KEY, GLOBAL_DEFAULT));      
      
        // ✅ Функция для получения текущего значения настройки (всегда актуальное)  
        function isPluginEnabled() {    
            return getProfileSetting(BASE_KEY, GLOBAL_DEFAULT);    
        }    
          
        if (Lampa.SettingsApi) {        
            Lampa.SettingsApi.addComponent({        
                component: SETTINGS_COMPONENT,        
                name: 'Статус сериалов',        
                icon: '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#2196F3"/><rect x="4" y="6" width="16" height="12" rx="1" fill="#fff"/></svg>'        
            });        
                  
            Lampa.SettingsApi.addParam({        
                component: SETTINGS_COMPONENT,        
                param: {        
                    name: BASE_KEY,  // ✅ Используем базовый ключ  
                    type: 'trigger',        
                    default: GLOBAL_DEFAULT        
                },        
                field: {        
                    name: 'Показывать статус сериалов',        
                    description: 'Включить или отключить отображение статуса (в эфире/завершён) и метки TV на всех карточках сериалов во всех разделах.'        
                },        
                onChange: function(value) {        
                    var isEnabled = value === true || value === 'true';  
                    setProfileSetting(BASE_KEY, isEnabled);  // ✅ Сохраняем через профильную функцию  
                    log('Settings changed for profile:', Lampa.Storage.get('lampac_profile_id', ''), 'value:', isEnabled);      
                }        
            });        
                  
            log('Settings registered');        
        }    
          
        // ✅ Обновляем настройки при смене профиля  
        Lampa.Listener.follow('app', function(e) {    
            if (e.type === 'activity') {    
                var activity = Lampa.Activity.active();    
                if (activity && activity.activity) {    
                    loadProfileSettings();  // ✅ Перезагружаем настройки профиля  
                    log('Activity changed, profile settings reloaded');  
                      
                    // ✅ Обновляем UI настроек с задержкой (как в MyShows)  
                    setTimeout(function() {  
                        var settingsPanel = document.querySelector('[data-component="' + SETTINGS_COMPONENT + '"]');  
                        if (settingsPanel) {  
                            var toggle = settingsPanel.querySelector('[data-name="' + BASE_KEY + '"]');  
                            if (toggle) {  
                                var currentValue = getProfileSetting(BASE_KEY, GLOBAL_DEFAULT);  
                                // Обновляем состояние переключателя  
                                if (toggle.classList) {  
                                    if (currentValue) {  
                                        toggle.classList.add('selector--active');  
                                    } else {  
                                        toggle.classList.remove('selector--active');  
                                    }  
                                }  
                                log('Settings UI updated for profile');  
                            }  
                        }  
                    }, 100);  
                }    
            }    
        });  
    
        function addStatusToCard(card) {    
            log('addStatusToCard called');    
            log('card:', card);    
              
            // ✅ ИСПРАВЛЕНИЕ: Всегда получаем актуальное значение настройки  
            if (!isPluginEnabled()) {    
                log('Plugin disabled');    
                return;    
            }    
              
            var cardElement = card;    
            if (card && card.get) {    
                cardElement = card.get(0);    
            } else if (card && card[0]) {    
                cardElement = card[0];    
            }    
              
            log('cardElement:', cardElement);    
              
            if (!cardElement) {    
                log('No card element');    
                return;    
            }    
              
            if (processedCards.indexOf(cardElement) !== -1) {    
                log('Card already processed');    
                return;    
            }    
              
            var cardView = cardElement.querySelector('.card__view');    
            log('cardView:', cardView);    
              
            if (!cardView) {    
                log('No card view');    
                return;    
            }    
              
            var data = cardElement.card_data || cardElement.data || {};    
            log('Card data:', data);    
              
            var isTv = data.type === 'tv' || data.first_air_date || data.number_of_seasons;    
            log('Is TV:', isTv);    
              
            if (!isTv) {    
                log('Not a TV show');    
                return;    
            }    
              
            if (!data.id) {    
                log('No ID');    
                return;    
            }    
              
            // Удаляем старые метки  
            var oldLabels = cardView.querySelectorAll('.card__type, .card__status');    
            for (var i = 0; i < oldLabels.length; i++) {    
                oldLabels[i].remove();    
            }    
            log('Removed old labels:', oldLabels.length);    
              
            // Добавляем метку "Сериал"    
            var typeElem = document.createElement('div');    
            typeElem.className = 'card__type';    
            typeElem.textContent = 'Сериал';    
            cardView.appendChild(typeElem);    
            log('Added "Сериал" label');    
              
            processedCards.push(cardElement);    
            log('Card marked as processed');    
              
            // Добавляем статус    
            var existingStatus = (data.status || '').toLowerCase();    
              
            if (existingStatus) {    
                addStatusBadge(existingStatus, cardView);    
            } else if (data.id) {    
                fetchSeriesStatus(data.id, function(newStatus) {    
                    if (newStatus) {    
                        addStatusBadge(newStatus.toLowerCase(), cardView);    
                    }    
                });    
            }    
        }  
            
        function addStatusBadge(status, cardView) {    
            if (cardView.querySelector('.card__status[data-status]')) return;    
                
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
                return;    
            }    
                
            cardView.appendChild(statusElement);    
            log('Status badge added:', status);    
        }    
            
        function fetchSeriesStatus(seriesId, callback) {    
            var url = 'tv/' + seriesId + '?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.get('language', 'ru');    
            var network = new Lampa.Reguest();    
            network.timeout(5000);    
            network.silent(Lampa.TMDB.api(url), function(json) {    
                callback(json.status || null);    
            }, function() {    
                callback(null);    
            });    
        }    
    
        if (isLampa3 && Lampa.Maker && Lampa.Maker.map) {    
            log('Attempting to intercept Card.onVisible for Lampa 3.0+');    
                
            try {    
                var cardMap = Lampa.Maker.map('Card');    
                log('Card map:', cardMap);    
                    
                if (cardMap && cardMap.Card && cardMap.Card.onVisible) {    
                    log('Found Card.onVisible, intercepting...');    
                    var originalOnVisible = cardMap.Card.onVisible;    
                        
                    cardMap.Card.onVisible = function() {    
                        log('Card.onVisible called');    
                        log('this:', this);    
                        log('this.html:', this.html);    
                            
                        originalOnVisible.call(this);    
                            
                        if (isPluginEnabled() && this.html) {    
                            log('Calling addStatusToCard from onVisible');    
                            addStatusToCard(this.html);    
                        } else {    
                            log('Skipping addStatusToCard:', {  
                                hasHtml: !!this.html  
                            });  
                        }  
                    };  
                      
                    log('Card.onVisible interception successful');  
                } else {  
                    log('Card.onVisible not found');  
                }  
            } catch (error) {  
                log('ERROR intercepting Card.onVisible:', error);  
            }  
        }  
          
        log('Initialization complete');  
    }  
  
    init();  
})();