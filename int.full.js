(function () {
	"use strict";
	Lampa.Platform.tv();

	if (typeof Lampa === "undefined") return;

	if (!Lampa.Maker || !Lampa.Maker.map || !Lampa.Utils) return;
	if (window.plugin_interface_ready_v3) return;

	window.plugin_interface_ready_v3 = true;

	var VERSION = "1.0.1";
	var DEBUG = true;
	function log(message) {
		if (DEBUG) console.log("[Int] " + message);
	}

	var globalInfoCache = {};
	var globalReactionsCache = {};
	var backdropPreloadCache = {};
	var logoPreloadCache = {};
	// Кэши картинок ничем не ограничены по размеру — на долгом скролле
	// (много категорий/строк) в них копятся Image() с decoded-битмапом
	// в памяти и никогда не освобождаются. Держим только последние N,
	// старые вытесняем (FIFO, порядок ключей объекта = порядок вставки).
	var BACKDROP_CACHE_LIMIT = 60;
	var LOGO_CACHE_LIMIT = 60;
	function cacheImage(cache, limit, url, img, cacheName) {
		var keys = Object.keys(cache);
		while (keys.length >= limit) {
			var oldestKey = keys.shift();
			var oldestImg = cache[oldestKey];
			if (oldestImg) {
				oldestImg.onload = null;
				oldestImg.onerror = null;
				oldestImg.src = "";
			}
			delete cache[oldestKey];
			log(cacheName + ": evict (limit " + limit + ") " + oldestKey);
		}
		cache[url] = img;
	}
	// Все ссылки на логотипы — в одной записи localStorage (а не отдельный ключ на лого).
	var LOGO_CACHE_KEY = "int_logo_cache";
	var logoUrlCache = null;

	// Панель фона/инфо ("Стильный интерфейс") рисуется только на экранах Main
	// (Каталог, Подборки и т.п.) — на странице категории, поиске и т.д. её нет,
	// значит и бэкдроп/лого/реакции карточек там прелоадить незачем.
	// Счётчик, а не bool: экраны Main могут быть вложены друг в друга (стек активностей).
	var newInterfacePanelCount = 0;
	function isBackgroundPanelActive() {
		return newInterfacePanelCount > 0;
	}

	Lampa.Storage.set("interface_size", "small");
	Lampa.Storage.set("background", "false");

	addStyles();
	initializeSettings();

	// Раньше цвета рейтингов и прелоад бэкдропов/лого триггерились через два
	// MutationObserver, слушающих весь document.body — на слабых устройствах
	// это ощутимая постоянная нагрузка (colored_ratings) и одновременно
	// причина неограниченного роста кэшей (preload). Оба заменены на прямой
	// хук в Lampa.Maker.map('Card') (patchCardMaker) — срабатывает точечно,
	// один раз на карточку, без сканирования всего DOM.
	updateVoteColors();
	setupVoteColorsForDetailPage();
	preloadAllVisibleCards();
	patchCardMaker();

	console.log("Int", "plugin ready, version", VERSION);

	var mainMaker = Lampa.Maker.map("Main");
	if (!mainMaker || !mainMaker.Items || !mainMaker.Create) return;

	wrapMethod(mainMaker.Items, "onInit", function (originalMethod, args) {
		this.__newInterfaceEnabled = shouldEnableInterface(this && this.object);

		if (this.__newInterfaceEnabled) {
			if (this.object) this.object.wide = false;
			this.wide = false;
		}

		if (originalMethod) originalMethod.apply(this, args);
	});

	wrapMethod(mainMaker.Create, "onCreate", function (originalMethod, args) {
		if (originalMethod) originalMethod.apply(this, args);
		if (!this.__newInterfaceEnabled) return;

		var state = getOrCreateState(this);
		state.attach();
	});

	wrapMethod(mainMaker.Create, "onCreateAndAppend", function (originalMethod, args) {
		var data = args && args[0];
		if (this.__newInterfaceEnabled && data) {
			data.wide = false;

			if (!data.params) data.params = {};
			if (!data.params.items) data.params.items = {};
			data.params.items.view = 12;
			data.params.items_per_row = 12;
			data.items_per_row = 12;

			extendResultsWithStyle(data);
		}
		return originalMethod ? originalMethod.apply(this, args) : undefined;
	});

	wrapMethod(mainMaker.Items, "onAppend", function (originalMethod, args) {
		if (originalMethod) originalMethod.apply(this, args);
		if (!this.__newInterfaceEnabled) return;

		var element = args && args[0];
		var data = args && args[1];

		if (element && data) {
			handleLineAppend(this, element, data);
		}
	});

	wrapMethod(mainMaker.Items, "onDestroy", function (originalMethod, args) {
		if (this.__newInterfaceState) {
			this.__newInterfaceState.destroy();
			delete this.__newInterfaceState;
		}
		delete this.__newInterfaceEnabled;
		if (originalMethod) originalMethod.apply(this, args);
	});

	function isMobile() {
		return window.innerWidth < 767 || Lampa.Platform.screen("mobile");
	}

	function shouldEnableInterface(object) {
		if (!object) return false;
		if (isMobile()) return false;
		if (object.title === "Избранное") return false;
		return true;
	}

	function getOrCreateState(createInstance) {
		if (createInstance.__newInterfaceState) {
			return createInstance.__newInterfaceState;
		}
		var state = createState(createInstance);
		createInstance.__newInterfaceState = state;
		return state;
	}

	function createState(mainInstance) {
		var infoPanel = new InfoPanel();
		infoPanel.create();

		var backgroundWrapper = document.createElement("div");
		backgroundWrapper.className = "full-start__background-wrapper";

		var bg1 = document.createElement("img");
		bg1.className = "full-start__background";
		var bg2 = document.createElement("img");
		bg2.className = "full-start__background";

		backgroundWrapper.appendChild(bg1);
		backgroundWrapper.appendChild(bg2);

		var state = {
			main: mainInstance,
			info: infoPanel,
			background: backgroundWrapper,
			infoElement: null,
			backgroundTimer: null,
			backgroundLast: "",
			attached: false,

			attach: function () {
				if (this.attached) return;

				var container = mainInstance.render(true);
				if (!container) return;

				container.classList.add("new-interface");

				if (!backgroundWrapper.parentElement) {
					container.insertBefore(backgroundWrapper, container.firstChild || null);
				}

				var infoElement = infoPanel.render(true);
				this.infoElement = infoElement;

				if (infoElement && infoElement.parentNode !== container) {
					if (backgroundWrapper.parentElement === container) {
						container.insertBefore(infoElement, backgroundWrapper.nextSibling);
					} else {
						container.insertBefore(infoElement, container.firstChild || null);
					}
				}

				mainInstance.scroll.minus(infoElement);
				this.attached = true;
				newInterfacePanelCount++;
				log("panel attach, count=" + newInterfacePanelCount);
			},

			update: function (data) {
				if (!data) return;
				infoPanel.update(data);
				this.updateBackground(data);
			},

			updateBackground: function (data) {
				var BACKGROUND_DEBOUNCE_DELAY = 50;
				var self = this;
				var title = (data && (data.title || data.name)) || "";

				clearTimeout(this.backgroundTimer);

                // bg1.classList.remove("active");
	            // bg2.classList.remove("active");
                // his.backgroundLast = "";

				if (this._pendingImg) {
					log('bg cancel pending (superseded by "' + title + '"): ' + this._pendingImg.src);
					this._pendingImg.onload = null;
					this._pendingImg.onerror = null;
					this._pendingImg = null;
				}

				var show_bg = Lampa.Storage.get("show_background", true);
				var bg_resolution = Lampa.Storage.get("background_resolution", "original");
				var backdropUrl = data && data.backdrop_path && show_bg ? Lampa.Api.img(data.backdrop_path, bg_resolution) : "";

				log('bg request "' + title + '": ' + (backdropUrl || "(нет бэкдропа)"));

				if (backdropUrl === this.backgroundLast) {
					log('bg skip (уже текущий): ' + backdropUrl);
					return;
				}

				this.backgroundTimer = setTimeout(function () {
					if (!backdropUrl) {
						log('bg neutral (нет url) "' + title + '"');
						bg1.classList.remove("active");
						bg2.classList.remove("active");
						// Чистим src у обоих слоёв — иначе следующий show() может
						// переиспользовать этот <img> и на мгновение мелькнёт
						// старая картинка, пока не догрузится новая (см. лог).
						bg1.src = "";
						bg2.src = "";
						self.backgroundLast = "";
						return;
					}

					var nextLayer = bg1.classList.contains("active") ? bg2 : bg1;
					var prevLayer = bg1.classList.contains("active") ? bg1 : bg2;

					// Показать загруженный бэкдроп с кросс-фейдом. Раскрываем слой
					// (classList.add) только после подтверждённой отрисовки ИМЕННО
					// этого <img> — cached.complete проверяет отдельный преднагруженный
					// Image(), а не сам DOM-элемент bg1/bg2, так что мгновенной
					// гарантии на прод-устройствах это не даёт.
					function show() {
						function reveal() {
							log('bg reveal "' + title + '" -> ' + (nextLayer === bg1 ? "bg1" : "bg2") + ": " + backdropUrl);
							nextLayer.classList.add("active");
							setTimeout(function () {
								if (backdropUrl !== self.backgroundLast) return;
								prevLayer.classList.remove("active");
							}, 100);
						}

						log('bg show "' + title + '" -> ' + (nextLayer === bg1 ? "bg1" : "bg2") + ": " + backdropUrl);

						if (nextLayer.src === backdropUrl && nextLayer.complete) {
							reveal();
							return;
						}

						nextLayer.onload = function () {
							nextLayer.onload = null;
							nextLayer.onerror = null;
							if (backdropUrl !== self.backgroundLast) {
								log('bg layer onload ignored (backgroundLast сменился) "' + title + '"');
								return;
							}
							reveal();
						};
						nextLayer.onerror = function () {
							nextLayer.onload = null;
							nextLayer.onerror = null;
						};
						// Реально показываемый сейчас фон — максимальный приоритет,
						// даже если рядом ещё грузятся фоновые прелоады соседних карточек.
						nextLayer.fetchPriority = "high";
						nextLayer.src = backdropUrl;
					}

					// Картинки нет/не загрузилась — нейтральный фон вместо старой
					function neutral() {
						log('bg neutral (ошибка загрузки) "' + title + '": ' + backdropUrl);
						bg1.classList.remove("active");
						bg2.classList.remove("active");
						bg1.src = "";
						bg2.src = "";
						self.backgroundLast = "";
					}

					// Быстрый путь: бэкдроп уже преднагружен → показываем без задержки
					var cached = backdropPreloadCache[backdropUrl];
					if (cached && cached.complete) {
						log('bg fast-path (в кэше) "' + title + '": ' + backdropUrl);
						self.backgroundLast = backdropUrl;
						if (cached.naturalWidth > 0) show();
						else neutral();
						return;
					}

					var img = cached || new Image();
					self._pendingImg = img;
					backdropPreloadCache[backdropUrl] = img;
					// Эта картинка сейчас реально нужна — поднимаем приоритет, даже
					// если запрос уже стартовал ambient-прелоадом с низким.
					img.fetchPriority = "high";

					log('bg loading (не в кэше) "' + title + '": ' + backdropUrl);

					img.onload = function () {
						if (self._pendingImg !== img) {
							log('bg onload ignored (устарел) "' + title + '": ' + backdropUrl);
							return;
						}
						if (backdropUrl !== self.backgroundLast) {
							log('bg onload ignored (backgroundLast сменился) "' + title + '": ' + backdropUrl + " != " + self.backgroundLast);
							return;
						}
						self._pendingImg = null;
						show();
					};

					img.onerror = function () {
						if (self._pendingImg !== img) return;
						if (backdropUrl !== self.backgroundLast) return;
						self._pendingImg = null;
						neutral();
					};

					self.backgroundLast = backdropUrl;
					if (!img.src) img.src = backdropUrl;
				}, BACKGROUND_DEBOUNCE_DELAY);
			},

			reset: function () {
				infoPanel.empty();
			},

			destroy: function () {
				clearTimeout(this.backgroundTimer);
				infoPanel.destroy();

				var container = mainInstance.render(true);
				if (container) {
					container.classList.remove("new-interface");
				}

				if (this.infoElement && this.infoElement.parentNode) {
					this.infoElement.parentNode.removeChild(this.infoElement);
				}

				if (backgroundWrapper && backgroundWrapper.parentNode) {
					backgroundWrapper.parentNode.removeChild(backgroundWrapper);
				}

				if (this.attached) {
					newInterfacePanelCount--;
					log("panel detach, count=" + newInterfacePanelCount);
				}
				this.attached = false;
			},
		};

		return state;
	}

	function extendResultsWithStyle(data) {
		if (!data) return;

		if (Array.isArray(data.results)) {
			data.results.forEach(function (card) {
				if (card.wide !== false) {
					card.wide = false;
				}
			});

			Lampa.Utils.extendItemsParams(data.results, {
				style: {
					name: Lampa.Storage.get("wide_post") !== false ? "wide" : "small",
				},
			});
		}
	}

	function handleCard(state, card) {
		if (!card || card.__newInterfaceCard) return;
		if (typeof card.use !== "function" || !card.data) return;

		card.__newInterfaceCard = true;
		card.params = card.params || {};
		card.params.style = card.params.style || {};

		var targetStyle = Lampa.Storage.get("wide_post") !== false ? "wide" : "small";
		card.params.style.name = targetStyle;

		if (card.render && typeof card.render === "function") {
			var element = card.render(true);
			if (element) {
				var node = element.jquery ? element[0] : element;
				if (node && node.classList) {
					if (targetStyle === "wide") {
						node.classList.add("card--wide");
						node.classList.remove("card--small");
					} else {
						node.classList.add("card--small");
						node.classList.remove("card--wide");
					}
				}
			}
		}

		card.use({
			onFocus: function () {
				log('card onFocus: "' + (card.data.title || card.data.name || "") + '"');
				state.update(card.data);
			},
			onHover: function () {
				log('card onHover: "' + (card.data.title || card.data.name || "") + '"');
				state.update(card.data);
			},
			onTouch: function () {
				log('card onTouch: "' + (card.data.title || card.data.name || "") + '"');
				state.update(card.data);
			},
			onDestroy: function () {
				delete card.__newInterfaceCard;
			},
		});
	}

	function getCardData(card, results, index) {
		index = index || 0;

		if (card && card.data) return card.data;
		if (results && Array.isArray(results.results)) {
			return results.results[index] || results.results[0];
		}

		return null;
	}

	function findCardData(element) {
		if (!element) return null;

		var node = element && element.jquery ? element[0] : element;

		while (node && !node.card_data) {
			node = node.parentNode;
		}

		return node && node.card_data ? node.card_data : null;
	}

	function getFocusedCard(items) {
		var container = items && typeof items.render === "function" ? items.render(true) : null;
		if (!container || !container.querySelector) return null;

		var focusedElement = container.querySelector(".selector.focus") || container.querySelector(".focus");
		return findCardData(focusedElement);
	}

	function handleLineAppend(items, line, data) {
		if (line.__newInterfaceLine) return;
		line.__newInterfaceLine = true;

		var state = getOrCreateState(items);

		line.items_per_row = 12;
		line.view = 12;
		if (line.params) {
			line.params.items_per_row = 12;
			if (line.params.items) line.params.items.view = 12;
		}

		var processCard = function (card) {
			handleCard(state, card);
		};

		line.use({
			onInstance: function (instance) {
				processCard(instance);
			},
			onActive: function (card, results) {
				var cardData = getCardData(card, results);
				if (cardData) {
					log('line onActive: "' + (cardData.title || cardData.name || "") + '"');
					state.update(cardData);
				}
			},
			onToggle: function () {
				setTimeout(function () {
					var focusedCard = getFocusedCard(line);
					if (focusedCard) {
						log('line onToggle (32ms later): "' + (focusedCard.title || focusedCard.name || "") + '"');
						state.update(focusedCard);
					}
				}, 32);
			},
			onMore: function () {
				state.reset();
			},
			onDestroy: function () {
				state.reset();
				delete line.__newInterfaceLine;
			},
		});

		if (Array.isArray(line.items) && line.items.length) {
			line.items.forEach(processCard);
		}

		if (line.last) {
			var lastCardData = findCardData(line.last);
			if (lastCardData) state.update(lastCardData);
		}
	}

	function wrapMethod(object, methodName, wrapper) {
		if (!object) return;

		var originalMethod = typeof object[methodName] === "function" ? object[methodName] : null;

		object[methodName] = function () {
			var args = Array.prototype.slice.call(arguments);
			return wrapper.call(this, originalMethod, args);
		};
	}

	function addStyles() {
		if (addStyles.added) return;
		addStyles.added = true;

		var styles = Lampa.Storage.get("wide_post") !== false ? getWideStyles() : getSmallStyles();

		Lampa.Template.add("new_interface_style_v3", styles);
		$("body").append(Lampa.Template.get("new_interface_style_v3", {}, true));
	}

	function getWideStyles() {
		return `<style>
					.full-start-new__reactions {  
						display: flex;  
						flex-wrap: wrap;  
						margin: -0.5em;  
						margin-bottom: 1em;  
						min-height: 3.6em;  
						align-items: center;  
					}  
					.full-start-new__reactions > div {  
						padding: 0.5em;  
					}
					.items-line__title .full-person__photo {
						width: 1.8em !important;
						height: 1.8em !important;
					}
					.items-line__title .full-person--svg .full-person__photo {
						padding: 0.5em !important;
						margin-right: 0.5em !important;
					}
					.items-line__title .full-person__photo {
						margin-right: 0.5em !important;
					}
					.items-line {
						padding-bottom: 4em !important;
					}
					.new-interface-info__head, .new-interface-info__details{ opacity: 0; transition: opacity 0.5s ease; min-height: 2.2em !important;}
					.new-interface-info__head.visible, .new-interface-info__details.visible{ opacity: 1; }
					.new-interface .card.card--wide {
						width: 18.3em;
					}
					.new-interface .card.card--small {
						width: 18.3em;
					}
					.new-interface-info {
						position: relative;
						padding: 1.5em;
						height: 27.5em;
					}
					.new-interface-info__body {
						position: absolute;
						z-index: 9999999;
						width: 80%;
						padding-top: 1.1em;
					}
					.new-interface-info__head {
						color: rgba(255, 255, 255, 0.6);
						font-size: 1.3em;
						min-height: 1em;
					}
					.new-interface-info__head span {
						color: #fff;
					}
					.new-interface-info__title {
						font-size: 4em;
						font-weight: 600;
						margin-bottom: 0.3em;
						overflow: hidden;
						-o-text-overflow: '.';
						text-overflow: '.';
						display: -webkit-box;
						-webkit-line-clamp: 1;
						line-clamp: 1;
						-webkit-box-orient: vertical;
						margin-left: -0.03em;
						line-height: 1.3;
					}
					.new-interface-info__details {
						// margin-top: 1.2em;
						margin-bottom: 1.6em;
						display: flex;
						align-items: center;
						flex-wrap: wrap;
						min-height: 1.9em;
						font-size: 1.3em;
					}
					.new-interface-info__split {
						margin: 0 1em;
						font-size: 0.7em;
					}
					.new-interface-info__description {
						margin-bottom: 0.6em;
						font-size: 1.4em;
						font-weight: 310;
						line-height: 1.3;
						overflow: hidden;
						-o-text-overflow: '.';
						text-overflow: '.';
						display: -webkit-box;
						-webkit-line-clamp: 3;
						line-clamp: 3;
						-webkit-box-orient: vertical;
						width: 65%;
					}
					.new-interface .card-more__box {
						padding-bottom: 95%;
					}
					.new-interface .full-start__background-wrapper {
						position: absolute;
						top: 0;
						left: 0;
						width: 100%;
						height: 100%;
						z-index: -1;
						pointer-events: none;
					}
					.new-interface .full-start__background {
						position: absolute;
						height: 108%;
						width: 100%;
						top: -5em;
						left: 0;
						opacity: 0;
						object-fit: cover;
						transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
					}
					.new-interface .full-start__background.active {
						opacity: 0.5;
					}
					.new-interface .full-start__rate {
						font-size: 1.3em;
						margin-right: 0;
					}
					.new-interface .card__promo {
						display: none;
					}
					.new-interface .card.card--wide + .card-more .card-more__box {
						padding-bottom: 95%;
					}
					.new-interface .card.card--wide .card-watched {
						display: none !important;
					}
					body.light--version .new-interface-info__body {
						position: absolute;
						z-index: 9999999;
						width: 69%;
						padding-top: 1.5em;
					}
					body.light--version .new-interface-info {
						height: 25.3em;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--wide.focus .card__view {
						animation: animation-card-focus 0.2s;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--wide.animate-trigger-enter .card__view {
						animation: animation-trigger-enter 0.2s forwards;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--small.focus .card__view {
						animation: animation-card-focus 0.2s;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--small.animate-trigger-enter .card__view {
						animation: animation-trigger-enter 0.2s forwards;
					}
					.logo-moved-head { transition: opacity 0.4s ease; }
					.logo-moved-separator { transition: opacity 0.4s ease; }
					${(Lampa.Storage.get("hide_captions", true) && !isMobile()) ? ".card:not(.card--collection) .card__age, .card:not(.card--collection) .card__title { display: none !important; }" : ""}
				</style>`;
	}

	function getSmallStyles() {
		return `<style>
					.full-start-new__reactions {  
						display: flex;  
						flex-wrap: wrap;  
						margin: -0.5em;  
						margin-bottom: 1em;  
						min-height: 3.6em;  
						align-items: center;  
					}  
					.full-start-new__reactions > div {  
						padding: 0.5em;  
					}
					.new-interface-info__head, .new-interface-info__details{ opacity: 0; transition: opacity 0.5s ease; min-height: 2.2em !important;}
					.new-interface-info__head.visible, .new-interface-info__details.visible{ opacity: 1; }
					.new-interface .card.card--wide{
						width: 18.3em;
					}
					.items-line__title .full-person__photo {
						width: 1.8em !important;
						height: 1.8em !important;
					}
					.items-line__title .full-person--svg .full-person__photo {
						padding: 0.5em !important;
						margin-right: 0.5em !important;
					}
					.items-line__title .full-person__photo {
						margin-right: 0.5em !important;
					}
					.new-interface-info {
						position: relative;
						padding: 1.5em;
						height: 19.8em;
					}
					.new-interface-info__body {
						position: absolute;
						z-index: 9999999;
						width: 80%;
						padding-top: 0.2em;
					}
					.new-interface-info__head {
						color: rgba(255, 255, 255, 0.6);
						margin-bottom: 0.3em;
						font-size: 1.2em;
						min-height: 1em;
					}
					.new-interface-info__head span {
						color: #fff;
					}
					.new-interface-info__title {
						font-size: 3em;
						font-weight: 600;
						margin-bottom: 0.2em;
						overflow: hidden;
						-o-text-overflow: '.';
						text-overflow: '.';
						display: -webkit-box;
						-webkit-line-clamp: 1;
						line-clamp: 1;
						-webkit-box-orient: vertical;
						margin-left: -0.03em;
						line-height: 1.3;
					}
					.new-interface-info__details {
						// margin-top: 1.2em;
						margin-bottom: 1.6em;
						display: flex;
						align-items: center;
						flex-wrap: wrap;
						min-height: 1.9em;
						font-size: 1.2em;
					}
					.new-interface-info__split {
						margin: 0 1em;
						font-size: 0.7em;
					}
					.new-interface-info__description {
						margin-bottom: 0.6em;
						font-size: 1.3em;
						font-weight: 310;
						line-height: 1.3;
						overflow: hidden;
						-o-text-overflow: '.';
						text-overflow: '.';
						display: -webkit-box;
						-webkit-line-clamp: 2;
						line-clamp: 2;
						-webkit-box-orient: vertical;
						width: 70%;
					}
					.new-interface .card-more__box {
						padding-bottom: 150%;
					}
					.new-interface .full-start__background-wrapper {
						position: absolute;
						top: 0;
						left: 0;
						width: 100%;
						height: 100%;
						z-index: -1;
						pointer-events: none;
					}
					.new-interface .full-start__background {
						position: absolute;
						height: 108%;
						width: 100%;
						top: -5em;
						left: 0;
						opacity: 0;
						object-fit: cover;
						transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
					}
					.new-interface .full-start__background.active {
						opacity: 0.5;
					}
					.new-interface .full-start__rate {
						font-size: 1.2em;
						margin-right: 0;
					}
					.new-interface .card__promo {
						display: none;
					}
					.new-interface .card.card--wide + .card-more .card-more__box {
						padding-bottom: 95%;
					}
					.new-interface .card.card--wide .card-watched {
						display: none !important;
					}
					body.light--version .new-interface-info__body {
						position: absolute;
						z-index: 9999999;
						width: 69%;
						padding-top: 1.5em;
					}
					body.light--version .new-interface-info {
						height: 25.3em;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--wide.focus .card__view {
						animation: animation-card-focus 0.2s;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--wide.animate-trigger-enter .card__view {
						animation: animation-trigger-enter 0.2s forwards;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--small.focus .card__view {
						animation: animation-card-focus 0.2s;
					}
					body.advanced--animation:not(.no--animation) .new-interface .card.card--small.animate-trigger-enter .card__view {
						animation: animation-trigger-enter 0.2s forwards;
					}
					.logo-moved-head { transition: opacity 0.4s ease; }
					.logo-moved-separator { transition: opacity 0.4s ease; }
					${(Lampa.Storage.get("hide_captions", true) && !isMobile()) ? ".card:not(.card--collection) .card__age, .card:not(.card--collection) .card__title { display: none !important; }" : ""}
				</style>`;
	}

	function preloadData(data, silent) {
		if (!isBackgroundPanelActive()) return;
		if (!data || !data.id) return;
		var source = data.source || "tmdb";
		if (source !== "tmdb" && source !== "cub" && source !== "NUMParser") return;

		var mediaType = data.media_type === "tv" || data.name ? "tv" : "movie";
		var language = Lampa.Storage.get("language") || "ru";
		var apiUrl = Lampa.TMDB.api(mediaType + "/" + data.id + "?api_key=" + Lampa.TMDB.key() + "&append_to_response=content_ratings,release_dates&language=" + language);

		if (!globalInfoCache[apiUrl]) {
			var network = new Lampa.Reguest();
			log("preload info: " + mediaType + "/" + data.id + " (" + (data.title || data.name || "") + ")");
			network.silent(apiUrl, function (response) {
				globalInfoCache[apiUrl] = response;
			});
		}
	}

	function preloadBackdrop(data, priority) {
		if (!isBackgroundPanelActive()) return;
		if (!Lampa.Storage.get("show_background", true)) return;
		if (!data || !data.backdrop_path) return;

		var bg_resolution = Lampa.Storage.get("background_resolution", "original");
		var url = Lampa.Api.img(data.backdrop_path, bg_resolution);
		if (!url || backdropPreloadCache[url]) return;

		var img = new Image();
		// fetchPriority нужно ставить ДО src — иначе браузер уже мог начать
		// запрос с приоритетом по умолчанию.
		if (priority) img.fetchPriority = priority;
		cacheImage(backdropPreloadCache, BACKDROP_CACHE_LIMIT, url, img, "backdrop");
		img.src = url;
		log("preload backdrop (" + bg_resolution + ", priority=" + (priority || "auto") + "): " + url);
	}

	// Логотипа нет в данных карточки — его file_path узнаём запросом к TMDB /images,
	// поэтому готовую ссылку кешируем (для фонов это не нужно: backdrop_path уже в данных).
	// Храним ВСЕ ссылки в одной записи localStorage (словарь), а не отдельным ключом на лого.
	function logoCacheMap() {
		if (!logoUrlCache) logoUrlCache = Lampa.Storage.get(LOGO_CACHE_KEY, {}) || {};
		return logoUrlCache;
	}
	function logoEntryId(data) {
		var type = data.media_type === "tv" || data.name ? "tv" : "movie";
		var language = Lampa.Storage.get("language");
		return type + "_" + data.id + "_" + language;
	}
	function getLogoEntry(data) {
		return logoCacheMap()[logoEntryId(data)];
	}
	function setLogoEntry(data, value) {
		var map = logoCacheMap();
		map[logoEntryId(data)] = value;
		Lampa.Storage.set(LOGO_CACHE_KEY, map);
	}

	// URL логотипа из кеша (или null, если нет/«none»).
	function getLogoCacheUrl(data) {
		if (!data || !data.id) return null;
		var url = getLogoEntry(data);
		return url && url !== "none" ? url : null;
	}

	// Резолв ссылки на логотип: из кеша или запросом /images (с сохранением в кеш).
	// callback(url|null). «none» в кеше → null без запроса.
	function resolveLogoUrl(data, callback) {
		if (!data || !data.id) { callback(null); return; }
		if (!Lampa.TMDB || typeof Lampa.TMDB.api !== "function" || typeof Lampa.TMDB.key !== "function") { callback(null); return; }

		var cached = getLogoEntry(data);
		if (cached === "none") { callback(null); return; }
		if (cached) { callback(cached); return; }

		var type = data.media_type === "tv" || data.name ? "tv" : "movie";
		var language = Lampa.Storage.get("language");
		var url = Lampa.TMDB.api(type + "/" + data.id + "/images?api_key=" + Lampa.TMDB.key() + "&include_image_language=" + language + ",en,null");

		$.get(url, function (data_api) {
			var final_logo = null;
			if (data_api.logos && data_api.logos.length > 0) {
				for (var i = 0; i < data_api.logos.length; i++) {
					if (data_api.logos[i].iso_639_1 == language) { final_logo = data_api.logos[i].file_path; break; }
				}
				if (!final_logo) {
					for (var j = 0; j < data_api.logos.length; j++) {
						if (data_api.logos[j].iso_639_1 == "en") { final_logo = data_api.logos[j].file_path; break; }
					}
				}
				if (!final_logo) final_logo = data_api.logos[0].file_path;
			}
			if (final_logo) {
				var img_url = Lampa.TMDB.image("/t/p/original" + final_logo.replace(".svg", ".png"));
				setLogoEntry(data, img_url);
				callback(img_url);
			} else {
				setLogoEntry(data, "none");
				callback(null);
			}
		}).fail(function () { callback(null); });
	}

	// Прогрев логотипа для видимой карточки: резолвим ссылку (с запросом /images,
	// если её ещё нет) и греем HTTP-кеш картинки — чтобы при фокусе лого появилось
	// сразу, без мелькания текста, даже если карточку ещё не открывали.
	function preloadLogo(data, priority) {
		if (!isBackgroundPanelActive()) return;
		if (!Lampa.Storage.get("logo_show", true)) return;
		if (!data || !data.id) return;
		resolveLogoUrl(data, function (url) {
			if (!url || logoPreloadCache[url]) return;
			var img = new Image();
			if (priority) img.fetchPriority = priority;
			cacheImage(logoPreloadCache, LOGO_CACHE_LIMIT, url, img, "logo");
			img.src = url;
			log("preload logo (priority=" + (priority || "auto") + "): " + url);
		});
	}

	function preloadReactions(data, silent) {
			if (!isBackgroundPanelActive()) return;
			if (!data || !data.id) return;
			if (!Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.cub) return;

			var type = data.media_type === "tv" || data.name ? "tv" : "movie";
			var cacheKey = "reactions_" + type + "_" + data.id;

			if (globalReactionsCache.hasOwnProperty(cacheKey)) return; // или !== undefined — допустимо в ES5

			log("preload reactions: " + cacheKey);
			Lampa.Api.sources.cub.reactionsGet({ method: type, id: data.id }, function (result) {
					globalReactionsCache[cacheKey] = (result && result.result) || [];
			});
	}

	var preloadTimer = null;
	function preloadAllVisibleCards() {
		if (!Lampa.Storage.get("async_load", true)) return;

		clearTimeout(preloadTimer);
		preloadTimer = setTimeout(function () {
			var layer = $(".layer--visible");
			if (!layer.length) return;

			var cards = layer.find(".card");
			var count = 0;

			cards.each(function () {
				var data = findCardData(this);
				if (data) {
					preloadData(data, true);
					preloadBackdrop(data);
					preloadLogo(data);
					if (Lampa.Storage.get("interface_card_reactions", true)) {
            preloadReactions(data, true);
        	}
					count++;
				}
			});
		}, 800);
	}

	// Прелоад бэкдропа/лого/инфо/реакций и покраска рейтинга теперь вешаются
	// прямо на жизненный цикл карточки (Lampa.Maker.map('Card')), а не через
	// MutationObserver: onVisible у Card и так срабатывает ровно один раз,
	// когда карточка попадает в зону видимости (core/layer.js, ±2 экрана) —
	// это тот же момент, ради которого раньше сканировали весь DOM.
	function patchCardMaker() {
		var cardMap = Lampa.Maker && Lampa.Maker.map("Card");
		if (!cardMap || !cardMap.Card) {
			log("Card module not found, skip patch");
			return;
		}

		function cardElement(html) {
			return html && html.get ? html.get(0) : html && html[0] ? html[0] : html;
		}

		// Приоритет прелоада относительно текущего фокуса: право в строке и
		// строка ниже — наиболее вероятные следующие шаги (высокий приоритет
		// сети), верх/лево обычно уже посещены и в HTTP-кеше (низкий), дальние
		// карточки — без явного приоритета (браузер решает сам).
		function preloadPriority(el) {
			if (!el || !el.getBoundingClientRect) return "auto";

			var focused = document.querySelector(".card.focus") || document.querySelector(".selector.focus");
			if (!focused || focused === el) return "auto";

			var f = focused.getBoundingClientRect();
			var c = el.getBoundingClientRect();
			var sameRow = Math.abs(c.top - f.top) < f.height / 2;
			var dLeft = Math.round(c.left - f.left);
			// Строка ниже — high только рядом по колонке (~2.5 ширины карточки),
			// иначе high получала бы вся строка целиком (до 12 карточек), и приоритет
			// терял бы смысл. "Право в строке" такого ограничения не имеет — там
			// карточки и так создаются Lampa почти по одной при скролле вправо.
			var near = f.width > 0 && Math.abs(dLeft) <= f.width * 2.5;

			if (sameRow && c.left > f.left) return "high"; // право в строке
			if (c.top > f.top + f.height / 2) return near ? "high" : "auto"; // строка ниже
			if (c.top < f.top - f.height / 2) return "low"; // строка выше — обычно уже в кеше
			if (sameRow && c.left < f.left) return "low"; // лево в строке — обычно уже в кеше

			return "auto";
		}

		function onCardVisible(instance) {
			var data = instance.data;
			if (!data) return;

			if (Lampa.Storage.get("async_load", true)) {
				var priority = preloadPriority(cardElement(instance.html));
				preloadData(data, true);
				preloadBackdrop(data, priority);
				preloadLogo(data, priority);
				if (Lampa.Storage.get("interface_card_reactions", true)) {
					preloadReactions(data, true);
				}
			}

			onCardColor(instance);
		}

		function onCardColor(instance) {
			var el = cardElement(instance.html);
			var voteEl = el && el.querySelector && el.querySelector(".card__vote");
			if (voteEl) applyColorByRating(voteEl);
		}

		var origVisible = cardMap.Card.onVisible;
		cardMap.Card.onVisible = function () {
			if (origVisible) origVisible.call(this);
			onCardVisible(this);
		};

		var origUpdate = cardMap.Card.onUpdate;
		cardMap.Card.onUpdate = function () {
			if (origUpdate) origUpdate.call(this);
			onCardColor(this);
		};

		log("Card module patched");
	}

	function InfoPanel() {
		this.html = null;
		this.timer = null;
		this.fadeTimer = null;
		this.network = new Lampa.Reguest();
		this.loaded = globalInfoCache;
		this.currentUrl = null;
	}

	InfoPanel.prototype.create = function () {
		this.html = $(`<div class="new-interface-info">
							<div class="new-interface-info__body">
								<div class="new-interface-info__head"></div>
								<div class="new-interface-info__title"></div>
								<div class="new-interface-info__details"></div>
								<div class="new-interface-info__description"></div>
								<div class="full-start-new__reactions"></div>
							</div>
						</div>`);
	};

	InfoPanel.prototype.render = function (asElement) {
		if (!this.html) this.create();
		return asElement ? this.html[0] : this.html;
	};

	InfoPanel.prototype.update = function (data) {
		if (!data || !this.html) return;

		this.lastRenderId = Date.now();
		var currentRenderId = this.lastRenderId;

		this.html.find(".new-interface-info__head,.new-interface-info__details").removeClass("visible");

		var title = this.html.find(".new-interface-info__title");
		var desc = this.html.find(".new-interface-info__description");

		desc.text(data.overview || Lampa.Lang.translate("full_notext"));

		clearTimeout(this.fadeTimer);

		Lampa.Background.change(Lampa.Api.img(data.backdrop_path, "original"));

		this.load(data);

		if (data && data.id && Lampa.Storage.get("interface_card_reactions", true)) {  
        this.html.find(".full-start-new__reactions").empty();  
        this.loadReactions(data);  
    } 

		if (Lampa.Storage.get("logo_show", true)) {
			// Если ссылка на лого уже в кеше — текст не показываем (иначе мелькание
			// «текст → лого»). Текст ставим как фолбэк, но скрытым; showLogo раскроет
			// лого, когда байты загрузятся (мгновенно, если уже в HTTP-кеше).
			var cachedLogo = getLogoCacheUrl(data);
			title.text(data.title || data.name || "");
			title.css({ opacity: cachedLogo ? "0" : "1", transition: "none" });
			this.showLogo(data, currentRenderId);
		} else {
			title.text(data.title || data.name || "");
			title.css({ opacity: 1 });
		}
	};

	InfoPanel.prototype.showLogo = function (data, renderId) {
		var _this = this;

		var FADE_OUT_TEXT = 300;
		var MORPH_HEIGHT = 400;
		var FADE_IN_IMG = 400;
		var TARGET_WIDTH = "7em";
		var PADDING_TOP_EM = 0;
		var PADDING_BOTTOM_EM = 0.2;

		var title_elem = this.html.find(".new-interface-info__title");
		var head_elem = this.html.find(".new-interface-info__head");
		var details_elem = this.html.find(".new-interface-info__details");
		var dom_title = title_elem[0];

		function animateHeight(element, start, end, duration, callback) {
			var startTime = null;
			function step(timestamp) {
				if (!startTime) startTime = timestamp;
				var progress = timestamp - startTime;
				var percent = Math.min(progress / duration, 1);
				var ease = 1 - Math.pow(1 - percent, 3);
				element.style.height = start + (end - start) * ease + "px";
				if (progress < duration) {
					requestAnimationFrame(step);
				} else {
					if (callback) callback();
				}
			}
			requestAnimationFrame(step);
		}

		function animateOpacity(element, start, end, duration, callback) {
			var startTime = null;
			function step(timestamp) {
				if (!startTime) startTime = timestamp;
				var progress = timestamp - startTime;
				var percent = Math.min(progress / duration, 1);
				var ease = 1 - Math.pow(1 - percent, 3);
				element.style.opacity = start + (end - start) * ease;
				if (progress < duration) {
					requestAnimationFrame(step);
				} else {
					if (callback) callback();
				}
			}
			requestAnimationFrame(step);
		}

		function applyFinalStyles(img, text_height) {
			img.style.marginTop = "0";
			img.style.marginLeft = "0";
			img.style.paddingTop = PADDING_TOP_EM + "em";
			img.style.paddingBottom = PADDING_BOTTOM_EM + "em";

			img.style.imageRendering = "-webkit-optimize-contrast";

			if (text_height) {
				img.style.height = text_height + "px";
				img.style.width = "auto";
				img.style.maxWidth = "100%";
				img.style.maxHeight = "none";
			} else if (window.innerWidth < 768) {
				img.style.width = "100%";
				img.style.height = "auto";
				img.style.maxWidth = "100%";
				img.style.maxHeight = "none";
			} else {
				img.style.width = TARGET_WIDTH;
				img.style.height = "auto";
				img.style.maxHeight = "none";
				img.style.maxWidth = "100%";
			}

			img.style.boxSizing = "border-box";
			img.style.display = "block";
			img.style.objectFit = "contain";
			img.style.objectPosition = "left bottom";
			img.style.transition = "none";
		}

		function moveHeadToDetails(animate) {
			if (!head_elem.length || !details_elem.length) return;
			if (details_elem.find(".logo-moved-head").length > 0) return;

			var content = head_elem.html();
			if (!content || content.trim() === "") return;

			var new_item = $('<span class="logo-moved-head">' + content + "</span>");
			var separator = $('<span class="new-interface-info__split logo-moved-separator">●</span>');

			if (animate) {
				new_item.css({ opacity: 0, transition: "none" });
				separator.css({ opacity: 0, transition: "none" });
			}

			if (details_elem.children().length > 0) details_elem.append(separator);
			details_elem.append(new_item);

			if (animate) {
				head_elem.css({
					transition: "opacity " + FADE_OUT_TEXT / 1000 + "s ease",
					opacity: "0",
				});

				setTimeout(function () {
					new_item.css({ transition: "opacity " + FADE_IN_IMG / 1000 + "s ease", opacity: "1" });
					separator.css({ transition: "opacity " + FADE_IN_IMG / 1000 + "s ease", opacity: "1" });
				}, FADE_OUT_TEXT);
			} else {
				head_elem.css({ opacity: "0", transition: "none" });
			}
		}

		function startLogoAnimation(img_url, fromCache) {
			if (renderId && renderId !== _this.lastRenderId) return;

			var img = new Image();
			img.src = img_url;

			var start_text_height = 0;
			if (dom_title) start_text_height = dom_title.getBoundingClientRect().height;

			if (fromCache) {
				if (dom_title) start_text_height = dom_title.getBoundingClientRect().height;

				moveHeadToDetails(false);
				applyFinalStyles(img, start_text_height);

				title_elem.empty().append(img);
				title_elem.css({ opacity: "1", transition: "none" });

				if (dom_title) {
					dom_title.style.display = "block";
					dom_title.style.height = "";
					dom_title.style.transition = "none";
				}
				img.style.opacity = "1";
				return;
			}

			applyFinalStyles(img, start_text_height);
			img.style.opacity = "0";

			img.onload = function () {
				if (renderId && renderId !== _this.lastRenderId) return;

				setTimeout(function () {
					if (renderId && renderId !== _this.lastRenderId) return;

					if (dom_title) start_text_height = dom_title.getBoundingClientRect().height;

					moveHeadToDetails(true);

					title_elem.css({
						transition: "opacity " + FADE_OUT_TEXT / 1000 + "s ease",
						opacity: "0",
					});

					setTimeout(function () {
						if (renderId && renderId !== _this.lastRenderId) return;

						title_elem.empty();
						title_elem.append(img);
						title_elem.css({ opacity: "1", transition: "none" });

						var target_container_height = dom_title.getBoundingClientRect().height;

						dom_title.style.height = start_text_height + "px";
						dom_title.style.display = "block";
						dom_title.style.overflow = "hidden";
						dom_title.style.boxSizing = "border-box";

						void dom_title.offsetHeight;

						dom_title.style.transition = "height " + MORPH_HEIGHT / 1000 + "s cubic-bezier(0.4, 0, 0.2, 1)";

						requestAnimationFrame(function () {
							if (renderId && renderId !== _this.lastRenderId) return;
							dom_title.style.height = target_container_height + "px";

							setTimeout(
								function () {
									if (renderId && renderId !== _this.lastRenderId) return;
									img.style.transition = "opacity " + FADE_IN_IMG / 1000 + "s ease";
									img.style.opacity = "1";
								},
								Math.max(0, MORPH_HEIGHT - 100),
							);

							setTimeout(
								function () {
									if (renderId && renderId !== _this.lastRenderId) return;
									applyFinalStyles(img, start_text_height);
									dom_title.style.height = "";
								},
								MORPH_HEIGHT + FADE_IN_IMG + 50,
							);
						});
					}, FADE_OUT_TEXT);
				}, 200);
			};

			img.onerror = function () {
				title_elem.css({ opacity: "1", transition: "none" });
			};
		}

		if (data.id) {
			var cached_url = getLogoEntry(data);

			if (cached_url && cached_url !== "none") {
				// Ссылка готова: раскрываем лого только когда байты реально загружены —
				// если уже в HTTP-кеше (img.complete) мгновенно, иначе по onload.
				// Так нет мелькания пустого/текста до появления картинки.
				var img_cache = new Image();
				var revealed = false;

				var reveal = function () {
					if (revealed) return;
					revealed = true;
					if (renderId && renderId !== _this.lastRenderId) return;
					startLogoAnimation(cached_url, true);
				};

				img_cache.onload = reveal;
				img_cache.onerror = function () {
					if (revealed) return;
					revealed = true;
					if (renderId && renderId !== _this.lastRenderId) return;
					// Битый кеш — откатываемся на текст и сбрасываем, чтобы перезапросить
					title_elem.text(data.title || data.name || "");
					title_elem.css({ opacity: "1", transition: "none" });
					setLogoEntry(data, "none");
				};

				img_cache.src = cached_url;
				if (img_cache.complete && img_cache.naturalWidth > 0) reveal();
			} else if (cached_url === "none") {
				// Лого у карточки нет — оставляем текст
				title_elem.css({ opacity: "1", transition: "none" });
			} else {
				// Ссылки ещё нет — резолвим (/images) и морфим текст в лого
				resolveLogoUrl(data, function (img_url) {
					if (renderId && renderId !== _this.lastRenderId) return;
					if (img_url) startLogoAnimation(img_url, false);
					else title_elem.css({ opacity: "1", transition: "none" });
				});
			}
		}
	};

	InfoPanel.prototype.load = function (data) {
		if (!data || !data.id) return;

		var source = data.source || "tmdb";
		if (source !== "tmdb" && source !== "cub" && source !== "NUMParser") return;

		if (!Lampa.TMDB || typeof Lampa.TMDB.api !== "function" || typeof Lampa.TMDB.key !== "function") return;

		var mediaType = data.media_type === "tv" || data.name ? "tv" : "movie";
		var language = Lampa.Storage.get("language");
		var apiUrl = Lampa.TMDB.api(mediaType + "/" + data.id + "?api_key=" + Lampa.TMDB.key() + "&append_to_response=content_ratings,release_dates&language=" + language);

		this.currentUrl = apiUrl;

		if (this.loaded[apiUrl]) {
			this.draw(this.loaded[apiUrl]);
			return;
		}

		clearTimeout(this.timer);
		var self = this;

		this.timer = setTimeout(function () {
			self.network.clear();
			self.network.timeout(5000);
			self.network.silent(apiUrl, function (response) {
				self.loaded[apiUrl] = response;
				if (self.currentUrl === apiUrl) {
					self.draw(response);
				}
			});
		}, 300);

		// Загрузка реакций  
    if (data && data.id && Lampa.Storage.get("interface_card_reactions", true)) {  
        this.loadReactions(data);  
    } 
	};


InfoPanel.prototype.loadReactions = function (data) {
    var self = this;
    var type = data.media_type === "tv" || data.name ? "tv" : "movie";
    var renderId = this.lastRenderId;  
		var cacheKey = "reactions_" + type + "_" + data.id;
    var cached = globalReactionsCache[cacheKey];

		if (cached !== undefined) {
        this.drawReactions(cached);
        return;
    }
      
    if (Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.cub) {  
        Lampa.Api.sources.cub.reactionsGet({  
            method: type,  
            id: data.id  
        }, function (result) {  
            // Проверяем, что это всё ещё актуальный рендер  
            if (renderId === self.lastRenderId && result && result.result) {  
                self.drawReactions(result.result);  
            }  
        });  
    }  
};

InfoPanel.prototype.drawReactions = function (reactions) {  
    var self = this;  
    var reactionsBody = this.html.find(".full-start-new__reactions")[0];  
      
    if (!reactionsBody) return;  
      
    if (reactions && reactions.length > 0) {  
        // Сортируем реакции по количеству  
        reactions.sort(function(a, b) {  
            return a.counter > b.counter ? -1 : a.counter < b.counter ? 1 : 0;  
        });  
          
        $(reactionsBody).empty();  
          
        reactions.forEach(function(r) {  
            var reaction = document.createElement('div');  
            var icon = document.createElement('img');  
            var count = document.createElement('div');  
            var wrap = document.createElement('div');  
              
            reaction.className = 'reaction';  
            icon.className = 'reaction__icon';  
            count.className = 'reaction__count';  
              
            reaction.classList.add('reaction--' + r.type);  
            count.textContent = Lampa.Utils.bigNumberToShort(r.counter);  
              
            icon.src = Lampa.Utils.protocol() + Lampa.Manifest.cub_domain + '/img/reactions/' + r.type + '.svg';  
              
            reaction.appendChild(icon);  
            reaction.appendChild(count);  
            wrap.appendChild(reaction);  
              
            $(reactionsBody).append(wrap);  
        });  
    } else {  
        $(reactionsBody).html('<div>' + Lampa.Lang.translate("reactions_none") + '</div>');  
    }  
};

	InfoPanel.prototype.draw = function (data) {
		if (!data || !this.html) return;

		if (data.overview) {
			this.html.find(".new-interface-info__description").text(data.overview);
		}

		var year = ((data.release_date || data.first_air_date || "0000") + "").slice(0, 4);

		var rating = parseFloat((data.vote_average || 0) + "").toFixed(1);

		var headInfo = [];
		var detailsInfo = [];

		var countries = Lampa.Api.sources.tmdb.parseCountries(data);
		if (countries.length > 2) countries = countries.slice(0, 2);

		var ageRating = Lampa.Api.sources.tmdb.parsePG(data);

		var show_logo = Lampa.Storage.get("logo_show", true);

		if (Lampa.Storage.get("rat") !== false) {
			if (rating > 0) {
				var rate_style = "";

				if (Lampa.Storage.get("colored_ratings", true)) {
					var vote_num = parseFloat(rating);
					var color = "";

					if (vote_num >= 0 && vote_num <= 3) {
						color = "red";
					} else if (vote_num > 3 && vote_num < 6) {
						color = "orange";
					} else if (vote_num >= 6 && vote_num < 7) {
						color = "cornflowerblue";
					} else if (vote_num >= 7 && vote_num < 8) {
						color = "darkmagenta";
					} else if (vote_num >= 8 && vote_num <= 10) {
						color = "lawngreen";
					}

					if (color) rate_style = ' style="color: ' + color + '"';
				}

				detailsInfo.push('<div class="full-start__rate"' + rate_style + "><div>" + rating + "</div><div>TMDB</div></div>");
			}
		}

		if (Lampa.Storage.get("ganr") !== false) {
			if (data.genres && data.genres.length > 0) {
				detailsInfo.push(
					data.genres
						.slice(0, 2)
						.map(function (genre) {
							return Lampa.Utils.capitalizeFirstLetter(genre.name);
						})
						.join(" | "),
				);
			}
		}

		if (Lampa.Storage.get("vremya") !== false) {
			if (data.runtime) {
				detailsInfo.push(Lampa.Utils.secondsToTime(data.runtime * 60, true));
			}
		}

		if (Lampa.Storage.get("seas", false) && data.number_of_seasons) {
			detailsInfo.push('<span class="full-start__pg" style="font-size: 0.9em;">Сезонов ' + data.number_of_seasons + "</span>");
		}

		if (Lampa.Storage.get("eps", false) && data.number_of_episodes) {
			detailsInfo.push('<span class="full-start__pg" style="font-size: 0.9em;">Эпизодов ' + data.number_of_episodes + "</span>");
		}

		if (Lampa.Storage.get("year_ogr") !== false) {
			if (ageRating) {
				detailsInfo.push('<span class="full-start__pg" style="font-size: 0.9em;">' + ageRating + "</span>");
			}
		}

		if (Lampa.Storage.get("status") !== false) {
			var statusText = "";

			if (data.status) {
				switch (data.status.toLowerCase()) {
					case "released":
						statusText = "Выпущенный";
						break;
					case "ended":
						statusText = "Закончен";
						break;
					case "returning series":
						statusText = "Онгоинг";
						break;
					case "canceled":
						statusText = "Отменено";
						break;
					case "post production":
						statusText = "Скоро";
						break;
					case "planned":
						statusText = "Запланировано";
						break;
					case "in production":
						statusText = "В производстве";
						break;
					default:
						statusText = data.status;
						break;
				}
			}

			if (statusText) {
				detailsInfo.push('<span class="full-start__status" style="font-size: 0.9em;">' + statusText + "</span>");
			}
		}

		var yc = [];
		if (year !== "0000") yc.push("<span>" + year + "</span>");
		if (countries.length > 0) yc.push(countries.join(", "));

		if (yc.length > 0) {
			detailsInfo.push(yc.join(", "));
		}

		this.html
			.find(".new-interface-info__head")
			.empty()
			.append(headInfo.join(", "))
			.toggleClass("visible", headInfo.length > 0);
		this.html.find(".new-interface-info__details").html(detailsInfo.join('<span class="new-interface-info__split">&#9679;</span>')).addClass("visible");
	};

	InfoPanel.prototype.empty = function () {
		if (!this.html) return;
		this.html.find(".new-interface-info__head,.new-interface-info__details").text("").removeClass("visible");
	};

	InfoPanel.prototype.destroy = function () {
		clearTimeout(this.fadeTimer);
		clearTimeout(this.timer);
		this.network.clear();
		this.currentUrl = null;

		if (this.html) {
			this.html.remove();
			this.html = null;
		}
	};

	function getColorByRating(vote) {
		if (isNaN(vote)) return "";
		if (vote >= 0 && vote <= 3) return "red";
		if (vote > 3 && vote < 6) return "orange";
		if (vote >= 6 && vote < 7) return "cornflowerblue";
		if (vote >= 7 && vote < 8) return "darkmagenta";
		if (vote >= 8 && vote <= 10) return "lawngreen";
		return "";
	}

	function applyColorByRating(element) {
		var $el = $(element);
		var voteText = $el.text().trim();

		if (/^\d+(\.\d+)?K$/.test(voteText)) return;

		var match = voteText.match(/(\d+(\.\d+)?)/);
		if (!match) return;

		var vote = parseFloat(match[0]);
		var color = getColorByRating(vote);

		if (color && Lampa.Storage.get("colored_ratings", true)) {
			$el.css("color", color);

			// Применяем обводку только к элементам страницы деталей, исключая карточки
			if (Lampa.Storage.get("rating_border", false) && !$el.hasClass("card__vote")) {
				// Для элементов типа .rate--kp, .rate--imdb, .rate--cub применяем обводку только к родителю
				if ($el.parent().hasClass("full-start__rate")) {
					$el.parent().css("border", "1px solid " + color);
					$el.css("border", "");
				} else if ($el.hasClass("full-start__rate") || $el.hasClass("full-start-new__rate") || $el.hasClass("info__rate")) {
					$el.css("border", "1px solid " + color);
				} else {
					$el.css("border", "");
				}
			} else {
				$el.css("border", "");
				if ($el.parent().hasClass("full-start__rate")) {
					$el.parent().css("border", "");
				}
			}
		} else {
			$el.css("color", "");
			$el.css("border", "");
			if ($el.parent().hasClass("full-start__rate")) {
				$el.parent().css("border", "");
			}
		}
	}

	function updateVoteColors() {
		if (!Lampa.Storage.get("colored_ratings", true)) return;

		$(".card__vote").each(function () {
			applyColorByRating(this);
		});

		$(".full-start__rate, .full-start-new__rate").each(function () {
			applyColorByRating(this);
		});

		$(".info__rate, .card__imdb-rate, .card__kinopoisk-rate").each(function () {
			applyColorByRating(this);
		});

		$(".rate--kp, .rate--imdb, .rate--cub").each(function () {
			applyColorByRating($(this).find("> div").eq(0));
		});
	}

	function setupVoteColorsForDetailPage() {
		if (!window.Lampa || !Lampa.Listener) return;

		// Раньше это покрывал MutationObserver на весь document.body.
		// .card__vote теперь красится через patchCardMaker (onVisible/onUpdate);
		// эти точки — подстраховка для значков, которые добавляют другие
		// плагины после рендера карточки (.card__imdb-rate/.card__kinopoisk-rate),
		// и для рейтингов на странице «Подробнее» (full-start__rate и т.п.).
		Lampa.Listener.follow("full", function (data) {
			if (data.type === "complite") {
				updateVoteColors();
			}
		});

		Lampa.Listener.follow("activity", function (e) {
			if (e.type === "active" || e.type === "start") {
				setTimeout(updateVoteColors, 1000);
			}
		});

		Lampa.Listener.follow("target", function (e) {
			if (e.target && $(e.target).hasClass("card")) {
				updateVoteColors();
			}
		});
	}

	function initializeSettings() {
		Lampa.Settings.listener.follow("open", function (event) {
			if (event.name == "main") {
				if (Lampa.Settings.main().render().find('[data-component="style_interface"]').length == 0) {
					Lampa.SettingsApi.addComponent({
						component: "style_interface",
						name: "Стильный интерфейс",
					});
				}

				Lampa.Settings.main().update();
				Lampa.Settings.main().render().find('[data-component="style_interface"]').addClass("hide");
			}
		});

		Lampa.SettingsApi.addParam({
			component: "interface",
			param: {
				name: "style_interface",
				type: "static",
				default: true,
			},
			field: {
				name: "Стильный интерфейс",
				description: "Настройки элементов",
			},
			onRender: function (item) {
				item.css("opacity", "0");
				requestAnimationFrame(function () {
					item.insertAfter($('div[data-name="interface_size"]'));
					item.css("opacity", "");
				});

				item.on("hover:enter", function () {
					Lampa.Settings.create("style_interface");
					Lampa.Controller.enabled().controller.back = function () {
						Lampa.Settings.create("interface");
					};
				});
			},
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "logo_show", type: "trigger", default: true },
			field: { name: "Показывать логотип вместо названия" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "show_background", type: "trigger", default: true },
			field: { name: "Отображать постеры на фоне" },
			onChange: function (value) {
				if (!value) {
					$(".full-start__background").removeClass("active");
				}
			},
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "status", type: "trigger", default: true },
			field: { name: "Показывать статус фильма/сериала" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "seas", type: "trigger", default: false },
			field: { name: "Показывать количество сезонов" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "eps", type: "trigger", default: false },
			field: { name: "Показывать количество эпизодов" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "year_ogr", type: "trigger", default: true },
			field: { name: "Показывать возрастное ограничение" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "vremya", type: "trigger", default: true },
			field: { name: "Показывать время фильма" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "ganr", type: "trigger", default: true },
			field: { name: "Показывать жанр фильма" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "rat", type: "trigger", default: true },
			field: { name: "Показывать рейтинг фильма" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "colored_ratings", type: "trigger", default: true },
			field: { name: "Цветные рейтинги" },
			onChange: function (value) {
				if (value) {
					updateVoteColors();
				} else {
					$(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate").css("color", "").css("border", "");
					$(".full-start__rate").css("border", "");
				}
			},
		});

		Lampa.SettingsApi.addParam({  
			component: "style_interface",  
			param: { name: "interface_card_reactions", type: "trigger", default: true },  
			field: { name: "Показать реакции" },  
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "rating_border", type: "trigger", default: false },
			field: { name: "Обводка рейтингов" },
			onChange: function (value) {
				updateVoteColors();
			},
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "async_load", type: "trigger", default: true },
			field: { name: "Включить асинхронную загрузку данных" },
			onChange: function (value) {
				if (value) preloadAllVisibleCards();
			},
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "background_resolution", type: "select", default: "original", values: { w300: "w300", w780: "w780", w1280: "w1280", original: "original" } },
			field: { name: "Разрешение фона", description: "Качество загружаемых фоновых изображений" },
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "hide_captions", type: "trigger", default: true },
			field: { name: "Скрывать названия и год", description: "Лампа будет перезагружена" },
			onChange: function () {
				window.location.reload();
			},
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "wide_post", type: "trigger", default: false },
			field: { name: "Широкие постеры", description: "Лампа будет перезагружена" },
			onChange: function () {
				window.location.reload();
			},
		});

		Lampa.SettingsApi.addParam({
			component: "style_interface",
			param: { name: "int_clear_logo_cache", type: "static" },
			field: { name: "Очистить кеш логотипов", description: "Лампа будет перезагружена" },
			onRender: function (item) {
				item.on("hover:enter", function () {
					Lampa.Select.show({
						title: "Очистить кеш логотипов?",
						items: [{ title: "Да", confirm: true }, { title: "Нет" }],
						onSelect: function (a) {
							if (a.confirm) {
								// Единый словарь
								logoUrlCache = {};
								localStorage.removeItem(LOGO_CACHE_KEY);
								// Подчистим старые рассыпанные ключи (миграция со старой схемы)
								var keys = [];
								for (var i = 0; i < localStorage.length; i++) {
									var key = localStorage.key(i);
									if (key && key.indexOf("logo_cache_v2_") !== -1) {
										keys.push(key);
									}
								}
								keys.forEach(function (key) {
									localStorage.removeItem(key);
								});
								window.location.reload();
							} else {
								Lampa.Controller.toggle("settings_component");
							}
						},
						onBack: function () {
							Lampa.Controller.toggle("settings_component");
						},
					});
				});
			},
		});

		var initInterval = setInterval(function () {
			if (typeof Lampa !== "undefined") {
				clearInterval(initInterval);
				if (!Lampa.Storage.get("int_plug", false)) {
					setDefaultSettings();
				}
			}
		}, 200);

		function setDefaultSettings() {
			Lampa.Storage.set("int_plug", "true");
			Lampa.Storage.set("wide_post", "false");
			Lampa.Storage.set("logo_show", "true");
			Lampa.Storage.set("show_background", "true");
			Lampa.Storage.set("background_resolution", "original");
			Lampa.Storage.set("status", "true");
			Lampa.Storage.set("seas", "false");
			Lampa.Storage.set("eps", "false");
			Lampa.Storage.set("year_ogr", "true");
			Lampa.Storage.set("vremya", "true");
			Lampa.Storage.set("ganr", "true");
			Lampa.Storage.set("rat", "true");
			Lampa.Storage.set("colored_ratings", "true");
			Lampa.Storage.set("async_load", "true");
			Lampa.Storage.set("hide_captions", "true");
			Lampa.Storage.set("rating_border", "false");
			Lampa.Storage.set("interface_size", "small");
		}
	}
})();