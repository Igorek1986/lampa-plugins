(function () {
    'use strict';
    
    var icon_reset = `
    <svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
    </svg>
    `;

    Lampa.Lang.add({
        reset_settings: {
            ru: 'Сбросить настройки',
            en: 'Reset settings',
            uk: 'Скинути налаштування',
        },
        reset_confirm: {
            ru: 'Сбросить все настройки?',
            en: 'Reset all settings?',
            uk: 'Скинути всі налаштування?',
        },
        cancel: {
            ru: 'Отмена',
            en: 'Cancel',
            uk: 'Скасувати',
        },
        reset: {
            ru: 'Сбросить',
            en: 'Reset',
            uk: 'Скинути',
        }
    });

    function resetStorage() {
        
        var unic_id = Lampa.Storage.get('lampac_unic_id');
        var profile_id = Lampa.Storage.get('lampac_profile_id');
        
        localStorage.clear();
        
        if (unic_id) Lampa.Storage.set('lampac_unic_id', unic_id);
        if (profile_id) Lampa.Storage.set('lampac_profile_id', profile_id);
        
        setTimeout(function() {
            window.location.reload();
        }, 300);
    }

    function addResetButton() {
        
        if (Lampa.Settings.main && !Lampa.Settings.main().render().find('[data-component="reset_settings"]').length) {
            var button = $(`
                <div class="settings-folder selector" data-component="reset_settings" data-static="true">
                    <div class="settings-folder__icon">${icon_reset}</div>
                    <div class="settings-folder__name">${Lampa.Lang.translate('reset_settings')}</div>
                </div>
            `);
            
            Lampa.Settings.main().render().find('[data-component="backup"]').after(button);
            Lampa.Settings.main().update();
        }
    }

    Lampa.Settings.listener.follow('open', function(e) {
        if (e.name === 'main') {
            e.body.find('[data-component="reset_settings"]').off('hover:enter').on('hover:enter', function() {
                
                Lampa.Modal.open({  
                    title: Lampa.Lang.translate('reset_settings'),  
                    align: 'center',  
                    html: $('<div>' + Lampa.Lang.translate('reset_confirm') + '</div>'),  
                    buttons: [  
                        {  
                            name: Lampa.Lang.translate('cancel'),  
                            onSelect: function() {  
                                Lampa.Modal.close();  
                                Lampa.Controller.toggle('settings'); // Возвращаем фокус к настройкам  
                            }  
                        },  
                        {  
                            name: Lampa.Lang.translate('reset'),  
                            onSelect: function() {  
                                Lampa.Modal.close();  
                                resetStorage();  
                                Lampa.Controller.toggle('settings'); // Возвращаем фокус к настройкам  
                            }  
                        }  
                    ],  
                    onBack: function() {  
                        Lampa.Modal.close();  
                        Lampa.Controller.toggle('settings'); // Возвращаем фокус к настройкам  
                    },  
                });
            });
        }
    });

    if (window.appready) {
        addResetButton();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') addResetButton();
        });
    }
})();