(function () {
    var SOURCE_NAME = 'NUMParser';
    var BASE_URL = 'https://numparser.igorek1986.ru/releases';

    var CATEGORIES = {
        k4: 'lampac_movies_4k.json',
        k4_new: 'lampac_movies_4k_new.json',
        movies_new: "lampac_movies_new.json",
        movies: 'lampac_movies.json',
        russian_new_movies: 'lampac_movies_ru_new.json',
        russian_movies: 'lampac_movies_ru.json',
        cartoons: 'lampac_all_cartoon_movies.json',
        cartoons_tv: 'lampac_all_cartoon_series.json',
        all_tv: 'lampac_all_tv_shows.json',
        russian_tv: 'lampac_all_tv_shows_ru.json'
    };

    function NumparserApiService() {
        var self = this;
        self.network = new Lampa.Reguest();
        self.discovery = false;

        self.category = function (params, onSuccess, onError) {
            params = params || {};

            var partsData = [
                function (callback) {
                    makeRequest(CATEGORIES.k4_new, 'В высоком качестве (новые)', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.movies_new, 'Новые фильмы', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.russian_new_movies, 'Новые русские фильмы', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.all_tv, 'Сериалы', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.russian_tv, 'Русские сериалы', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.cartoons, 'Мультфильмы', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.k4, 'В высоком качестве', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.movies, Lampa.Lang.translate('menu_movies'), callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.russian_movies, 'Русские фильмы', callback);
                },
                function (callback) {
                    makeRequest(CATEGORIES.cartoons_tv, 'Мультсериалы', callback);
                }
            ];

            function makeRequest(category, title, callback) {
                var page = params.page || 1;
                var perPage = params.per_page || 20; // Добавляем параметр количества элементов на странице
                var url = BASE_URL + '/' + category + '?language=' + Lampa.Storage.get('tmdb_lang', 'ru');

                self.network.silent(url, function(response) {
                    if (!response) {
                        callback({ error: 'Empty response' });
                        return;
                    }

                    // Определяем, где находятся данные (массив или объект с results)
                    let items = Array.isArray(response) ? response : (response.results || []);
                    const total = items.length;
                    const totalPages = Math.ceil(total / perPage);

                    // Применяем пагинацию
                    const startIndex = (page - 1) * perPage;
                    const endIndex = Math.min(startIndex + perPage, total);
                    const paginatedItems = items.slice(startIndex, endIndex);

                    // Формируем ответ в нужном формате
                    const result = {
                        url: category,
                        title: title,
                        page: page,
                        per_page: perPage,
                        total_results: total,
                        total_pages: totalPages,
                        more: page < totalPages,
                        results: paginatedItems,
                        source: SOURCE_NAME
                    };

                    callback(result);
                }, function(error) {
                    callback({ error: error });
                });
            }

            function loadPart(partLoaded, partEmpty) {
                Lampa.Api.partNext(partsData, 5, function (result) {
                    partLoaded(result);
                }, function (error) {
                    partEmpty(error);
                });
            }

            loadPart(onSuccess, onError);
            return loadPart;
        };
    }

    function startPlugin() {
        if (window.numparser_plugin) {
            return;
        }
        window.numparser_plugin = true;

        if (Lampa.Storage.field('start_page') === SOURCE_NAME) {
            window.start_deep_link = {
                component: 'category',
                page: 1,
                url: '',
                source: SOURCE_NAME,
                title: SOURCE_NAME
            };
        }

        var values = Lampa.Params.values.start_page;
        values[SOURCE_NAME] = SOURCE_NAME;

        var numparserApi = new NumparserApiService();
        Lampa.Api.sources.numparser = numparserApi;
        Object.defineProperty(Lampa.Api.sources, SOURCE_NAME, {
            get: function () {
                return numparserApi;
            }
        });

        var menuItem = $('<li data-action="numparser" class="menu__item selector"><div class="menu__ico"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"><g><g><path fill="currentColor" d="M482.909,67.2H29.091C13.05,67.2,0,80.25,0,96.291v319.418C0,431.75,13.05,444.8,29.091,444.8h453.818c16.041,0,29.091-13.05,29.091-29.091V96.291C512,80.25,498.95,67.2,482.909,67.2z M477.091,409.891H34.909V102.109h442.182V409.891z"/></g></g><g><g><rect fill="currentColor" x="126.836" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="350.255" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="367.709" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="367.709" y="292.364" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="292.364" width="126.836" height="34.909"/></g></g></svg></div><div class="menu__text">NUMParser</div></li>');
        $('.menu .menu__list').eq(0).append(menuItem);

        menuItem.on('hover:enter', function () {
            Lampa.Activity.push({
                title: SOURCE_NAME,
                component: 'category',
                source: SOURCE_NAME,
                page: 1
            });
        });
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                startPlugin();
            }
        });
    }
})();
