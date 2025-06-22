(function () {
    var DEFAULT_SOURCE_NAME = 'NUMParser';
    var SOURCE_NAME = Lampa.Storage.get('numparser_source_name', DEFAULT_SOURCE_NAME);
    var BASE_URL = 'https://numparser.igorek1986.ru/';
    var ICON = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"><g><g><path fill="currentColor" d="M482.909,67.2H29.091C13.05,67.2,0,80.25,0,96.291v319.418C0,431.75,13.05,444.8,29.091,444.8h453.818c16.041,0,29.091-13.05,29.091-29.091V96.291C512,80.25,498.95,67.2,482.909,67.2z M477.091,409.891H34.909V102.109h442.182V409.891z"/></g></g><g><g><rect fill="currentColor" x="126.836" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="350.255" y="84.655" width="34.909" height="342.109"/></g></g><g><g><rect fill="currentColor" x="367.709" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="184.145" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="367.709" y="292.364" width="126.836" height="34.909"/></g></g><g><g><rect fill="currentColor" x="17.455" y="292.364" width="126.836" height="34.909"/></g></g></svg>';

    // Настройки видимости групп годов
    var currentYear = new Date().getFullYear();

    function isYearVisible(year) {
        if (year >= 1980 && year <= 1989) return CATEGORY_VISIBILITY.year_1980_1989.visible;
        if (year >= 1990 && year <= 1999) return CATEGORY_VISIBILITY.year_1990_1999.visible;
        if (year >= 2000 && year <= 2009) return CATEGORY_VISIBILITY.year_2000_2009.visible;
        if (year >= 2010 && year <= 2019) return CATEGORY_VISIBILITY.year_2010_2019.visible;
        if (year >= 2020 && year <= currentYear) return CATEGORY_VISIBILITY.year_2020_current.visible;
        return false;
    }

    // Настройки видимости категорий
    var CATEGORY_VISIBILITY = {
        legends: {
            title: 'Топ фильмы',
            visible: Lampa.Storage.get('numparser_category_legends', true)
        },
        episodes: {
            title: 'Ближайшие выходы эпизодов'
        },
        k4_new: {
            title: 'В высоком качестве (новые)',
            visible: Lampa.Storage.get('numparser_category_k4_new', true)
        },
        movies_new: {
            title: 'Новые фильмы',
            visible: Lampa.Storage.get('numparser_category_movies_new', true)
        },
        russian_new_movies: {
            title: 'Новые русские фильмы',
            visible: Lampa.Storage.get('numparser_category_russian_new_movies', true)
        },
        all_tv: {
            title: 'Сериалы',
            visible: Lampa.Storage.get('numparser_category_all_tv', true)
        },
        russian_tv: {
            title: 'Русские сериалы',
            visible: Lampa.Storage.get('numparser_category_russian_tv', true)
        },
        anime: {
            title: 'Аниме',
            visible: Lampa.Storage.get('numparser_category_anime', true)
        },
        k4: {
            title: 'В высоком качестве',
            visible: Lampa.Storage.get('numparser_category_k4', true)
        },
        movies: {
            title: 'Фильмы',
            visible: Lampa.Storage.get('numparser_category_movies', true)
        },
        russian_movies: {
            title: 'Русские фильмы',
            visible: Lampa.Storage.get('numparser_category_russian_movies', true)
        },
        cartoons: {
            title: 'Мультфильмы',
            visible: Lampa.Storage.get('numparser_category_cartoons', true)
        },
        cartoons_tv: {
            title: 'Мультсериалы',
            visible: Lampa.Storage.get('numparser_category_cartoons_tv', true)
        },
        // Группы годов
        year_1980_1989: {
            title: 'Фильмы 1980-1989',
            visible: Lampa.Storage.get('numparser_year_1980_1989', false)
        },
        year_1990_1999: {
            title: 'Фильмы 1990-1999',
            visible: Lampa.Storage.get('numparser_year_1990_1999', false)
        },
        year_2000_2009: {
            title: 'Фильмы 2000-2009',
            visible: Lampa.Storage.get('numparser_year_2000_2009', false)
        },
        year_2010_2019: {
            title: 'Фильмы 2010-2019',
            visible: Lampa.Storage.get('numparser_year_2010_2019', true)
        },
        year_2020_current: {
            title: 'Фильмы 2020-' + currentYear,
            visible: Lampa.Storage.get('numparser_year_2020_current', true)
        }
    };

    var CATEGORIES = {
        k4: 'lampac_movies_4k',
        k4_new: 'lampac_movies_4k_new',
        movies_new: "lampac_movies_new",
        movies: 'lampac_movies',
        russian_new_movies: 'lampac_movies_ru_new',
        russian_movies: 'lampac_movies_ru',
        cartoons: 'lampac_all_cartoon_movies',
        cartoons_tv: 'lampac_all_cartoon_series',
        all_tv: 'lampac_all_tv_shows',
        russian_tv: 'lampac_all_tv_shows_ru',
        legends: 'legends_id',
        anime: 'anime_id',
    };

    // Динамически добавляем категории для годов
    for (var year = 1980; year <= currentYear; year++) {
        CATEGORIES['movies_id_' + year] = 'movies_id_' + year;
    }

    function NumparserApiService() {
        var self = this;
        self.network = new Lampa.Reguest();
        self.discovery = false;

        function normalizeData(json) {
            return {
                results: (json.results || []).map(function (item) {
                    var dataItem = {
                        id: item.id,
                        poster_path: item.poster_path || item.poster || '',
                        img: item.img,
                        overview: item.overview || item.description || '',
                        vote_average: item.vote_average || 0,
                        backdrop_path: item.backdrop_path || item.backdrop || '',
                        background_image: item.background_image,
                        source: Lampa.Storage.get('numparser_source_name') || SOURCE_NAME
                    };

                    if (!!item.release_quality) dataItem.release_quality = item.release_quality;

                    if (!!item.name) dataItem.name = item.name;
                    if (!!item.title) dataItem.title = item.title;
                    if (!!item.original_name) dataItem.original_name = item.original_name;
                    if (!!item.original_title) dataItem.original_title = item.original_title;

                    if (!!item.release_date) dataItem.release_date = item.release_date;
                    if (!!item.first_air_date) dataItem.first_air_date = item.first_air_date;
                    if (!!item.number_of_seasons) dataItem.number_of_seasons = item.number_of_seasons;
                    if (!!item.last_air_date) dataItem.last_air_date = item.last_air_date;
                    if (!!item.last_episode_to_air) dataItem.last_episode_to_air = item.last_episode_to_air;

                    dataItem.promo_title = dataItem.name || dataItem.title || dataItem.original_name || dataItem.original_title;
                    dataItem.promo = dataItem.overview;

                    return dataItem;
                }),
                page: json.page || 1,
                total_pages: json.total_pages || json.pagesCount || 1,
                total_results: json.total_results || json.total || 0
            };
        }

        self.get = function (url, params, onComplete, onError) {
            self.network.silent(url, function (json) {
                if (!json) {
                    onError(new Error('Empty response from server'));
                    return;
                }
                var normalizedJson = normalizeData(json);
                onComplete(normalizedJson);
            }, function (error) {
                onError(error);
            });
        };

        self.list = function (params, onComplete, onError) {
            params = params || {};
            onComplete = onComplete || function () { };
            onError = onError || function () { };

            var category = params.url || CATEGORIES.movies_new;
            var page = params.page || 1;
            var url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');

            self.get(url, params, function(json) {
                onComplete({
                    results: json.results || [],
                    page: json.page || page,
                    total_pages: json.total_pages || 1,
                    total_results: json.total_results || 0
                });
            }, onError);
        };

        self.full = function (params, onSuccess, onError) {
            var card = params.card;
            params.method = !!(card.number_of_seasons || card.seasons || card.first_air_date) ? 'tv' : 'movie';
            Lampa.Api.sources.tmdb.full(params, onSuccess, onError);
        }

        self.category = function (params, onSuccess, onError) {
            params = params || {};

            var partsData = [];

            // Основные категории с проверкой видимости
            if (CATEGORY_VISIBILITY.legends.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.legends, CATEGORY_VISIBILITY.legends.title, callback);
            });
            if (CATEGORY_VISIBILITY.episodes.visible) {
                partsData.push(function (callback) {
                    callback({
                        source: 'tmdb',
                        results: Lampa.TimeTable.lately().slice(0, 20),
                        title: CATEGORY_VISIBILITY.episodes.title,
                        nomore: true,
                        cardClass: function (elem, params) {
                            return new Episode(elem, params);
                        }
                    });
                });
            };
            if (CATEGORY_VISIBILITY.k4_new.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.k4_new, CATEGORY_VISIBILITY.k4_new.title, callback);
            });
            if (CATEGORY_VISIBILITY.movies_new.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.movies_new, CATEGORY_VISIBILITY.movies_new.title, callback);
            });
            if (CATEGORY_VISIBILITY.russian_new_movies.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.russian_new_movies, CATEGORY_VISIBILITY.russian_new_movies.title, callback);
            });
            if (CATEGORY_VISIBILITY.all_tv.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.all_tv, CATEGORY_VISIBILITY.all_tv.title, callback);
            });
            if (CATEGORY_VISIBILITY.russian_tv.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.russian_tv, CATEGORY_VISIBILITY.russian_tv.title, callback);
            });
            if (CATEGORY_VISIBILITY.cartoons.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.cartoons, CATEGORY_VISIBILITY.cartoons.title, callback);
            });
            if (CATEGORY_VISIBILITY.k4.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.k4, CATEGORY_VISIBILITY.k4.title, callback);
            });
            if (CATEGORY_VISIBILITY.movies.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.movies, CATEGORY_VISIBILITY.movies.title, callback);
            });
            if (CATEGORY_VISIBILITY.russian_movies.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.russian_movies, CATEGORY_VISIBILITY.russian_movies.title, callback);
            });
            if (CATEGORY_VISIBILITY.cartoons_tv.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.cartoons_tv, CATEGORY_VISIBILITY.cartoons_tv.title, callback);
            });
            if (CATEGORY_VISIBILITY.anime.visible) partsData.push(function (callback) {
                makeRequest(CATEGORIES.anime, CATEGORY_VISIBILITY.anime.title, callback);
            });

            // Добавляем категории по годам в обратном порядке (от новых к старым)
            for (var year = 2025; year >= 1980; year--) {
                if (isYearVisible(year)) {
                    (function(y) {
                        partsData.push(function(callback) {
                            makeRequest(CATEGORIES['movies_id_' + y], 'Фильмы ' + y + ' года', callback);
                        });
                    })(year);
                }
            }

            function makeRequest(category, title, callback) {
                var page = params.page || 1;
                var url = BASE_URL + '/' + category + '?page=' + page + '&language=' + Lampa.Storage.get('tmdb_lang', 'ru');

                self.get(url, params, function(json) {
                    var result = {
                        url: category,
                        title: title,
                        page: page,
                        total_results: json.total_results || 0,
                        total_pages: json.total_pages || 1,
                        more: json.total_pages > page,
                        results: json.results || [],
                        source: Lampa.Storage.get('numparser_source_name') || SOURCE_NAME
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

    function Episode(data) {
        var self = this;
        var card = data.card || data;
        var episode = data.next_episode_to_air || data.episode || {};
        if (card.source === undefined) {
            card.source = SOURCE_NAME;
        }
        Lampa.Arrays.extend(card, {
            title: card.name,
            original_title: card.original_name,
            release_date: card.first_air_date
        });
        card.release_year = ((card.release_date || '0000') + '').slice(0, 4);

        function remove(elem) {
            if (elem) {
                elem.remove();
            }
        }

        self.build = function () {
            self.card = Lampa.Template.js('card_episode');
            if (!self.card) {
                Lampa.Noty.show('Error: card_episode template not found');
                return;
            }
            self.img_poster = self.card.querySelector('.card__img') || {};
            self.img_episode = self.card.querySelector('.full-episode__img img') || {};
            self.card.querySelector('.card__title').innerText = card.title || 'No title';
            self.card.querySelector('.full-episode__num').innerText = card.unwatched || '';
            if (episode && episode.air_date) {
                self.card.querySelector('.full-episode__name').innerText = 's' + (episode.season_number || '?') + 'e' + (episode.episode_number || '?') + '. ' + (episode.name || Lampa.Lang.translate('noname'));
                self.card.querySelector('.full-episode__date').innerText = episode.air_date ? Lampa.Utils.parseTime(episode.air_date).full : '----';
            }

            if (card.release_year === '0000') {
                remove(self.card.querySelector('.card__age'));
            } else {
                self.card.querySelector('.card__age').innerText = card.release_year;
            }

            self.card.addEventListener('visible', self.visible);
        };

        self.image = function () {
            self.img_poster.onload = function () { };
            self.img_poster.onerror = function () {
                self.img_poster.src = './img/img_broken.svg';
            };
            self.img_episode.onload = function () {
                self.card.querySelector('.full-episode__img').classList.add('full-episode__img--loaded');
            };
            self.img_episode.onerror = function () {
                self.img_episode.src = './img/img_broken.svg';
            };
        };

        self.visible = function () {
            if (card.poster_path) {
                self.img_poster.src = Lampa.Api.img(card.poster_path);
            } else if (card.profile_path) {
                self.img_poster.src = Lampa.Api.img(card.profile_path);
            } else if (card.poster) {
                self.img_poster.src = card.poster;
            } else if (card.img) {
                self.img_poster.src = card.img;
            } else {
                self.img_poster.src = './img/img_broken.svg';
            }
            if (card.still_path) {
                self.img_episode.src = Lampa.Api.img(episode.still_path, 'w300');
            } else if (card.backdrop_path) {
                self.img_episode.src = Lampa.Api.img(card.backdrop_path, 'w300');
            } else if (episode.img) {
                self.img_episode.src = episode.img;
            } else if (card.img) {
                self.img_episode.src = card.img;
            } else {
                self.img_episode.src = './img/img_broken.svg';
            }
            if (self.onVisible) {
                self.onVisible(self.card, card);
            }
        };

        self.create = function () {
            self.build();
            self.card.addEventListener('hover:focus', function () {
                if (self.onFocus) {
                    self.onFocus(self.card, card);
                }
            });
            self.card.addEventListener('hover:hover', function () {
                if (self.onHover) {
                    self.onHover(self.card, card);
                }
            });
            self.card.addEventListener('hover:enter', function () {
                if (self.onEnter) {
                    self.onEnter(self.card, card);
                }
            });
            self.image();
        };

        self.destroy = function () {
            self.img_poster.onerror = function () { };
            self.img_poster.onload = function () { };
            self.img_episode.onerror = function () { };
            self.img_episode.onload = function () { };
            self.img_poster.src = '';
            self.img_episode.src = '';
            remove(self.card);
            self.card = null;
            self.img_poster = null;
            self.img_episode = null;
        };

        self.render = function (js) {
            return js ? self.card : $(self.card);
        };
    }

    function startPlugin() {
        if (window.numparser_plugin) return;
        window.numparser_plugin = true;


        newName = Lampa.Storage.get('numparser_settings', SOURCE_NAME);
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

        // Добавляем раздел настроек
        Lampa.SettingsApi.addComponent({
            component: 'numparser_settings',
            name: SOURCE_NAME,
            icon: ICON
        });

        // Настройка для изменения названия источника
        Lampa.SettingsApi.addParam({
            component: 'numparser_settings',
            param: {
                name: 'numparser_source_name',
                type: 'input',
                placeholder: 'Введите название',
                values: '',
                default: DEFAULT_SOURCE_NAME
            },
            field: {
                name: 'Название источника',
                description: 'Изменение названия источника в меню'
            },

            onChange: function (value) {
                newName = value;
                $('.num_text').text(value);
                Lampa.Settings.update();
            }
        });

        Object.keys(CATEGORY_VISIBILITY).forEach(function(option) {
            var settingName = 'numparser_settings' + option + '_visible';

            var visible = Lampa.Storage.get(settingName, "true").toString() === "true";
            CATEGORY_VISIBILITY[option].visible = visible;

            Lampa.SettingsApi.addParam({
                component: "numparser_settings",
                param: {
                  name: settingName,
                  type: "trigger",
                  default: visible
                },
                field: {
                  name: CATEGORY_VISIBILITY[option].title,
                  description: Lampa.Lang.translate('lnum_select_visibility')
                },
                onChange: function(value) {
                    CATEGORY_VISIBILITY[option].visible = value === "true";
                }
            });
        });

        var numparserApi = new NumparserApiService();
        Lampa.Api.sources.numparser = numparserApi;
        Object.defineProperty(Lampa.Api.sources, SOURCE_NAME, {
            get: function () {
                return numparserApi;
            }
        });

        var menuItem = $('<li data-action="numparser" class="menu__item selector"><div class="menu__ico">' + ICON + '</div><div class="menu__text num_text">' + SOURCE_NAME + '</div></li>');
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
