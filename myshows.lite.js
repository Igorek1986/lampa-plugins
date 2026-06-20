(function() {
    "use strict";
    var DEFAULT_ADD_THRESHOLD = "0";
    var DEFAULT_MIN_PROGRESS = 90;
    var API_URL = "https://myshows.me/v3/rpc/";
    var MAP_KEY = "myshows_hash_map";
    var MYSHOWS_AUTH_PROXY = function() {
        var scriptUrl = document.currentScript && document.currentScript.src || "";
        var params = new URLSearchParams(scriptUrl.split("?")[1]);
        return params.get("auth_proxy") || "https://myshows.igorek1986.ru/myshows/auth";
    }();
    var DEFAULT_CACHE_DAYS = 30;
    var JSON_HEADERS = {
        "Content-Type": "application/json"
    };
    var AUTHORIZATION = "authorization2";
    var syncInProgress = false;
    var checkedEpisodes = {};
    var checkedMovies = {};
    var _unwatchedEpisodeIds = {};
    var _unwatchedEpisodeIdsReady = false;
    var _unwatchedEpisodeIdsProfile = null;
    var cardStatusCache = {};
    function cardStatusKey(tmdbId, isMovie) {
        return (tmdbId ? String(tmdbId) : "0") + ":" + (isMovie ? "movie" : "tv");
    }
    function setCardStatusCache(tmdbId, isMovie, status) {
        if (!tmdbId || !status) return;
        cardStatusCache[cardStatusKey(tmdbId, isMovie)] = status;
    }
    function getCardStatusCache(tmdbId, isMovie) {
        return cardStatusCache[cardStatusKey(tmdbId, isMovie)] || null;
    }
    var watchingTransitionInFlight = {};
    function ensureWatchingStatus(card, reason, callback) {
        var key = card && card.id ? String(card.id) : "";
        if (getCardStatusCache(card.id, false) === "watching") {
            if (callback) callback(false);
            return;
        }
        if (watchingTransitionInFlight[key]) {
            if (callback) callback(false);
            return;
        }
        watchingTransitionInFlight[key] = true;
        setMyShowsStatus(card, "watching", function(success) {
            watchingTransitionInFlight[key] = false;
            if (success) setCardStatusCache(card.id, false, "watching");
            if (callback) callback(success);
        });
    }
    var myshows_icon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="12" rx="3" style="fill:none;stroke:currentColor;stroke-width:2"/><line x1="12" y1="5" x2="7" y2="1" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"/><line x1="12" y1="5" x2="17" y2="1" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"/><circle cx="12" cy="6" r="1" style="fill:currentColor;stroke:none"/></svg>';
    var watch_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var later_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>';
    var remove_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';
    var cancelled_icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" fill="currentColor"/></svg>';
    var IS_LAMPAC = null;
    function isNpConnected() {
        return !!window.IS_NP;
    }
    var EPISODES_CACHE = {};
    var _profileRenderToken = 0;
    function getNpBaseUrl() {
        return Lampa.Storage.get("base_url_numparser", "");
    }
    function getNpToken() {
        return Lampa.Storage.get("numparser_api_key", "");
    }
    function createLogMethod(emoji, consoleMethod) {
        var DEBUG = Lampa.Storage.get("myshows_debug_mode", false);
        if (!DEBUG) return function() {};
        return function() {
            var args = Array.prototype.slice.call(arguments);
            if (emoji) args.unshift(emoji);
            args.unshift("MyShows");
            consoleMethod.apply(console, args);
        };
    }
    var Log = {
        info: createLogMethod("ℹ️", console.log),
        error: createLogMethod("❌", console.error),
        warn: createLogMethod("⚠️", console.warn),
        debug: createLogMethod("🐛", console.debug)
    };
    function accountUrl(url) {
        url += "";
        if (url.indexOf("uid=") == -1) {
            var uid = Lampa.Storage.get("account_email") || Lampa.Storage.get("lampac_unic_id");
            if (uid) url = Lampa.Utils.addUrlComponent(url, "uid=" + encodeURIComponent(uid));
        }
        return url;
    }
    function padTwo(n) {
        return ("0" + n).slice(-2);
    }
    function cleanTitle(title) {
        if (!title) return "";
        return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
    }
    function extractYear(data) {
        if (!data) return "";
        if (data.release_year && data.release_year !== "0000") return String(data.release_year).slice(0, 4);
        var date = (data.first_air_date || data.release_date || data.birthday || "") + "";
        return date ? date.slice(0, 4) : "";
    }
    function findByName(arr, name) {
        if (!arr || !name) return null;
        var lower = name.toLowerCase();
        for (var i = 0; i < arr.length; i++) {
            var item = arr[i];
            var n1 = (item.original_name || item.name || item.title || "").toLowerCase();
            var n2 = (item.titleOriginal || "").toLowerCase();
            if (n1 === lower || n2 === lower) return item;
        }
        return null;
    }
    function matchShowInArray(arr, card) {
        if (!arr || !card) return null;
        var tmdbId = card.id ? String(card.id) : "";
        var msId = card.myshowsId ? String(card.myshowsId) : "";
        var name = (card.original_name || card.name || card.original_title || card.title || "").toLowerCase();
        var year = extractYear(card);
        var i, it;
        if (tmdbId) for (i = 0; i < arr.length; i++) if (arr[i].id && String(arr[i].id) === tmdbId) return arr[i];
        if (msId) for (i = 0; i < arr.length; i++) if (arr[i].myshowsId && String(arr[i].myshowsId) === msId) return arr[i];
        if (name && year) for (i = 0; i < arr.length; i++) {
            it = arr[i];
            var n = (it.original_name || it.name || it.title || it.titleOriginal || "").toLowerCase();
            if (n !== name) continue;
            var iy = extractYear(it);
            if (iy && Math.abs(parseInt(iy) - parseInt(year)) <= 1) return it;
        }
        if (!tmdbId && !msId && !year) return findByName(arr, name);
        return null;
    }
    function findShowInCache(cacheType, arrayKey, nameOrId, callback, card) {
        loadCacheFromServer(cacheType, arrayKey, function(result) {
            var arr = result && result[arrayKey];
            if (!arr) {
                callback(null);
                return;
            }
            if (cacheType === "unwatched_serials") arr.forEach(function(s) {
                if (s && s.remaining === void 0 && s.unwatched_count !== void 0) s.remaining = s.unwatched_count;
            });
            if (card) {
                callback(matchShowInArray(arr, card));
                return;
            }
            var found = null;
            for (var i = 0; i < arr.length; i++) if (arr[i].myshowsId && String(arr[i].myshowsId) === String(nameOrId)) {
                found = arr[i];
                break;
            }
            if (!found) found = findByName(arr, nameOrId);
            callback(found);
        });
    }
    function getProfileId() {
        if (window.profiles_plugin) {
            var profileId = Lampa.Storage.get("lampac_profile_id", "");
            if (profileId) return String(profileId);
        }
        try {
            if (Lampa.Account.Permit.account && Lampa.Account.Permit.account.profile && Lampa.Account.Permit.account.profile.id) return String(Lampa.Account.Permit.account.profile.id);
        } catch (e) {}
        return "";
    }
    function getStorageMode() {
        var useNp = getProfileSetting("myshows_use_np", false);
        var npEnabled = useNp === true || useNp === "true";
        if (npEnabled && isNpConnected()) return "np";
        if (IS_LAMPAC) return "lampac";
        return "local";
    }
    function useNpServer() {
        return getStorageMode() === "np";
    }
    function saveCacheToServer(cacheData, path, callback, profileId) {
        var mode = getStorageMode();
        if (profileId === void 0 || profileId === null) profileId = getProfileId();
        var NP_PATHS = {
            unwatched_serials: "/myshows/watching",
            watchlist: "/myshows/watchlist",
            watched: "/myshows/watched",
            cancelled: "/myshows/cancelled",
            serial_status: "/myshows/serial_status",
            movie_status: "/myshows/movie_status",
            timetable_extra: "/myshows/profile_shows"
        };
        if (mode === "np") {
            if (!NP_PATHS[path]) {
                if (callback) callback(true);
                return;
            }
            var payload = [];
            if (path === "serial_status" || path === "movie_status") {
                var tvStatusMap = {
                    watching: "watching",
                    later: "watchlist",
                    cancelled: "cancelled"
                };
                var movieStatusMap = {
                    finished: "watched",
                    later: "watchlist"
                };
                var statusMap = path === "serial_status" ? tvStatusMap : movieStatusMap;
                var rawItems = cacheData && cacheData.shows ? cacheData.shows : cacheData && cacheData.movies ? cacheData.movies : [];
                for (var i = 0; i < rawItems.length; i++) {
                    var s = rawItems[i];
                    var cacheType = statusMap[s.watchStatus];
                    if (!s.id || !cacheType) continue;
                    payload.push({
                        myshows_id: s.id,
                        cache_type: cacheType
                    });
                }
            } else {
                var items = cacheData && cacheData.shows ? cacheData.shows : cacheData && cacheData.results ? cacheData.results : [];
                for (var i = 0; i < items.length; i++) {
                    var s = items[i];
                    var tmdbId = s.id || s.tmdb_id;
                    var myshowsId = s.myshowsId || s.myshows_id;
                    if (!tmdbId || !myshowsId) continue;
                    var entry = {
                        myshows_id: myshowsId,
                        tmdb_id: tmdbId,
                        media_type: s.media_type || (s.type === "movie" ? "movie" : "tv")
                    };
                    if (path === "unwatched_serials") {
                        entry.unwatched_count = s.remaining || s.unwatched_count || 0;
                        entry.next_episode = s.next_episode || null;
                        entry.progress_marker = s.progress_marker || null;
                        entry.unwatched_episodes = [];
                        if (s.unwatchedEpisodes && s.unwatchedEpisodes.length) for (var ue = 0; ue < s.unwatchedEpisodes.length; ue++) {
                            var ueid = s.unwatchedEpisodes[ue] && s.unwatchedEpisodes[ue].id;
                            if (ueid) entry.unwatched_episodes.push(parseInt(ueid));
                        }
                    }
                    payload.push(entry);
                }
            }
            var npUrl = getNpBaseUrl() + NP_PATHS[path] + "?token=" + encodeURIComponent(getNpToken()) + "&profile_id=" + encodeURIComponent(profileId);
            var xhr = new XMLHttpRequest;
            xhr.open("POST", npUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = function() {
                try {
                    if (callback) callback(JSON.parse(xhr.responseText) || true);
                } catch (e) {
                    if (callback) callback(true);
                }
            };
            xhr.onerror = function() {
                if (callback) callback(false);
            };
            xhr.send(JSON.stringify(payload));
            return;
        }
        try {
            var data = JSON.stringify(cacheData, null, 2);
            var uri = accountUrl("/storage/set?path=myshows/" + path + "&pathfile=" + profileId);
            if (Lampa.Platform.is("android") && !/^https?:\/\//i.test(uri)) uri = window.location.origin + (uri.indexOf("/") === 0 ? uri : "/" + uri);
            if (mode === "local") {
                Lampa.Storage.set(profileKeyFor("myshows_" + path, profileId), cacheData);
                if (callback) callback(true);
            } else {
                var network = new Lampa.Reguest;
                network.native(uri, function(response) {
                    if (response.success) {
                        if (callback) callback(true);
                    } else {
                        response.msg;
                        if (callback) callback(false);
                    }
                }, function(error) {
                    if (callback) callback(false);
                }, data, {
                    headers: JSON_HEADERS,
                    method: "POST"
                });
            }
        } catch (e) {
            e.message;
            if (callback) callback(false);
        }
    }
    var _SERVER_CACHE_VERSION = 2;
    var _SERVER_CACHE_VER_KEY = "myshows_server_cache_ver";
    var _SERVER_CACHE_PATHS = [ "unwatched_serials", "serial_status", "movie_status", "watchlist", "watched", "cancelled" ];
    function _checkServerCacheVersion() {
        var stored = parseInt(Lampa.Storage.get(_SERVER_CACHE_VER_KEY) || "0");
        if (stored === _SERVER_CACHE_VERSION) return true;
        _SERVER_CACHE_PATHS.forEach(function(p) {
            setProfileSetting("myshows_" + p, null, false);
        });
        Lampa.Storage.set(_SERVER_CACHE_VER_KEY, _SERVER_CACHE_VERSION);
        Lampa.Storage.set("myshows_tmdb_cards", {});
        return false;
    }
    function isNpConfigured() {
        var useNp = getProfileSetting("myshows_use_np", false);
        var npEnabled = useNp === true || useNp === "true";
        return npEnabled && !!getProfileSetting("myshows_token") && !!getNpToken() && !!getNpBaseUrl();
    }
    function loadCacheFromServer(path, propertyName, callback, options) {
        var mode = getStorageMode();
        if (options && options.forceNp && mode !== "np" && isNpConfigured()) mode = "np";
        var profileId = getProfileId();
        if (!getProfileSetting("myshows_token")) {
            callback(null);
            return;
        }
        if (path !== "timetable" && !_checkServerCacheVersion()) {
            callback(null);
            return;
        }
        var NP_LOAD_PATHS = {
            unwatched_serials: "/myshows/watching",
            watchlist: "/myshows/watchlist",
            watched: "/myshows/watched",
            cancelled: "/myshows/cancelled",
            timetable_extra: "/myshows/profile_shows"
        };
        if (mode === "np") {
            if (!NP_LOAD_PATHS[path]) {
                callback(null);
                return;
            }
            var page = options && options.page ? options.page : 1;
            var npUrl = getNpBaseUrl() + NP_LOAD_PATHS[path] + "?token=" + encodeURIComponent(getNpToken()) + "&profile_id=" + encodeURIComponent(profileId) + "&page=" + page;
            var npNet = new Lampa.Reguest;
            npNet.silent(npUrl, function(response) {
                if (response && response.results) {
                    for (var ri = 0; ri < response.results.length; ri++) {
                        var item = response.results[ri];
                        if (item && item.myshowsId === void 0 && item.myshows_id !== void 0) item.myshowsId = item.myshows_id;
                        if (item && item.unwatched_episodes && !item.unwatchedEpisodes) {
                            var uarr = [];
                            for (var ux = 0; ux < item.unwatched_episodes.length; ux++) uarr.push({
                                id: item.unwatched_episodes[ux]
                            });
                            item.unwatchedEpisodes = uarr;
                        }
                    }
                    response.shows = response.results;
                    callback(response);
                } else callback(null);
            }, function() {
                callback(null);
            });
            return;
        }
        if (mode === "local") {
            callback(getProfileSetting("myshows_" + path, null));
            return;
        } else {
            var uri = accountUrl("/storage/get?path=myshows/" + path + "&pathfile=" + profileId);
            var network = new Lampa.Reguest;
            network.silent(uri, function(response) {
                if (response.success && response.fileInfo && response.data) {
                    var cacheData = JSON.parse(response.data);
                    var dataProperty = propertyName || "shows";
                    var result = {};
                    result[dataProperty] = cacheData[dataProperty];
                    callback(result);
                    return;
                }
                callback(null);
            }, function(error) {
                callback(null);
            });
        }
    }
    function getRefreshDelay() {
        return Lampa.Platform.tv() ? 1e4 : 5e3;
    }
    function initMyShowsCaches() {
        _msttT0 = Date.now();
        var updateDelay = getRefreshDelay();
        var renderToken = _profileRenderToken;
        loadCacheFromServer("unwatched_serials", "shows", function(cachedResult) {
            if (renderToken !== _profileRenderToken) return;
            var cachedShows = cachedResult && cachedResult.shows;
            seedUnwatchedSetFromCache(cachedShows, getProfileId());
            if (cachedShows && cachedShows.length > 0) {
                setTimeout(function() {
                    if (renderToken !== _profileRenderToken) return;
                    Date.now();
                    fetchFromMyShowsAPI(function(freshResult) {
                        Date.now();
                        if (renderToken !== _profileRenderToken) return;
                        if (freshResult && freshResult.shows && cachedResult.shows) {
                            freshResult.shows.forEach(function(s) {
                                if (s) s._renderToken = renderToken;
                            });
                            updateUIIfNeeded(cachedResult.shows, freshResult.shows);
                        }
                    });
                }, updateDelay);
                return;
            }
            if (getProfileSetting("myshows_token", "")) {
                Date.now();
                fetchFromMyShowsAPI(function(freshResult) {
                    if (renderToken !== _profileRenderToken) return;
                    if (freshResult && freshResult.shows) freshResult.shows.forEach(function(s) {
                        if (s) s._renderToken = renderToken;
                    });
                });
            }
        });
        if (useNpServer()) {
            var npSyncDelay = updateDelay + 2e3;
            setTimeout(function() {
                if (renderToken !== _profileRenderToken) return;
                var syncObj = {
                    page: 1,
                    forceRefresh: true
                };
                Api.myshowsWatchlist(syncObj, function() {}, function() {});
                Api.myshowsWatched(syncObj, function() {}, function() {});
                Api.myshowsCancelled(syncObj, function() {}, function() {});
            }, npSyncDelay);
        } else {
            loadCacheFromServer("serial_status", "shows", function(cachedResult) {
                if (renderToken !== _profileRenderToken) return;
                if (cachedResult) setTimeout(function() {
                    if (renderToken !== _profileRenderToken) return;
                    fetchShowStatus(function(showsData) {});
                }, updateDelay); else fetchShowStatus(function(showsData) {});
            });
            loadCacheFromServer("movie_status", "movies", function(cachedResult) {
                if (renderToken !== _profileRenderToken) return;
                if (cachedResult) setTimeout(function() {
                    if (renderToken !== _profileRenderToken) return;
                    fetchStatusMovies(function(showsData) {});
                }, updateDelay); else fetchStatusMovies(function(showsData) {});
            });
        }
    }
    function createJSONRPCRequest(method, params, id) {
        return JSON.stringify({
            jsonrpc: "2.0",
            method: method,
            params: params || {},
            id: id || 1
        });
    }
    function tryAuthFromSettings(successCallback) {
        var login = getProfileSetting("myshows_login", "");
        var password = getProfileSetting("myshows_password", "");
        if (!login || !password) {
            var msg = "Enter MyShows login and password";
            if (successCallback) successCallback(null); else Lampa.Noty.show(msg);
            return;
        }
        var network = new Lampa.Reguest;
        network.native(MYSHOWS_AUTH_PROXY, function(data) {
            if (data && data.token) {
                var token = data.token;
                setProfileSetting("myshows_token", token);
                Lampa.Storage.set("myshows_token", token, true);
                if (successCallback) successCallback(token); else {
                    Lampa.Noty.show("✅ Auth success! Reboot...");
                    setTimeout(function() {
                        window.location.reload();
                    }, 3e3);
                }
            } else fail("No token received");
        }, function(xhr) {
            fail("Network error: " + xhr.status);
        }, JSON.stringify({
            login: login,
            password: password
        }), {
            headers: JSON_HEADERS
        });
        function fail(msg) {
            if (successCallback) successCallback(null); else Lampa.Noty.show("🔒 MyShows auth failed: " + msg);
        }
    }
    function makeAuthenticatedRequest(options, callback, errorCallback) {
        var token = getProfileSetting("myshows_token", "");
        if (!token) {
            if (errorCallback) errorCallback(new Error("No token available"));
            return;
        }
        var network = new Lampa.Reguest;
        options.headers = options.headers || {};
        options.headers[AUTHORIZATION] = "Bearer " + token;
        network.silent(API_URL, function(data) {
            if (data && data.error && data.error.code === 401) tryAuthFromSettings(function(newToken) {
                if (newToken) {
                    options.headers[AUTHORIZATION] = "Bearer " + newToken;
                    var retryNetwork = new Lampa.Reguest;
                    retryNetwork.silent(API_URL, function(retryData) {
                        if (callback) callback(retryData);
                    }, function(retryXhr) {
                        if (errorCallback) errorCallback(new Error("HTTP " + retryXhr.status));
                    }, options.body, {
                        headers: options.headers
                    });
                } else if (errorCallback) errorCallback(new Error("Failed to refresh token"));
            }); else if (callback) callback(data);
        }, function(xhr) {
            if (xhr.status === 401) tryAuthFromSettings(function(newToken) {
                if (newToken) {
                    options.headers[AUTHORIZATION] = "Bearer " + newToken;
                    var retryNetwork = new Lampa.Reguest;
                    retryNetwork.silent(API_URL, function(retryData) {
                        if (callback) callback(retryData);
                    }, function(retryXhr) {
                        if (errorCallback) errorCallback(new Error("HTTP " + retryXhr.status));
                    }, options.body, {
                        headers: options.headers
                    });
                } else if (errorCallback) errorCallback(new Error("Failed to refresh token"));
            }); else if (errorCallback) errorCallback(new Error("HTTP " + xhr.status));
        }, options.body, {
            headers: options.headers
        });
    }
    function makeMyShowsRequest(requestConfig, callback) {
        makeAuthenticatedRequest(requestConfig, function(data) {
            if (data && data.result) callback(true, data); else callback(false, data);
        }, function(err) {
            callback(false, null);
        });
    }
    function makeMyShowsJSONRPCRequest(method, params, callback) {
        makeMyShowsRequest({
            method: "POST",
            headers: JSON_HEADERS,
            body: createJSONRPCRequest(method, params)
        }, callback);
    }
    function profileKeyFor(baseKey, profileId) {
        if (profileId && profileId.charAt(0) === "_") profileId = profileId.slice(1);
        return profileId ? baseKey + "_profile_" + profileId : baseKey;
    }
    function getProfileKey(baseKey) {
        return profileKeyFor(baseKey, getProfileId());
    }
    function getProfileSetting(key, defaultValue) {
        return Lampa.Storage.get(getProfileKey(key), defaultValue);
    }
    var _syncApplying = false;
    function setProfileSetting(key, value, sync) {
        Lampa.Storage.set(getProfileKey(key), value);
        if (sync !== false && !_syncApplying && window.__NMSync) window.__NMSync.patch("myshows", getProfileKey(key), value);
    }
    var MYSHOWS_SENSITIVE_KEYS = [ "myshows_login", "myshows_password", "myshows_token" ];
    function _applyMyShowsSetting(profileKey, value) {
        if (profileKey.indexOf("_profile_") < 0) return;
        _syncApplying = true;
        Lampa.Storage.set(profileKey, value);
        var base = profileKey.slice(0, profileKey.lastIndexOf("_profile_"));
        if (getProfileKey(base) === profileKey) {
            Lampa.Storage.set(base, value, true);
            if (base === "myshows_badge_style") applyBadgeStyleAttr();
        }
        _syncApplying = false;
    }
    function loadProfileSettings() {
        if (!hasProfileSetting("myshows_view_in_main")) setProfileSetting("myshows_view_in_main", true, false);
        if (!hasProfileSetting("myshows_button_view")) setProfileSetting("myshows_button_view", true, false);
        if (!hasProfileSetting("myshows_sort_order")) setProfileSetting("myshows_sort_order", "progress", false);
        if (!hasProfileSetting("myshows_add_threshold")) setProfileSetting("myshows_add_threshold", DEFAULT_ADD_THRESHOLD, false);
        if (!hasProfileSetting("myshows_min_progress")) setProfileSetting("myshows_min_progress", DEFAULT_MIN_PROGRESS, false);
        if (!hasProfileSetting("myshows_token")) setProfileSetting("myshows_token", "", false);
        if (!hasProfileSetting("myshows_login")) setProfileSetting("myshows_login", "", false);
        if (!hasProfileSetting("myshows_password")) setProfileSetting("myshows_password", "", false);
        if (!hasProfileSetting("myshows_cache_days")) setProfileSetting("myshows_cache_days", DEFAULT_CACHE_DAYS, false);
        if (!hasProfileSetting("myshows_use_np")) setProfileSetting("myshows_use_np", "false", false);
        if (!hasProfileSetting("myshows_badge_progress")) setProfileSetting("myshows_badge_progress", true, false);
        if (!hasProfileSetting("myshows_badge_remaining")) setProfileSetting("myshows_badge_remaining", true, false);
        if (!hasProfileSetting("myshows_badge_next")) setProfileSetting("myshows_badge_next", true, false);
        if (!hasProfileSetting("myshows_badge_style")) setProfileSetting("myshows_badge_style", "1", false);
        Lampa.Storage.set("myshows_view_in_main", getProfileSetting("myshows_view_in_main", true), true);
        Lampa.Storage.set("myshows_button_view", getProfileSetting("myshows_button_view", true), true);
        Lampa.Storage.set("myshows_sort_order", getProfileSetting("myshows_sort_order", "progress"), true);
        Lampa.Storage.set("myshows_add_threshold", parseInt(getProfileSetting("myshows_add_threshold", DEFAULT_ADD_THRESHOLD).toString()), true);
        Lampa.Storage.set("myshows_min_progress", getProfileSetting("myshows_min_progress", DEFAULT_MIN_PROGRESS).toString(), true);
        Lampa.Storage.set("myshows_token", getProfileSetting("myshows_token", ""), true);
        Lampa.Storage.set("myshows_login", getProfileSetting("myshows_login", ""), true);
        Lampa.Storage.set("myshows_password", getProfileSetting("myshows_password", ""), true);
        Lampa.Storage.set("myshows_cache_days", getProfileSetting("myshows_cache_days", DEFAULT_CACHE_DAYS), true);
        Lampa.Storage.set("myshows_use_np", getProfileSetting("myshows_use_np", "false"), true);
        Lampa.Storage.set("myshows_badge_progress", getProfileSetting("myshows_badge_progress", true), true);
        Lampa.Storage.set("myshows_badge_remaining", getProfileSetting("myshows_badge_remaining", true), true);
        Lampa.Storage.set("myshows_badge_next", getProfileSetting("myshows_badge_next", true), true);
        Lampa.Storage.set("myshows_badge_style", getProfileSetting("myshows_badge_style", "1"), true);
        applyBadgeStyleAttr();
    }
    function applyBadgeStyleAttr() {
        var v = getProfileSetting("myshows_badge_style", "1").toString();
        if (v === "2") document.body.setAttribute("data-myshows-badge-style", v); else document.body.removeAttribute("data-myshows-badge-style");
    }
    function hasProfileSetting(key) {
        var profileKey = getProfileKey(key);
        return window.localStorage.getItem(profileKey) !== null;
    }
    function initBadgesSubComponent() {
        if (window._myshows_badges_init) return;
        window._myshows_badges_init = true;
        Lampa.Template.add("settings_myshows_badges", "<div></div>");
        Lampa.SettingsApi.addParam({
            component: "myshows_badges",
            param: {
                name: "myshows_badge_progress",
                type: "trigger",
                default: false
            },
            field: {
                name: "Прогресс эпизодов",
                description: "Просмотрено / всего серий, например: 5/12"
            },
            onChange: function(value) {
                setProfileSetting("myshows_badge_progress", value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: "myshows_badges",
            param: {
                name: "myshows_badge_remaining",
                type: "trigger",
                default: false
            },
            field: {
                name: "Осталось серий",
                description: "Количество непросмотренных серий"
            },
            onChange: function(value) {
                setProfileSetting("myshows_badge_remaining", value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: "myshows_badges",
            param: {
                name: "myshows_badge_next",
                type: "trigger",
                default: false
            },
            field: {
                name: "Следующий эпизод",
                description: "Номер следующего эпизода для просмотра, например S01E05"
            },
            onChange: function(value) {
                setProfileSetting("myshows_badge_next", value === true || value === "true");
            }
        });
        Lampa.SettingsApi.addParam({
            component: "myshows_badges",
            param: {
                name: "myshows_badge_style",
                type: "select",
                values: {
                    1: "Вариант 1",
                    2: "Вариант 2"
                },
                default: "1"
            },
            field: {
                name: "Расположение значков",
                description: "Вариант 2: следующий эпизод слева внизу, прогресс справа внизу, остаток серий справа вверху, скругления как у карточки"
            },
            onChange: function(value) {
                setProfileSetting("myshows_badge_style", value.toString());
                applyBadgeStyleAttr();
            }
        });
    }
    function initSettings() {
        try {
            if (Lampa.SettingsApi.removeComponent) Lampa.SettingsApi.removeComponent("myshows");
        } catch (e) {}
        Lampa.SettingsApi.addComponent({
            component: "myshows",
            name: "MyShows",
            icon: myshows_icon
        });
        loadProfileSettings();
        autoSetupToken();
        var tokenValue = getProfileSetting("myshows_token", "");
        if (tokenValue) {
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_view_in_main",
                    type: "trigger",
                    default: getProfileSetting("myshows_view_in_main", true)
                },
                field: {
                    name: "Показывать на главной странице",
                    description: "Отображать непросмотренные сериалы на главной странице"
                },
                onChange: function(value) {
                    setProfileSetting("myshows_view_in_main", value);
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_calendar",
                    type: "trigger",
                    default: getProfileSetting("myshows_calendar", true)
                },
                field: {
                    name: "Календарь MyShows",
                    description: "Показывать даты выхода серий из MyShows в разделе «Календарь»"
                },
                onChange: function(value) {
                    setProfileSetting("myshows_calendar", value);
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_sort_order",
                    type: "select",
                    values: {
                        alphabet: "По алфавиту",
                        progress: "По прогрессу",
                        unwatched_count: "По количеству непросмотренных",
                        air_date: "По дате последнего эпизода ↓",
                        air_date_asc: "По дате последнего эпизода ↑",
                        first_unwatched_date: "По дате первого непросмотренного ↓",
                        first_unwatched_date_asc: "По дате первого непросмотренного ↑"
                    },
                    default: "progress"
                },
                field: {
                    name: "Сортировка сериалов",
                    description: "Порядок отображения сериалов на главной странице"
                },
                onChange: function(value) {
                    setProfileSetting("myshows_sort_order", value);
                    cachedShuffledItems = {};
                    setTimeout(function() {
                        var activity = Lampa.Activity.active();
                        if (activity) Lampa.Activity.replace({
                            url: activity.url,
                            title: activity.title,
                            component: activity.component,
                            source: activity.source,
                            page: activity.page || 1
                        });
                    }, 200);
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_add_threshold",
                    type: "select",
                    values: {
                        0: "Сразу при запуске",
                        5: "После 5% просмотра",
                        10: "После 10% просмотра",
                        15: "После 15% просмотра",
                        20: "После 20% просмотра",
                        25: "После 25% просмотра",
                        30: "После 30% просмотра",
                        35: "После 35% просмотра",
                        40: "После 40% просмотра",
                        45: "После 45% просмотра",
                        50: "После 50% просмотра"
                    },
                    default: getProfileSetting("myshows_add_threshold", DEFAULT_ADD_THRESHOLD).toString()
                },
                field: {
                    name: "Порог добавления сериала",
                    description: 'Когда добавлять сериал в список "Смотрю" на MyShows'
                },
                onChange: function(value) {
                    setProfileSetting("myshows_add_threshold", parseInt(value));
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_min_progress",
                    type: "select",
                    values: {
                        50: "50%",
                        60: "60%",
                        70: "70%",
                        80: "80%",
                        85: "85%",
                        90: "90%",
                        95: "95%",
                        100: "100%"
                    },
                    default: getProfileSetting("myshows_min_progress", DEFAULT_MIN_PROGRESS).toString()
                },
                field: {
                    name: "Порог просмотра",
                    description: "Минимальный процент просмотра для отметки эпизода или фильма на myshows.me"
                },
                onChange: function(value) {
                    setProfileSetting("myshows_min_progress", parseInt(value));
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_cache_days",
                    type: "select",
                    values: {
                        7: "7 дней",
                        14: "14 дней",
                        30: "30 дней",
                        60: "60 дней",
                        90: "90 дней"
                    },
                    default: DEFAULT_CACHE_DAYS.toString()
                },
                field: {
                    name: "Время жизни кеша",
                    description: "Через сколько дней очищать кеш: карточки TMDB, маппинг эпизодов"
                },
                onChange: function(value) {
                    setProfileSetting("myshows_cache_days", parseInt(value));
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    name: "myshows_button_view",
                    type: "trigger",
                    default: getProfileSetting("myshows_button_view", true)
                },
                field: {
                    name: "Показывать кнопки в карточках",
                    description: "Отображать кнопки уплавления в карточка"
                },
                onChange: function(value) {
                    setProfileSetting("myshows_button_view", value);
                }
            });
            Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    type: "button"
                },
                field: {
                    name: "Значки на карточках",
                    description: "Прогресс, остаток серий, следующий эпизод"
                },
                onChange: function() {
                    Lampa.Settings.create("myshows_badges", {
                        onBack: function() {
                            Lampa.Settings.create("myshows");
                        }
                    });
                }
            });
            if (isNpConnected()) addNpSettingsParam();
        }
        Lampa.SettingsApi.addParam({
            component: "myshows",
            param: {
                name: "myshows_login",
                type: "input",
                placeholder: "Логин MyShows",
                values: getProfileSetting("myshows_login", ""),
                default: ""
            },
            field: {
                name: "MyShows Логин",
                description: "Введите логин от аккаунта myshows.me"
            },
            onChange: function(value) {
                setProfileSetting("myshows_login", value);
            }
        });
        Lampa.SettingsApi.addParam({
            component: "myshows",
            param: {
                name: "myshows_password",
                type: "input",
                placeholder: "Пароль",
                values: getProfileSetting("myshows_password", ""),
                default: "",
                password: true
            },
            field: {
                name: "MyShows Пароль",
                description: "Введите пароль от аккаунта myshows.me. Логин и пароль передаются через прокси-сервер исключительно для получения токена авторизации и нигде не сохраняются."
            },
            onChange: function(value) {
                setProfileSetting("myshows_password", value);
                tryAuthFromSettings();
            }
        });
        if (tokenValue) Lampa.SettingsApi.addParam({
            component: "myshows",
            param: {
                type: "button"
            },
            field: {
                name: "Выйти из MyShows",
                description: "Очистить токен, логин и пароль"
            },
            onChange: function() {
                setProfileSetting("myshows_token", "", false);
                setProfileSetting("myshows_login", "", false);
                setProfileSetting("myshows_password", "", false);
                Lampa.Storage.set("myshows_token", "", true);
                Lampa.Storage.set("myshows_login", "", true);
                Lampa.Storage.set("myshows_password", "", true);
                Lampa.Noty.show("✅ Выход из MyShows выполнен");
                try {
                    sessionStorage.setItem("myshows_just_logged_out", "1");
                } catch (e) {}
                if (window.__NMSync) {
                    var done = 0;
                    var total = 3;
                    var onDone = function() {
                        done++;
                        if (done >= total) window.location.reload();
                    };
                    window.__NMSync.patch("myshows", getProfileKey("myshows_token"), "", onDone);
                    window.__NMSync.patch("myshows", getProfileKey("myshows_login"), "", onDone);
                    window.__NMSync.patch("myshows", getProfileKey("myshows_password"), "", onDone);
                } else setTimeout(function() {
                    window.location.reload();
                }, 1500);
            }
        });
        var xhr = new XMLHttpRequest;
        xhr.open("GET", "/timecode/batch_add", true);
        xhr.onload = function() {
            var isEnabled = xhr.status !== 404;
            if (isEnabled && IS_LAMPAC && tokenValue) Lampa.SettingsApi.addParam({
                component: "myshows",
                param: {
                    type: "button"
                },
                field: {
                    name: "Синхронизация с Lampac"
                },
                onChange: function() {
                    Lampa.Select.show({
                        title: "Синхронизация MyShows",
                        items: [ {
                            title: "Синхронизировать",
                            subtitle: "Добавить просмотренные фильмы и сериалы в историю Lampa.",
                            confirm: true
                        }, {
                            title: "Отмена"
                        } ],
                        onSelect: function(item) {
                            if (item.confirm) {
                                Lampa.Noty.show("Начинаем синхронизацию...");
                                syncMyShows(function(success, message) {
                                    if (success) Lampa.Noty.show(message); else Lampa.Noty.show("Ошибка: " + message);
                                });
                            }
                            Lampa.Controller.toggle("settings_component");
                        },
                        onBack: function() {
                            Lampa.Controller.toggle("settings_component");
                        }
                    });
                }
            });
        };
        xhr.onerror = function(e) {
            e.type;
        };
        xhr.send();
        if (!tokenValue) Lampa.SettingsApi.addParam({
            component: "myshows",
            param: {
                type: "static"
            },
            field: {
                name: "📋 После авторизации станут доступны:",
                description: "• Показ непросмотренных сериалов на главной странице<br>• Настройки сортировки<br>• Управление порогами просмотра<br>• Дополнительные настройки"
            }
        });
    }
    if (IS_LAMPAC && Lampa.Storage.get("lampac_profile_id")) {
        var originalProfileWaiter = window.__profile_extra_waiter;
        var myshowsProfileSynced = false;
        var currentProfileId = "";
        window.__profile_extra_waiter = function() {
            var synced = myshowsProfileSynced;
            if (typeof originalProfileWaiter === "function") synced = synced && originalProfileWaiter();
            return synced;
        };
    }
    function handleProfileChange() {
        myshowsProfileSynced = false;
        var newProfileId = getProfileId();
        if (currentProfileId === newProfileId) {
            myshowsProfileSynced = true;
            return;
        }
        currentProfileId = newProfileId;
        _profileRenderToken++;
        initSettings();
        cachedShuffledItems = {};
        _unwatchedProgressMap = {};
        EPISODES_CACHE = {};
        var currentActivity = Lampa.Activity.active();
        var newToken = getProfileSetting("myshows_token", "");
        if (currentActivity && currentActivity.component && currentActivity.component.indexOf("myshows_") === 0 && !newToken) {
            var start_from = Lampa.Storage.field("start_page");
            var active = Lampa.Storage.get("activity", "false");
            var startParams;
            if (window.start_deep_link) startParams = window.start_deep_link; else if (active && start_from === "last") startParams = active; else startParams = {
                url: "",
                title: Lang.translate("title_main") + " - " + Storage.field("source").toUpperCase(),
                component: "main",
                source: Storage.field("source"),
                page: 1
            };
            sursAddBtn();
            setTimeout(function() {
                Lampa.Activity.replace(startParams);
                Lampa.Noty.show("Профиль изменен. Нет данных MyShows в этом профиле");
                myshowsProfileSynced = true;
            }, 1e3);
        } else {
            sursAddBtn();
            var _oldSection = findMyShowsSection();
            if (_oldSection) {
                var _scroll = _oldSection.querySelector(".scroll__box, .items-line__scroll, .scroll");
                if (_scroll) {
                    var _cards = _scroll.querySelectorAll(".card");
                    _cards.forEach(function(c) {
                        c.parentNode && c.parentNode.removeChild(c);
                    });
                }
            }
            if (newToken) setTimeout(function() {
                try {
                    initMyShowsCaches();
                } catch (e) {}
                myshowsProfileSynced = true;
            }, 500); else myshowsProfileSynced = true;
        }
        setTimeout(function() {
            var settingsPanel = document.querySelector('[data-component="myshows"]');
            if (settingsPanel) {
                var myshowsViewInMain = settingsPanel.querySelector('select[data-name="myshows_view_in_main"]');
                if (myshowsViewInMain) myshowsViewInMain.value = getProfileSetting("myshows_view_in_main", true);
                var myshowsButtonView = settingsPanel.querySelector('select[data-name="myshows_button_view"]');
                if (myshowsViewInMain) myshowsButtonView.value = getProfileSetting("myshows_button_view", true);
                var sortSelect = settingsPanel.querySelector('select[data-name="myshows_sort_order"]');
                if (sortSelect) sortSelect.value = getProfileSetting("myshows_sort_order", "progress");
                var addThresholdSelect = settingsPanel.querySelector('select[data-name="myshows_add_threshold"]');
                if (addThresholdSelect) addThresholdSelect.value = getProfileSetting("myshows_add_threshold", DEFAULT_ADD_THRESHOLD).toString();
                var tokenInput = settingsPanel.querySelector('input[data-name="myshows_token"]');
                if (tokenInput) tokenInput.value = getProfileSetting("myshows_token", "");
                var progressSelect = settingsPanel.querySelector('select[data-name="myshows_min_progress"]');
                if (progressSelect) progressSelect.value = getProfileSetting("myshows_min_progress", DEFAULT_MIN_PROGRESS).toString();
                var daysSelect = settingsPanel.querySelector('select[data-name="myshows_cache_days"]');
                if (daysSelect) daysSelect.value = getProfileSetting("myshows_cache_days", DEFAULT_CACHE_DAYS).toString();
                var loginInput = settingsPanel.querySelector('input[data-name="myshows_login"]');
                if (loginInput) loginInput.value = getProfileSetting("myshows_login", "");
                var passwordInput = settingsPanel.querySelector('input[data-name="myshows_password"]');
                if (passwordInput) passwordInput.value = getProfileSetting("myshows_password", "");
                var useNpInput = settingsPanel.querySelector('input[data-name="myshows_use_np"]');
                if (useNpInput) useNpInput.value = getProfileSetting("myshows_use_np", "false");
            }
            var badgesPanel = document.querySelector('[data-component="myshows_badges"]');
            if (badgesPanel) {
                [ "myshows_badge_progress", "myshows_badge_remaining", "myshows_badge_next" ].forEach(function(key) {
                    var el = badgesPanel.querySelector('select[data-name="' + key + '"]');
                    if (el) el.value = getProfileSetting(key, true).toString();
                });
                var styleSelect = badgesPanel.querySelector('select[data-name="myshows_badge_style"]');
                if (styleSelect) styleSelect.value = getProfileSetting("myshows_badge_style", "1").toString();
            }
        }, 100);
    }
    function initCurrentProfile() {
        currentProfileId = getProfileId();
        myshowsProfileSynced = true;
    }
    Lampa.Listener.follow("state:changed", function(e) {
        if (e.target === "favorite" && e.reason === "profile") handleProfileChange();
    });
    Lampa.Listener.follow("profile", function(e) {
        if (e.type === "changed") handleProfileChange();
    });
    function getShowIdByExternalIds(imdbId, kinopoiskId, title, originalTitle, tmdbId, year, alternativeTitles, callback) {
        getShowIdByImdbId(imdbId, originalTitle || title, year, alternativeTitles, function(imdbResult) {
            if (imdbResult) return callback(imdbResult);
            getShowIdByKinopiskId(kinopoiskId, function(kinopoiskResult) {
                if (kinopoiskResult) return callback(kinopoiskResult);
                if (isAsianContent(originalTitle)) handleAsianContent(originalTitle, tmdbId, year, alternativeTitles, callback); else getShowIdByOriginalTitle(originalTitle, year, callback);
            });
        });
    }
    function handleAsianContent(originalTitle, tmdbId, year, alternativeTitles, callback) {
        if (alternativeTitles && alternativeTitles.length > 0) tryAlternativeTitles(alternativeTitles, 0, year, function(altResult) {
            if (altResult) return callback(altResult);
            tryEnglishTitleFallback(originalTitle, tmdbId, year, callback);
        }); else tryEnglishTitleFallback(originalTitle, tmdbId, year, callback);
    }
    function tryEnglishTitleFallback(originalTitle, tmdbId, year, callback) {
        getEnglishTitle(tmdbId, true, function(englishTitle) {
            if (englishTitle) getShowIdByOriginalTitle(englishTitle, year, function(englishResult) {
                if (englishResult) return callback(englishResult);
                finalFallbackToOriginal(originalTitle, year, callback);
            }); else finalFallbackToOriginal(originalTitle, year, callback);
        });
    }
    function finalFallbackToOriginal(originalTitle, year, callback) {
        getShowIdByOriginalTitle(originalTitle, year, function(finalResult) {
            callback(finalResult);
        });
    }
    function getShowIdBySource(id, source, callback) {
        makeMyShowsJSONRPCRequest("shows.GetByExternalId", {
            id: parseInt(id),
            source: source
        }, function(success, data) {
            if (success && data && data.result) callback(data.result.id); else callback(null);
        });
    }
    function getEpisodesByShowId(showId, token, callback) {
        makeMyShowsJSONRPCRequest("shows.GetById", {
            showId: parseInt(showId),
            withEpisodes: true
        }, function(success, data) {
            callback(data && data.result && data.result.episodes || []);
        });
    }
    function getShowIdByOriginalTitle(title, year, callback) {
        makeMyShowsJSONRPCRequest("shows.GetCatalog", {
            search: {
                query: title,
                year: parseInt(year)
            }
        }, function(success, data) {
            if (success && data && data.result) getShowCandidates(data.result, title, year, function(candidates) {
                callback(candidates || null);
            }); else callback(null);
        });
    }
    function getMovieIdByOriginalTitle(title, year, callback) {
        makeMyShowsJSONRPCRequest("movies.GetCatalog", {
            search: {
                query: title,
                year: parseInt(year)
            }
        }, function(success, data) {
            if (success && data && data.result) getMovieCandidates(data.result, title, year, function(candidates) {
                if (candidates) {
                    callback(candidates);
                    return;
                } else callback(null);
            }); else callback(null);
        });
    }
    function checkEpisodeMyShows(episodeId, callback) {
        makeMyShowsJSONRPCRequest("manage.CheckEpisode", {
            id: episodeId,
            rating: 0
        }, function(success, data) {
            callback(success);
        });
    }
    function npSetStatus(myshowsId, tmdbId, mediaType, npCacheType) {
        if (!useNpServer()) {
            getStorageMode(), window.IS_NP;
            return;
        }
        var profileId = getProfileId();
        var npUrl = getNpBaseUrl() + "/myshows/set_status?token=" + encodeURIComponent(getNpToken()) + "&profile_id=" + encodeURIComponent(profileId);
        var xhr = new XMLHttpRequest;
        xhr.open("POST", npUrl, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) ; else xhr.status;
        };
        xhr.onerror = function() {};
        xhr.send(JSON.stringify({
            myshows_id: myshowsId,
            tmdb_id: tmdbId,
            media_type: mediaType,
            cache_type: npCacheType
        }));
    }
    function setMyShowsStatus(cardData, status, callback) {
        var identifiers = getCardIdentifiers(cardData);
        if (!identifiers) {
            callback(false);
            return;
        }
        getShowIdByExternalIds(identifiers.imdbId, identifiers.kinopoiskId, identifiers.title, identifiers.originalName, identifiers.tmdbId, identifiers.year, identifiers.alternativeTitles, function(showId) {
            if (!showId) {
                callback(false);
                return;
            }
            makeMyShowsJSONRPCRequest("manage.SetShowStatus", {
                id: showId,
                status: status
            }, function(success, data) {
                if (success && data && data.result) {
                    cachedShuffledItems = {};
                    invalidateTimetableCache();
                    fetchShowStatus(function(data) {});
                    fetchFromMyShowsAPI(function(data) {});
                    if (status === "watching") addToHistory(cardData);
                    var tvMap = {
                        watching: "watching",
                        finished: "watching",
                        later: "watchlist",
                        cancelled: "cancelled",
                        remove: "remove"
                    };
                    npSetStatus(showId, cardData.id, "tv", tvMap[status] || "remove");
                    setCardStatusCache(cardData.id, false, status === "finished" ? "watching" : status);
                }
                callback(success);
            });
        });
    }
    function fetchShowStatus(callback) {
        var startProfile = getProfileId();
        makeMyShowsJSONRPCRequest("profile.Shows", {}, function(success, data) {
            if (success && data && data.result) {
                var filteredShows = data.result.map(function(item) {
                    var status = item.watchStatus;
                    if (status === "finished") status = "watching";
                    return {
                        id: item.show.id,
                        title: item.show.title,
                        titleOriginal: item.show.titleOriginal,
                        watchStatus: status
                    };
                });
                saveCacheToServer({
                    shows: filteredShows
                }, "serial_status", function() {}, startProfile);
                callback(getProfileId() === startProfile ? {
                    shows: filteredShows
                } : null);
            } else callback(null);
        });
    }
    function fetchFromMyShowsAPI(callback) {
        var startProfile = getProfileId();
        makeMyShowsJSONRPCRequest("lists.EpisodesUnwatched", {}, function(success, response) {
            if (!response || !response.result) {
                callback({
                    error: response ? response.error : "Empty response"
                });
                return;
            }
            var showsData = {};
            var shows = [];
            var myshowsIndex = {};
            for (var i = 0; i < response.result.length; i++) {
                var item = response.result[i];
                if (item.show && item.episodes && item.episodes.length > 0) {
                    var showId = item.show.id;
                    if (!showsData[showId]) showsData[showId] = {
                        show: item.show,
                        unwatchedCount: 0,
                        episodes: []
                    };
                    for (var j = 0; j < item.episodes.length; j++) {
                        var episode = item.episodes[j];
                        showsData[showId].episodes.push(episode);
                    }
                    showsData[showId].unwatchedCount = showsData[showId].episodes.length;
                    showsData[showId].episodes.sort(function(a, b) {
                        return new Date(b.airDateUTC || b.airDate) - new Date(a.airDateUTC || a.airDate);
                    });
                }
            }
            if (getProfileId() === startProfile) {
                var newUnwatchedIds = {};
                for (var si = 0; si < response.result.length; si++) {
                    var rit = response.result[si];
                    if (rit && rit.episodes) for (var ej = 0; ej < rit.episodes.length; ej++) {
                        var rep = rit.episodes[ej];
                        if (rep && rep.id) newUnwatchedIds[parseInt(rep.id)] = true;
                    }
                }
                _unwatchedEpisodeIds = newUnwatchedIds;
                _unwatchedEpisodeIdsReady = true;
                _unwatchedEpisodeIdsProfile = startProfile;
                Object.keys(newUnwatchedIds).length;
            }
            for (var showId in showsData) {
                var showData = showsData[showId];
                var lastEpisode = showData.episodes[0];
                var firstEpisode = showData.episodes[showData.episodes.length - 1];
                var last_episode_to_myshows = null;
                var first_episode_to_myshows = null;
                if (lastEpisode) last_episode_to_myshows = {
                    season_number: lastEpisode.seasonNumber,
                    episode_number: lastEpisode.episodeNumber,
                    air_date: lastEpisode.airDate,
                    air_date_utc: lastEpisode.airDateUTC
                };
                if (firstEpisode) first_episode_to_myshows = {
                    season_number: firstEpisode.seasonNumber,
                    episode_number: firstEpisode.episodeNumber,
                    air_date: firstEpisode.airDate,
                    air_date_utc: firstEpisode.airDateUTC
                };
                myshowsIndex[showData.show.id] = {
                    myshowsId: showData.show.id,
                    unwatchedCount: showData.unwatchedCount,
                    unwatchedEpisodes: showData.episodes,
                    last_episode_to_myshows: last_episode_to_myshows,
                    first_episode_to_myshows: first_episode_to_myshows
                };
                shows.push({
                    myshowsId: showData.show.id,
                    title: showData.show.title,
                    originalTitle: showData.show.titleOriginal,
                    year: showData.show.year,
                    unwatchedCount: showData.unwatchedCount,
                    unwatchedEpisodes: showData.episodes,
                    last_episode_to_myshows: last_episode_to_myshows,
                    first_episode_to_myshows: first_episode_to_myshows
                });
            }
            getTMDBDetails(shows, function(result) {
                var sameProfile = getProfileId() === startProfile;
                if (result && result.shows) {
                    for (var i = 0; i < result.shows.length; i++) {
                        var tmdbShow = result.shows[i];
                        if (tmdbShow.myshowsId && myshowsIndex[tmdbShow.myshowsId]) {
                            tmdbShow.unwatchedCount = myshowsIndex[tmdbShow.myshowsId].unwatchedCount;
                            tmdbShow.last_episode_to_myshows = myshowsIndex[tmdbShow.myshowsId].last_episode_to_myshows;
                            tmdbShow.first_episode_to_myshows = myshowsIndex[tmdbShow.myshowsId].first_episode_to_myshows;
                        }
                    }
                    result.shows.length, Date.now();
                    saveCacheToServer({
                        shows: result.shows
                    }, "unwatched_serials", function(ok) {
                        Date.now();
                        _fireUnwatchedSaved(result.shows);
                    }, startProfile);
                    if (sameProfile) _populateProgressMap(result.shows);
                }
                callback(sameProfile ? result : {
                    error: "profile changed"
                });
            });
        });
    }
    function setMyShowsMovieStatus(movieData, status, callback) {
        var title = movieData.original_title || movieData.title;
        var year = getMovieYear(movieData);
        getMovieIdByOriginalTitle(title, year, function(movieId) {
            if (!movieId) {
                callback(false);
                return;
            }
            makeMyShowsJSONRPCRequest("manage.SetMovieStatus", {
                movieId: movieId,
                status: status
            }, function(success, data) {
                if (success && data && data.result) {
                    cachedShuffledItems = {};
                    fetchStatusMovies(function(data) {});
                    if (status === "finished") addToHistory(movieData);
                    var movieMap = {
                        finished: "watched",
                        later: "watchlist",
                        remove: "remove"
                    };
                    npSetStatus(movieId, movieData.id, "movie", movieMap[status] || "remove");
                    setCardStatusCache(movieData.id, true, status);
                }
                callback(success);
            });
        });
    }
    function getShowIdByImdbId(id, expectedTitle, expectedYear, alternativeTitles, callback) {
        if (!id) {
            callback(null);
            return;
        }
        var cleanImdbId = id.indexOf("tt") === 0 ? id.slice(2) : id;
        makeMyShowsJSONRPCRequest("shows.GetByExternalId", {
            id: parseInt(cleanImdbId),
            source: "imdb"
        }, function(success, data) {
            if (success && data && data.result) {
                var found = data.result;
                var foundTitleClean = normalizeForComparison(cleanTitle(found.titleOriginal || found.title || ""));
                if (isAsianContent(expectedTitle)) {
                    var matched = false;
                    if (alternativeTitles) for (var i = 0; i < alternativeTitles.length; i++) if (normalizeForComparison(cleanTitle(alternativeTitles[i])) === foundTitleClean) {
                        matched = true;
                        break;
                    }
                    if (!matched) {
                        found.titleOriginal || found.title;
                        callback(null);
                        return;
                    }
                } else if (expectedTitle) {
                    var exp = normalizeForComparison(cleanTitle(expectedTitle));
                    if (foundTitleClean.indexOf(exp) === -1 && exp.indexOf(foundTitleClean) === -1) {
                        found.titleOriginal || found.title;
                        callback(null);
                        return;
                    }
                    if (expectedYear && found.year) {
                        var yearDiff = Math.abs(parseInt(found.year) - parseInt(expectedYear));
                        if (yearDiff > 1) {
                            found.year, found.titleOriginal || found.title;
                            callback(null);
                            return;
                        }
                    }
                }
                callback(found.id);
            } else callback(null);
        });
    }
    function getShowIdByKinopiskId(id, callback) {
        if (!id) {
            callback(null);
            return;
        }
        getShowIdBySource(id, "kinopoisk", function(myshows_id) {
            callback(myshows_id);
        });
    }
    function normalizeForComparison(str) {
        if (!str) return "";
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    }
    function getMediaCandidates(data, title, year, dataKey, getBestFn, callback) {
        var candidates = [];
        for (var i = 0; i < data.length; ++i) try {
            var item = data[i][dataKey];
            if (!item) continue;
            var titleMatch = item.titleOriginal && normalizeForComparison(cleanTitle(item.titleOriginal).toLowerCase()) === normalizeForComparison(cleanTitle(title).toLowerCase());
            var yearMatch = !year || !item.year || Math.abs(parseInt(item.year) - parseInt(year)) <= 1;
            if (titleMatch && yearMatch) candidates.push(item);
        } catch (e) {
            callback(null);
            return;
        }
        if (candidates.length === 0) callback(null); else if (candidates.length === 1) callback(candidates[0].id); else getBestFn(candidates, function(candidate) {
            callback(candidate ? candidate.id : null);
        });
    }
    function getShowCandidates(data, title, year, callback) {
        getMediaCandidates(data, title, year, "show", getBestShowCandidate, callback);
    }
    function getMovieCandidates(data, title, year, callback) {
        getMediaCandidates(data, title, year, "movie", getBestMovieCandidate, callback);
    }
    function getBestMovieCandidate(candidates, callback) {
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            if (!candidate.releaseDate) continue;
            try {
                var parts = candidate.releaseDate.split(".");
                if (parts.length !== 3) continue;
                var myShowsDate = new Date(parts[2], parts[1] - 1, parts[0]);
                myShowsDate.setHours(0, 0, 0, 0);
                var card = getCurrentCard();
                if (!card || !card.release_date) continue;
                var tmdbDate = new Date(card.release_date);
                tmdbDate.setHours(0, 0, 0, 0);
                if (myShowsDate.getTime() === tmdbDate.getTime()) {
                    callback(candidate);
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        callback(null);
    }
    function getBestShowCandidate(candidates, callback) {
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i];
            var airDate = candidate.started || candidate.first_air_date;
            if (!airDate) continue;
            try {
                var myShowsDate;
                if (airDate.indexOf(".") !== -1) {
                    var parts = airDate.split(".");
                    if (parts.length !== 3) continue;
                    myShowsDate = new Date(parts[2], parts[1] - 1, parts[0]);
                } else if (airDate.indexOf("-") !== -1) myShowsDate = new Date(airDate); else continue;
                myShowsDate.setHours(0, 0, 0, 0);
                var card = getCurrentCard();
                var tmdbDate = card && card.first_air_date ? new Date(card.first_air_date) : card && card.release_date ? new Date(card.release_date) : null;
                if (!tmdbDate) continue;
                tmdbDate.setHours(0, 0, 0, 0);
                if (tmdbDate && myShowsDate.getTime() === tmdbDate.getTime()) {
                    callback(candidate);
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        callback(candidates.length > 0 ? candidates[0] : null);
    }
    function getEnglishTitle(tmdbId, isSerial, callback) {
        var apiUrl = (isSerial ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + Lampa.TMDB.key() + "&language=en";
        var tmdbNetwork = new Lampa.Reguest;
        tmdbNetwork.silent(Lampa.TMDB.api(apiUrl), function(response) {
            if (response) {
                var englishTitle = isSerial ? response.name : response.title;
                callback(englishTitle);
            } else callback(null);
        }, function() {
            callback(null);
        });
    }
    function isAsianContent(originalTitle) {
        if (!originalTitle) return false;
        var koreanRegex = /[\uAC00-\uD7AF]/;
        var japaneseRegex = /[\u3040-\u30FF\uFF66-\uFF9F]/;
        var chineseRegex = /[\u4E00-\u9FFF]/;
        return koreanRegex.test(originalTitle) || japaneseRegex.test(originalTitle) || chineseRegex.test(originalTitle);
    }
    function tryAlternativeTitles(titles, index, year, callback) {
        titles.length;
        if (index >= titles.length) {
            callback(null);
            return;
        }
        var currentTitle = titles[index];
        getShowIdByOriginalTitle(currentTitle, year, function(myshows_id) {
            if (myshows_id) callback(myshows_id); else tryAlternativeTitles(titles, index + 1, year, callback);
        });
    }
    function getMovieYear(card) {
        return extractYear(card) || null;
    }
    function episodeMapKey(tmdbId, hash) {
        return (tmdbId ? String(tmdbId) : "0") + ":" + hash;
    }
    function buildHashMap(episodes, originalName, tmdbId, showId) {
        var map = {};
        var tmdbKey = tmdbId ? String(tmdbId) : "";
        for (var i = 0; i < episodes.length; i++) {
            var ep = episodes[i];
            var hashStr = ep.seasonNumber + (ep.seasonNumber > 10 ? ":" : "") + ep.episodeNumber + originalName;
            var hash = Lampa.Utils.hash(hashStr);
            map[episodeMapKey(tmdbKey, hash)] = {
                episodeId: ep.id,
                originalName: originalName,
                tmdbId: tmdbKey,
                showId: showId || null,
                hash: hash,
                timestamp: Date.now()
            };
        }
        return map;
    }
    function seedUnwatchedSetFromCache(shows, profileId) {
        if (!shows || !shows.length) return;
        var ids = {};
        var found = false;
        for (var i = 0; i < shows.length; i++) {
            var eps = shows[i] && shows[i].unwatchedEpisodes;
            if (!eps || !eps.length) continue;
            found = true;
            for (var j = 0; j < eps.length; j++) {
                var id = eps[j] && (eps[j].id !== void 0 ? eps[j].id : eps[j]);
                if (id) ids[parseInt(id)] = true;
            }
        }
        if (!found) return;
        _unwatchedEpisodeIds = ids;
        _unwatchedEpisodeIdsReady = true;
        _unwatchedEpisodeIdsProfile = profileId;
        Object.keys(ids).length;
    }
    function isEpisodeUnwatched(episodeId, callback) {
        if (!episodeId) {
            callback(false, true);
            return;
        }
        episodeId = parseInt(episodeId);
        if (_unwatchedEpisodeIdsReady && _unwatchedEpisodeIdsProfile === getProfileId()) {
            callback(!!_unwatchedEpisodeIds[episodeId], true);
            return;
        }
        loadCacheFromServer("unwatched_serials", "shows", function(cached) {
            var shows = cached && cached.shows;
            if (!shows) {
                callback(false, false);
                return;
            }
            var hasEpisodeData = false;
            for (var i = 0; i < shows.length; i++) {
                var eps = shows[i] && shows[i].unwatchedEpisodes;
                if (!eps || !eps.length) continue;
                hasEpisodeData = true;
                for (var j = 0; j < eps.length; j++) if (eps[j] && parseInt(eps[j].id) === episodeId) {
                    callback(true, true);
                    return;
                }
            }
            if (!hasEpisodeData) {
                callback(false, false);
                return;
            }
            callback(false, true);
        });
    }
    function ensureHashMap(card, token, callback) {
        var identifiers = getCardIdentifiers(card);
        if (!identifiers) {
            callback({});
            return;
        }
        var imdbId = identifiers.imdbId;
        var kinopoiskId = identifiers.kinopoiskId;
        var showTitle = identifiers.title;
        var originalName = identifiers.originalName;
        var year = identifiers.year;
        var tmdbId = identifiers.tmdbId;
        var alternativeTitles = identifiers.alternativeTitles;
        if (!originalName) {
            callback({});
            return;
        }
        var tmdbKey = tmdbId ? String(tmdbId) : "";
        var map = Lampa.Storage.get(MAP_KEY, {});
        if (tmdbKey) for (var h in map) if (map.hasOwnProperty(h) && map[h] && String(map[h].tmdbId) === tmdbKey) {
            callback(map);
            return;
        }
        getShowIdByExternalIds(imdbId, kinopoiskId, showTitle, originalName, tmdbId, year, alternativeTitles, function(showId) {
            if (!showId) {
                callback({});
                return;
            }
            getEpisodesByShowId(showId, token, function(episodes) {
                var newMap = buildHashMap(episodes, originalName, tmdbKey, showId);
                for (var k in newMap) if (newMap.hasOwnProperty(k)) map[k] = newMap[k];
                EPISODES_CACHE[tmdbKey || originalName] = map;
                EPISODES_CACHE[tmdbKey || originalName];
                Lampa.Storage.set(MAP_KEY, map);
                callback(map);
            });
        });
    }
    function isMovieContent(card) {
        if (card && ((card.number_of_seasons === void 0 || card.number_of_seasons === null) && card.media_type === "movie" || Lampa.Activity.active() && Lampa.Activity.active().method === "movie")) return true;
        if (card && (card.number_of_seasons > 0 || card.media_type === "tv" || Lampa.Activity.active() && Lampa.Activity.active().method === "tv" || card.name !== void 0)) return false;
        return !card.original_name && (card.original_title || card.title);
    }
    function getCurrentCard() {
        var card = Lampa.Activity && Lampa.Activity.active && Lampa.Activity.active() && (Lampa.Activity.active().card_data || Lampa.Activity.active().card || Lampa.Activity.active().movie) || null;
        if (!card) card = Lampa.Storage.get("myshows_last_card", null);
        if (card) card.isMovie = isMovieContent(card);
        return card;
    }
    function getCardIdentifiers(card) {
        if (!card) return null;
        var alternativeTitles = [];
        try {
            if (card.alternative_titles && card.alternative_titles.results) card.alternative_titles.results.forEach(function(altTitle) {
                if (altTitle.iso_3166_1 === "US" && altTitle.title) alternativeTitles.push(altTitle.title);
            });
        } catch (e) {}
        return {
            imdbId: card.imdb_id || card.imdbId || card.ids && card.ids.imdb,
            kinopoiskId: card.kinopoisk_id || card.kp_id || card.ids && card.ids.kp,
            title: card.title || card.name,
            originalName: card.original_name || card.original_title || card.title,
            year: extractYear(card) || null,
            tmdbId: card.id,
            alternativeTitles: alternativeTitles
        };
    }
    function processTimelineUpdate(data) {
        if (syncInProgress) return;
        if (!data || !data.data || !data.data.hash || !data.data.road) return;
        var hash = data.data.hash;
        var percent = data.data.road.percent;
        var token = getProfileSetting("myshows_token", "");
        var minProgress = parseInt(getProfileSetting("myshows_min_progress", DEFAULT_MIN_PROGRESS));
        var addThreshold = parseInt(getProfileSetting("myshows_add_threshold", DEFAULT_ADD_THRESHOLD));
        if (!token) return;
        var card = getCurrentCard();
        if (!card) return;
        var isMovie = isMovieContent(card);
        if (isMovie) {
            if (percent >= minProgress) {
                var mvKey = card.id ? String(card.id) : "";
                if (checkedMovies[mvKey] || getCardStatusCache(card.id, true) === "finished") return;
                setMyShowsMovieStatus(card, "finished", function(success) {
                    if (success) {
                        checkedMovies[mvKey] = true;
                        setCardStatusCache(card.id, true, "finished");
                        cachedShuffledItems = {};
                    }
                });
            }
        } else {
            var tmdbKey = card.id ? String(card.id) : "";
            var mapKey = episodeMapKey(tmdbKey, hash);
            ensureHashMap(card, token, function(map) {
                var entry = map[mapKey];
                var episodeId = entry && entry.episodeId ? entry.episodeId : entry;
                if (episodeId) ;
                if (!episodeId) {
                    var fullMap = Lampa.Storage.get(MAP_KEY, {});
                    for (var h in fullMap) if (fullMap.hasOwnProperty(h) && fullMap[h] && String(fullMap[h].tmdbId) === tmdbKey) delete fullMap[h];
                    Lampa.Storage.set(MAP_KEY, fullMap);
                    ensureHashMap(card, token, function(newMap) {
                        var newEntry = newMap[mapKey];
                        var newEpisodeId = newEntry && newEntry.episodeId ? newEntry.episodeId : newEntry;
                        if (newEpisodeId) processEpisode(newEpisodeId, hash, percent, card, token, minProgress, addThreshold); else {
                            var episodes_hash = EPISODES_CACHE[tmdbKey] || EPISODES_CACHE[card.original_name || card.original_title || card.title];
                            var episodeId = null;
                            if (episodes_hash) {
                                var hit = episodes_hash[mapKey];
                                if (hit && String(hit.tmdbId) === tmdbKey && hit.hash == hash) episodeId = hit.episodeId;
                            }
                            if (episodeId) processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold);
                        }
                    });
                    return;
                }
                processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold);
            });
        }
    }
    function processEpisode(episodeId, hash, percent, card, token, minProgress, addThreshold) {
        var originalName = card.original_name || card.original_title || card.title;
        var firstEpisodeHash = Lampa.Utils.hash("11" + originalName);
        var currentStatus = getCardStatusCache(card.id, false);
        var alreadyWatching = currentStatus === "watching";
        var isFirstEpisode = hash === firstEpisodeHash;
        if (isFirstEpisode && (percent >= addThreshold || addThreshold === 0) && !alreadyWatching) ensureWatchingStatus(card, "S1E1 percent=" + percent, function(success) {
            cachedShuffledItems = {};
            if (success && percent < minProgress) {
                invalidateTimetableCache();
                fetchFromMyShowsAPI(function(data) {});
                fetchShowStatus(function(data) {});
            }
        });
        if (percent >= minProgress) {
            if (checkedEpisodes[episodeId]) return;
            var markEpisode = function(reason) {
                checkEpisodeMyShows(episodeId, function(success) {
                    if (!success) return;
                    checkedEpisodes[episodeId] = true;
                    delete _unwatchedEpisodeIds[parseInt(episodeId)];
                    if (!alreadyWatching) ensureWatchingStatus(card, 'отметка серии при статусе "' + currentStatus + '"', function() {});
                    fetchFromMyShowsAPI(function(data) {});
                });
            };
            if (currentStatus === "watching") isEpisodeUnwatched(episodeId, function(unwatched, known) {
                if (known && !unwatched) {
                    checkedEpisodes[episodeId] = true;
                    return;
                }
                markEpisode(known ? "есть в непросмотренных" : "список непросмотренных недоступен");
            }); else markEpisode('статус "' + currentStatus + '"');
        }
    }
    function initTimelineListener() {
        if (window.Lampa && Lampa.Timeline && Lampa.Timeline.listener) Lampa.Timeline.listener.follow("update", processTimelineUpdate);
    }
    function autoSetupToken() {
        var token = getProfileSetting("myshows_token", "");
        if (token && token.length > 0) return;
        var login = getProfileSetting("myshows_login", "");
        var password = getProfileSetting("myshows_password", "");
        if (login && password) tryAuthFromSettings();
    }
    function cleanupOldMappings() {
        var map = Lampa.Storage.get(MAP_KEY, {});
        var now = Date.now();
        var days = parseInt(getProfileSetting("myshows_cache_days", DEFAULT_CACHE_DAYS));
        var maxAge = days * 24 * 60 * 60 * 1e3;
        var cleaned = {};
        var removedCount = 0;
        for (var hash in map) if (map.hasOwnProperty(hash)) {
            var item = map[hash];
            if (item && item.timestamp && typeof item.timestamp === "number" && now - item.timestamp < maxAge) cleaned[hash] = item; else removedCount++;
        }
        if (removedCount > 0) Lampa.Storage.set(MAP_KEY, cleaned);
    }
    function getUnwatchedShowsWithDetails(callback, show) {
        if (isNpConnected() || isNpConfigured()) {
            if (!getProfileSetting("myshows_token") || !getNpToken()) {
                callback({
                    shows: []
                });
                return;
            }
            loadCacheFromServer("unwatched_serials", "shows", function(cachedResult) {
                var shows = cachedResult && cachedResult.shows;
                if (shows && shows.length > 0) {
                    shows.forEach(function(s) {
                        if (s.progress_marker && !s.watched_count) {
                            var parts = String(s.progress_marker).split("/");
                            if (parts.length === 2) {
                                s.watched_count = parseInt(parts[0]) || 0;
                                s.total_count = parseInt(parts[1]) || s.watched_count + (s.unwatched_count || 0);
                            }
                        }
                        if (s.remaining === void 0 && s.unwatched_count !== void 0) s.remaining = s.unwatched_count;
                    });
                    var sortOrder = getProfileSetting("myshows_sort_order", "progress");
                    sortShows(shows, sortOrder);
                    _populateProgressMap(shows);
                    cachedResult.shows = shows;
                    callback(cachedResult);
                } else fetchFromMyShowsAPI(function(freshResult) {
                    callback(freshResult || {
                        shows: []
                    });
                });
            }, {
                forceNp: true
            });
        } else if (IS_LAMPAC) loadCacheFromServer("unwatched_serials", "shows", function(cachedResult) {
            if (cachedResult && cachedResult.shows && cachedResult.shows.length) {
                var sortOrder = getProfileSetting("myshows_sort_order", "progress");
                sortShows(cachedResult.shows, sortOrder);
                _populateProgressMap(cachedResult.shows);
                callback(cachedResult);
            } else fetchFromMyShowsAPI(function(freshResult) {
                callback(freshResult);
            });
        }); else loadCacheFromServer("unwatched_serials", "shows", function(cachedResult) {
            var shows = cachedResult && cachedResult.shows;
            if (shows && shows.length > 0) {
                shows.length;
                var sortOrder = getProfileSetting("myshows_sort_order", "progress");
                sortShows(shows, sortOrder);
                _populateProgressMap(shows);
                cachedResult.shows = shows;
                callback(cachedResult);
                setTimeout(function() {
                    fetchFromMyShowsAPI(function(freshResult) {
                        if (freshResult && freshResult.shows && cachedResult.shows) updateUIIfNeeded(cachedResult.shows, freshResult.shows);
                    });
                }, getRefreshDelay());
            } else fetchFromMyShowsAPI(function(freshResult) {
                callback(freshResult);
            });
        });
    }
    function updateUIIfNeeded(oldShows, newShows) {
        function showsMatch(a, b) {
            if (a.myshowsId && b.myshowsId) return a.myshowsId === b.myshowsId;
            var n1 = (a.original_name || a.name || a.title || "").toLowerCase();
            var n2 = (b.original_name || b.name || b.title || "").toLowerCase();
            return n1 && n2 && n1 === n2;
        }
        function findInArray(show, arr) {
            for (var i = 0; i < arr.length; i++) if (showsMatch(show, arr[i])) return arr[i];
            return null;
        }
        newShows.forEach(function(newShow) {
            if (!findInArray(newShow, oldShows)) {
                var showName = newShow.original_name || newShow.name || newShow.title || "";
                newShow.myshowsId;
                var existingCard = findCardInMyShowsSection(showName, newShow.myshowsId);
                if (!existingCard) insertNewCardIntoMyShowsSection(newShow); else {
                    existingCard.card_data = existingCard.card_data || {};
                    existingCard.card_data.progress_marker = newShow.progress_marker;
                    existingCard.card_data.next_episode = newShow.next_episode;
                    existingCard.card_data.remaining = newShow.remaining;
                    addProgressMarkerToCard(existingCard, existingCard.card_data);
                }
            }
        });
        oldShows.forEach(function(oldShow) {
            if (!findInArray(oldShow, newShows)) {
                var showName = oldShow.original_name || oldShow.name || oldShow.title || "";
                oldShow.myshowsId;
                updateCompletedShowCard(showName, oldShow.myshowsId);
            }
        });
        newShows.forEach(function(newShow) {
            var oldShow = findInArray(newShow, oldShows);
            if (oldShow) if (oldShow.progress_marker !== newShow.progress_marker || oldShow.next_episode !== newShow.next_episode) {
                var showName = newShow.original_name || newShow.name || newShow.title || "";
                newShow.myshowsId;
                updateAllMyShowsCards(showName, newShow.myshowsId, newShow.progress_marker, newShow.next_episode, newShow.remaining);
            }
        });
    }
    function enrichShowData(fullResponse, myshowsData) {
        var enriched = {};
        for (var _k in fullResponse) if (fullResponse.hasOwnProperty(_k)) enriched[_k] = fullResponse[_k];
        if (myshowsData) {
            enriched.progress_marker = myshowsData.progress_marker;
            enriched.remaining = myshowsData.remaining;
            enriched.watched_count = myshowsData.watched_count;
            enriched.total_count = myshowsData.total_count;
            enriched.released_count = myshowsData.released_count;
            enriched.next_episode = myshowsData.next_episode;
        }
        enriched.create_date = fullResponse.first_air_date || "";
        enriched.last_air_date = fullResponse.last_air_date || "";
        enriched.release_date = fullResponse.first_air_date || "";
        enriched.release_year = extractYear(fullResponse);
        enriched.number_of_seasons = fullResponse.number_of_seasons || 0;
        enriched.original_title = fullResponse.original_name || fullResponse.name || "";
        enriched.seasons = fullResponse.seasons || null;
        enriched.source = "tmdb";
        enriched.status = fullResponse.status;
        enriched.still_path = "";
        enriched.update_date = (new Date).toISOString();
        enriched.video = false;
        return enriched;
    }
    function getTMDBDetails(shows, callback) {
        if (shows.length === 0) return callback({
            shows: []
        });
        var status = new Lampa.Status(shows.length);
        shows.length;
        shows.forEach(function(show, idx) {
            show.title, show.myshowsId;
        });
        status.onComplite = function(data) {
            var matchedShows = Object.keys(data).map(function(key) {
                return data[key];
            }).filter(Boolean);
            matchedShows.length;
            matchedShows.forEach(function(show, idx) {
                show.name, show.id;
            });
            var sortOrder = getProfileSetting("myshows_sort_order", "progress");
            sortShows(matchedShows, sortOrder);
            callback({
                shows: matchedShows
            });
        };
        loadCacheFromServer("unwatched_serials", "shows", function(cache) {
            var cachedShows = cache && cache.shows ? cache.shows : [];
            cachedShows.length;
            cachedShows.forEach(function(show, idx) {
                show.name, show.id;
            });
            var parts = shows.map(function(currentShow, index) {
                return function(call) {
                    fetchTMDBShowDetails(currentShow, index, status, cachedShows, call);
                };
            });
            Lampa.Api.partNext(parts, 2, function(results) {}, function() {});
        });
    }
    function getShowComparator(order) {
        switch (order) {
          case "progress":
            return sortByProgress;

          case "unwatched_count":
            return sortByUnwatched;

          case "air_date":
            return sortByAirDate;

          case "air_date_asc":
            return sortByAirDateAsc;

          case "first_unwatched_date":
            return sortByFirstUnwatchedDate;

          case "first_unwatched_date_asc":
            return sortByFirstUnwatchedDateAsc;

          default:
            return sortByAlphabet;
        }
    }
    function sortShows(shows, order) {
        shows && shows.length;
        shows.sort(getShowComparator(order));
    }
    function reorderCardsInMyShowsSection() {
        var section = findMyShowsSection();
        if (!section) return;
        var cards = section.querySelectorAll(".card");
        if (cards.length < 2) return;
        var cardsArray = Array.prototype.slice.call(cards);
        var container = cardsArray[0].parentNode;
        var comparator = getShowComparator(getProfileSetting("myshows_sort_order", "progress"));
        var focused = document.activeElement;
        var nonCards = Array.prototype.filter.call(container.children, function(el) {
            return !el.classList.contains("card");
        });
        cardsArray.sort(function(a, b) {
            return comparator(a.card_data || {}, b.card_data || {});
        });
        cardsArray.forEach(function(card) {
            container.appendChild(card);
        });
        nonCards.forEach(function(el) {
            container.appendChild(el);
        });
        if (focused && focused !== document.body) focused.focus();
        var scroll = section.querySelector(".scroll");
        if (scroll) scroll.dispatchEvent(new Event("scroll"));
    }
    function sortByAlphabet(a, b) {
        var nameA = (a.name || a.title || "").toLowerCase();
        var nameB = (b.name || b.title || "").toLowerCase();
        return nameA.localeCompare(nameB, "ru");
    }
    function sortByProgress(a, b) {
        var progressA = (a.watched_count || 0) / (a.total_count || 1);
        var progressB = (b.watched_count || 0) / (b.total_count || 1);
        if (progressB !== progressA) return progressB - progressA;
        return (b.watched_count || 0) - (a.watched_count || 0);
    }
    function sortByUnwatched(a, b) {
        var unwatchedA = a.remaining !== void 0 ? a.remaining : (a.released_count || a.total_count || 0) - (a.watched_count || 0);
        var unwatchedB = b.remaining !== void 0 ? b.remaining : (b.released_count || b.total_count || 0) - (b.watched_count || 0);
        if (unwatchedB !== unwatchedA) return unwatchedA - unwatchedB;
        return sortByAlphabet(a, b);
    }
    function sortByAirDate(a, b) {
        var epA = a.last_episode_to_myshows;
        var epB = b.last_episode_to_myshows;
        var timeA = epA ? new Date(epA.air_date_utc || epA.air_date).getTime() : 0;
        var timeB = epB ? new Date(epB.air_date_utc || epB.air_date).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return sortByAlphabet(a, b);
    }
    function sortByAirDateAsc(a, b) {
        var epA = a.last_episode_to_myshows;
        var epB = b.last_episode_to_myshows;
        var timeA = epA ? new Date(epA.air_date_utc || epA.air_date).getTime() : 0;
        var timeB = epB ? new Date(epB.air_date_utc || epB.air_date).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        return sortByAlphabet(a, b);
    }
    function sortByFirstUnwatchedDate(a, b) {
        var epA = a.first_episode_to_myshows;
        var epB = b.first_episode_to_myshows;
        var timeA = epA ? new Date(epA.air_date_utc || epA.air_date).getTime() : 0;
        var timeB = epB ? new Date(epB.air_date_utc || epB.air_date).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return sortByAlphabet(a, b);
    }
    function sortByFirstUnwatchedDateAsc(a, b) {
        var epA = a.first_episode_to_myshows;
        var epB = b.first_episode_to_myshows;
        var timeA = epA ? new Date(epA.air_date_utc || epA.air_date).getTime() : 0;
        var timeB = epB ? new Date(epB.air_date_utc || epB.air_date).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        return sortByAlphabet(a, b);
    }
    function fetchTMDBShowDetails(currentShow, index, status, cachedShows, callback) {
        var originalName = currentShow.originalTitle || currentShow.title || "";
        var cleanedName = cleanTitle(originalName);
        currentShow.myshowsId;
        var cachedShow = null;
        var currentNameLower = cleanedName.toLowerCase();
        for (var _i = 0; _i < cachedShows.length; _i++) {
            var _s = cachedShows[_i];
            if (currentShow.myshowsId && _s.myshowsId && _s.myshowsId === currentShow.myshowsId) {
                cachedShow = _s;
                _s.name;
                break;
            }
            if (!cachedShow) {
                var _fields = [ _s.original_title, _s.original_name, _s.name, _s.title ];
                for (var _f = 0; _f < _fields.length; _f++) if (_fields[_f] && cleanTitle(_fields[_f]).toLowerCase() === currentNameLower) {
                    if (currentShow.myshowsId && _s.myshowsId && _s.myshowsId !== currentShow.myshowsId) {
                        currentShow.myshowsId, _s.myshowsId;
                        continue;
                    }
                    if (currentShow.year && _s.year && Math.abs(parseInt(_s.year) - parseInt(currentShow.year)) > 1) {
                        _s.year, currentShow.year;
                        continue;
                    }
                    cachedShow = _s;
                    break;
                }
                if (cachedShow) {
                    _s.name;
                    break;
                }
            }
        }
        if (cachedShow && cachedShow.id) {
            cachedShow.name;
            enrichTMDBShow({
                id: cachedShow.id,
                name: cachedShow.name
            }, currentShow, index, status, cachedShows);
            callback();
        } else searchTMDBWithRetry(currentShow, index, status, callback);
    }
    function searchTMDBWithRetry(currentShow, index, status, callback) {
        var originalTitle = currentShow.originalTitle || currentShow.title;
        var cleanedTitle = cleanTitle(currentShow.originalTitle) || cleanTitle(currentShow.title);
        var searchAttempts = [];
        if (originalTitle) searchAttempts.push(originalTitle);
        if (cleanedTitle && cleanedTitle !== originalTitle) searchAttempts.push(cleanedTitle);
        searchAttempts = searchAttempts.filter(function(q, i, a) {
            return a.indexOf(q) === i;
        });
        function attemptSearch(attemptIndex, withYear) {
            if (attemptIndex >= searchAttempts.length) {
                status.append("tmdb_" + index, null);
                callback();
                return;
            }
            var query = searchAttempts[attemptIndex];
            var searchUrl = "search/tv" + "?api_key=" + Lampa.TMDB.key() + "&query=" + encodeURIComponent(query) + "&language=" + Lampa.Storage.get("tmdb_lang", "ru");
            if (withYear && currentShow.year && currentShow.year > 1900 && currentShow.year < 2100) searchUrl += "&year=" + currentShow.year;
            var network = new Lampa.Reguest;
            network.silent(Lampa.TMDB.api(searchUrl), function(searchResponse) {
                if (searchResponse && searchResponse.results && searchResponse.results.length) {
                    searchResponse.results[0].name;
                    enrichTMDBShow(searchResponse.results[0], currentShow, index, status);
                    callback();
                } else if (withYear) attemptSearch(attemptIndex, false); else attemptSearch(attemptIndex + 1, true);
            }, function(error) {
                if (withYear) attemptSearch(attemptIndex, false); else attemptSearch(attemptIndex + 1, true);
            });
        }
        if (searchAttempts.length > 0) attemptSearch(0, true); else {
            status.append("tmdb_" + index, null);
            callback();
        }
    }
    function enrichTMDBShow(foundShow, currentShow, index, status, cachedShows) {
        var cachedShow = null;
        if (cachedShows) for (var _ci = 0; _ci < cachedShows.length; _ci++) {
            var _cs = cachedShows[_ci];
            if (_cs.myshowsId && currentShow.myshowsId) {
                if (_cs.myshowsId === currentShow.myshowsId) {
                    cachedShow = _cs;
                    break;
                }
            } else {
                var _n1 = (_cs.original_title || _cs.original_name || _cs.name || "").toLowerCase();
                var _n2 = (currentShow.originalTitle || currentShow.title || "").toLowerCase();
                if (_n1 === _n2) {
                    if (currentShow.year && _cs) {
                        var _csYear = parseInt(_cs.year) || parseInt(extractYear(_cs)) || 0;
                        if (_csYear && Math.abs(_csYear - parseInt(currentShow.year)) > 1) {
                            currentShow.year;
                            continue;
                        }
                    }
                    cachedShow = _cs;
                    break;
                }
            }
        }
        if (cachedShow && cachedShow.seasons) {
            cachedShow.name;
            getMyShowsEpisodesCount(foundShow, currentShow, cachedShow, function(myShowsData) {
                if (myShowsData) appendEnriched(cachedShow, foundShow, currentShow, myShowsData.totalEpisodes, myShowsData.releasedEpisodes, index, status);
            });
            return;
        }
        foundShow.name;
        var fullUrl = "tv/" + foundShow.id + "?api_key=" + Lampa.TMDB.key() + "&language=" + Lampa.Storage.get("tmdb_lang", "ru");
        var fullNetwork = new Lampa.Reguest;
        fullNetwork.silent(Lampa.TMDB.api(fullUrl), function(fullResponse) {
            if (!fullResponse || !fullResponse.seasons) {
                foundShow.myshowsId = currentShow.myshowsId;
                return status.append("tmdb_" + index, foundShow);
            }
            getMyShowsEpisodesCount(foundShow, currentShow, fullResponse, function(myShowsData) {
                if (myShowsData) appendEnriched(fullResponse, foundShow, currentShow, myShowsData.totalEpisodes, myShowsData.releasedEpisodes, index, status); else {
                    foundShow.myshowsId = currentShow.myshowsId;
                    status.append("tmdb_" + index, foundShow);
                }
            });
        });
    }
    function getMyShowsEpisodesCount(foundShow, currentShow, fullResponse, callback) {
        var showId = currentShow && currentShow.myshowsId;
        if (!showId) {
            var identifiers = {
                imdbId: fullResponse.external_ids ? fullResponse.external_ids.imdb_id : null,
                title: fullResponse.name,
                originalName: fullResponse.original_name,
                tmdbId: fullResponse.id,
                year: extractYear(fullResponse) || null
            };
            getShowIdByExternalIds(identifiers.imdbId, null, identifiers.title, identifiers.originalName, identifiers.tmdbId, identifiers.year, null, function(foundId) {
                if (foundId) fetchEpisodes(foundId); else callback(null);
            });
            return;
        }
        fetchEpisodes(showId);
        function fetchEpisodes(showId) {
            var token = getProfileSetting("myshows_token", "");
            if (!token) {
                callback(null);
                return;
            }
            getEpisodesByShowId(showId, token, function(episodes) {
                if (!episodes || episodes.length === 0) {
                    callback(null);
                    return;
                }
                var now = new Date;
                var released = 0;
                var regular = 0;
                var specials = 0;
                var specialsReleased = 0;
                for (var i = 0; i < episodes.length; i++) {
                    var ep = episodes[i];
                    if (ep.isSpecial || ep.episodeNumber === 0) {
                        specials++;
                        var airDateSpecial = ep.airDateUTC ? new Date(ep.airDateUTC) : ep.airDate ? new Date(ep.airDate) : null;
                        if (!airDateSpecial || airDateSpecial <= now) specialsReleased++;
                    } else {
                        regular++;
                        var airDate = ep.airDateUTC ? new Date(ep.airDateUTC) : ep.airDate ? new Date(ep.airDate) : null;
                        if (!airDate || airDate <= now) released++;
                    }
                }
                fullResponse.name, episodes.length;
                callback({
                    totalEpisodes: regular,
                    releasedEpisodes: released,
                    specialEpisodes: specials,
                    releasedSpecialEpisodes: specialsReleased
                });
            });
        }
    }
    function appendEnriched(fullResponse, foundShow, currentShow, totalEpisodes, releasedEpisodes, index, status) {
        var watchedEpisodes = Math.max(0, releasedEpisodes - currentShow.unwatchedCount);
        var remainingEpisodes = releasedEpisodes - watchedEpisodes;
        var nextEpisode = null;
        if (currentShow.unwatchedEpisodes && currentShow.unwatchedEpisodes.length > 0) {
            var lastUnwatched = currentShow.unwatchedEpisodes[currentShow.unwatchedEpisodes.length - 1];
            var shortName = lastUnwatched.shortName;
            if (shortName) {
                var match = shortName.match(/s(\d+)e(\d+)/i);
                if (match) {
                    var season = padTwo(match[1]);
                    var episode = padTwo(match[2]);
                    nextEpisode = "S" + season + "/E" + episode;
                } else nextEpisode = shortName.toUpperCase();
            }
        }
        var myshowsData = {
            progress_marker: watchedEpisodes + "/" + releasedEpisodes,
            remaining: remainingEpisodes,
            watched_count: watchedEpisodes,
            total_count: totalEpisodes,
            released_count: releasedEpisodes,
            next_episode: nextEpisode
        };
        var enrichedShow = enrichShowData(fullResponse, myshowsData);
        enrichedShow.myshowsId = currentShow.myshowsId;
        enrichedShow.unwatchedCount = currentShow.unwatchedCount;
        enrichedShow.unwatchedEpisodes = currentShow.unwatchedEpisodes;
        enrichedShow.last_episode_to_myshows = currentShow.last_episode_to_myshows;
        enrichedShow.first_episode_to_myshows = currentShow.first_episode_to_myshows;
        status.append("tmdb_" + index, enrichedShow);
    }
    function getTotalEpisodesCount(tmdbShow) {
        var total = 0;
        if (tmdbShow.seasons) tmdbShow.seasons.forEach(function(season) {
            if (season.season_number > 0) total += season.episode_count || 0;
        });
        return total;
    }
    function openMyShowsPage() {
        Lampa.Activity.push({
            url: "",
            title: "MyShows",
            component: "myshows_all"
        });
    }
    window.MyShows = {
        getUnwatchedShowsWithDetails: getUnwatchedShowsWithDetails,
        openPage: openMyShowsPage,
        isLoggedIn: function() {
            return !!getProfileSetting("myshows_token", "");
        }
    };
    var _sursBtn = {
        id: "myshows_unwatched",
        title: "MyShows",
        icon: myshows_icon,
        action: function() {
            window.MyShows.openPage();
        }
    };
    function sursAddBtn() {
        if (typeof window.surs_addExternalButton !== "function") return;
        if (!window.MyShows.isLoggedIn()) {
            if (typeof window.surs_removeExternalButton === "function") window.surs_removeExternalButton(_sursBtn.id);
            return;
        }
        var existing = window.surs_external_buttons && window.surs_external_buttons.some(function(b) {
            return b.id === _sursBtn.id;
        });
        if (!existing) window.surs_addExternalButton(_sursBtn);
    }
    if (window.plugin_custom_buttons_ready) sursAddBtn(); else Lampa.Listener.follow("custom_buttons", function(e) {
        if (e.type === "ready") sursAddBtn();
    });
    function updateCardWithAnimation(cardElement, newText, markerClass) {
        if (!cardElement || !markerClass) return;
        if (typeof newText !== "string") return;
        var marker = cardElement.querySelector("." + markerClass);
        if (!marker) return;
        var oldText = marker.textContent || "";
        if (oldText && oldText === newText) return;
        if (!oldText) {
            marker.textContent = newText;
            marker.classList.add("digit-animating");
            setTimeout(function() {
                marker.classList.remove("digit-animating");
            }, 400);
            return;
        }
        var markerType = "progress";
        if (markerClass === "myshows-remaining") markerType = "remaining"; else if (markerClass === "myshows-next-episode") markerType = "next";
        if (markerType === "progress") {
            var oldParts = oldText.split("/");
            var newParts = newText.split("/");
            if (oldParts.length === 2 && newParts.length === 2) {
                var oldWatched = parseInt(oldParts[0], 10);
                var newWatched = parseInt(newParts[0], 10);
                var oldTotal = oldParts[1];
                var newTotal = newParts[1];
                if (!isNaN(oldWatched) && !isNaN(newWatched)) if (oldTotal === newTotal && oldWatched !== newWatched) {
                    animateDigitByDigit(marker, oldWatched, newWatched, newTotal);
                    return;
                }
            }
        } else if (markerType === "remaining") {
            var oldRemaining = parseInt(oldText, 10);
            var newRemaining = parseInt(newText, 10);
            if (!isNaN(oldRemaining) && !isNaN(newRemaining) && oldRemaining !== newRemaining) {
                animateCounter(marker, oldRemaining, newRemaining, "remaining");
                return;
            }
        } else if (markerType === "next") {
            animateNextEpisode(marker, oldText, newText);
            return;
        }
        marker.textContent = newText;
        marker.classList.add("digit-animating");
        setTimeout(function() {
            marker.classList.remove("digit-animating");
        }, 400);
    }
    function updateAllMyShowsCards(showName, showMyshowsId, newProgressMarker, newNextEpisode, newRemainingMarker) {
        var cards = document.querySelectorAll(".card");
        var showNameLower = showName ? showName.toLowerCase() : "";
        cards.forEach(function(cardElement) {
            var cardData = cardElement.card_data;
            if (!cardData) return;
            var cardName = getCardName(cardData) || "";
            var match;
            if (showMyshowsId && cardData.myshowsId) match = cardData.myshowsId === showMyshowsId; else match = cardName.toLowerCase() === showNameLower;
            if (match) {
                cardData.myshowsId;
                if (newProgressMarker) cardData.progress_marker = newProgressMarker;
                if (newNextEpisode && typeof newNextEpisode === "string") cardData.next_episode = newNextEpisode;
                if (newRemainingMarker) cardData.remaining = newRemainingMarker;
                if (!cardElement.dataset.myshowsListeners) {
                    cardElement.addEventListener("visible", function() {
                        addProgressMarkerToCard(cardElement, cardElement.card_data);
                    });
                    cardElement.addEventListener("update", function() {
                        addProgressMarkerToCard(cardElement, cardElement.card_data);
                    });
                    cardElement.dataset.myshowsListeners = "true";
                }
                addProgressMarkerToCard(cardElement, cardData);
                var event = new Event("update");
                cardElement.dispatchEvent(event);
            }
        });
    }
    function animateDigitByDigit(container, startNum, endNum, totalEpisodes) {
        if (startNum === endNum) {
            container.classList.add("digit-animating");
            setTimeout(function() {
                container.classList.remove("digit-animating");
            }, 400);
            return;
        }
        var direction = startNum < endNum ? "up" : "down";
        var current = startNum;
        var speed = 250;
        var originalClasses = container.className;
        container.className = originalClasses + " digit-animating-active";
        var neutralBg = document.body.getAttribute("data-myshows-badge-style") === "2";
        function updateDigit() {
            container.textContent = current + "/" + totalEpisodes;
            if (neutralBg) container.style.color = direction === "up" ? "#4CAF50" : "#FF9800"; else container.style.backgroundColor = direction === "up" ? "#2E7D32" : "#EF6C00";
            setTimeout(function() {
                if (direction === "up" && current < endNum) {
                    current++;
                    setTimeout(updateDigit, speed);
                } else if (direction === "down" && current > endNum) {
                    current--;
                    setTimeout(updateDigit, speed);
                } else setTimeout(function() {
                    container.style.color = "";
                    container.style.backgroundColor = "";
                    container.className = originalClasses;
                }, 200);
            }, 80);
        }
        updateDigit();
    }
    function addNextEpisodeToExplorer(movie) {
        if (!movie || !movie.id) return;
        var showNext = getProfileSetting("myshows_badge_next", true);
        if (!(showNext === true || showNext === "true")) return;
        var isSerial = movie.number_of_seasons > 0 || movie.seasons || movie.first_air_date || movie.original_name;
        if (!isSerial) return;
        findShowInCache("unwatched_serials", "shows", movie.original_name || movie.name || movie.title, function(foundShow) {
            var nextEpisode = foundShow && foundShow.next_episode;
            var attempts = 0;
            (function tryInsert() {
                var act = Lampa.Activity.active && Lampa.Activity.active();
                if (!act || !act.movie || String(act.movie.id) !== String(movie.id)) return;
                var cardEl = document.querySelector(".activity--active .explorer-card");
                if (!cardEl) {
                    if (nextEpisode && ++attempts < 10) setTimeout(tryInsert, 300);
                    return;
                }
                var old = cardEl.querySelector(".myshows-explorer-next");
                if (!nextEpisode) {
                    if (old) old.remove();
                    return;
                }
                if (old) old.remove();
                var el = document.createElement("div");
                el.className = "myshows-explorer-next";
                el.textContent = "Следующая серия: " + nextEpisode;
                var body = cardEl.querySelector(".explorer-card__body");
                if (body) cardEl.insertBefore(el, body); else cardEl.appendChild(el);
            })();
        }, movie);
    }
    if (window.Lampa && Lampa.Player && Lampa.Player.listener) Lampa.Player.listener.follow("destroy", function() {
        if (!Lampa.Storage.get("myshows_was_watching", false)) return;
        var act = Lampa.Activity.active && Lampa.Activity.active();
        if (!act || act.component === "full" || !act.movie) return;
        var movie = act.movie;
        setTimeout(function() {
            addNextEpisodeToExplorer(movie);
        }, 3e3);
    });
    Lampa.Listener.follow("activity", function(event) {
        event.type, event.component;
        if (event.type === "start" && event.component !== "full" && event.object && event.object.movie) addNextEpisodeToExplorer(event.object.movie);
        if (event.type === "start" && event.component === "full") {
            var currentCard = event.object && event.object.card;
            if (currentCard) {
                var originalName = currentCard.original_name || currentCard.original_title || currentCard.title;
                var previousCard = Lampa.Storage.get("myshows_current_card", null);
                var wasWatching = Lampa.Storage.get("myshows_was_watching", false);
                previousCard && (previousCard.original_name || previousCard.original_title || previousCard.title), 
                currentCard.number_of_seasons > 0 || currentCard.seasons;
                Lampa.Storage.set("myshows_current_card", currentCard);
                if (previousCard && (previousCard.original_name || previousCard.original_title || previousCard.title) === originalName && wasWatching) {
                    var isSerial = currentCard.number_of_seasons > 0 || currentCard.seasons;
                    setTimeout(function() {
                        refreshFullCardStatus(isSerial, originalName, currentCard);
                    }, 3e3);
                }
            }
        }
        if (event.type === "archive" && (event.component === "main" || event.component === "category" || event.component === "myshows_all")) {
            var lastCard = Lampa.Storage.get("myshows_last_card", null);
            var currentCard = Lampa.Storage.get("myshows_current_card", null);
            var wasWatching = Lampa.Storage.get("myshows_was_watching", false);
            if (lastCard && wasWatching) {
                var originalName = lastCard.original_name || lastCard.original_title || lastCard.title;
                var lastMyshowsId = lastCard.myshowsId;
                Lampa.Storage.set("myshows_was_watching", false);
                setTimeout(function() {
                    var needle = lastMyshowsId || originalName;
                    findShowInCache("unwatched_serials", "shows", needle, function(foundShow) {
                        if (foundShow) {
                            var existingCard = findCardInMyShowsSection(originalName, foundShow.myshowsId);
                            if (existingCard && foundShow.progress_marker) updateAllMyShowsCards(originalName, foundShow.myshowsId, foundShow.progress_marker, foundShow.next_episode, foundShow.remaining); else if (!existingCard) insertNewCardIntoMyShowsSection(foundShow);
                        } else updateCompletedShowCard(originalName);
                    }, lastCard);
                }, 3e3);
            } else if (currentCard) {
                var originalName = currentCard.original_name || currentCard.original_title || currentCard.title;
                var currentMyshowsId = currentCard.myshowsId;
                findShowInCache("unwatched_serials", "shows", currentMyshowsId || originalName, function(foundShow) {
                    if (foundShow && foundShow.progress_marker) updateAllMyShowsCards(originalName, foundShow.myshowsId, foundShow.progress_marker, foundShow.next_episode, foundShow.remaining);
                }, currentCard);
            }
            localStorage.removeItem("myshows_current_card");
        }
    });
    Lampa.Listener.follow("full", function(event) {
        if (event.type === "complite" && event.data && event.data.movie) {
            var movie = event.data.movie;
            var originalName = movie.original_name || movie.name || movie.title;
            findShowInCache("unwatched_serials", "shows", originalName, function(foundShow) {
                if (!isSameFullCardOpen(movie)) return;
                if (foundShow && foundShow.progress_marker) updateFullCardMarkers(foundShow, event.body);
            }, movie);
        }
    });
    function isSameFullCardOpen(card) {
        if (!card || !card.id) return true;
        var active = Lampa.Activity.active && Lampa.Activity.active();
        if (!active || active.component !== "full") return false;
        var openCard = active.card_data || active.card || active.movie;
        if (!openCard || !openCard.id) return true;
        return String(openCard.id) === String(card.id);
    }
    function refreshFullCardStatus(isSerial, originalName, currentCard) {
        if (!originalName) return;
        if (useNpServer() && currentCard.id) {
            var mediaType = isSerial ? "tv" : "movie";
            var statusUrl = getNpBaseUrl() + "/myshows/status" + "?token=" + encodeURIComponent(getNpToken()) + "&profile_id=" + encodeURIComponent(getProfileId()) + "&tmdb_id=" + encodeURIComponent(currentCard.id) + "&media_type=" + mediaType;
            var net = new Lampa.Reguest;
            net.silent(statusUrl, function(response) {
                if (!isSameFullCardOpen(currentCard)) return;
                var cacheType = response && response.cache_type;
                var status;
                if (isSerial) if (cacheType === "watchlist") status = "later"; else if (cacheType === "watching" || cacheType === "cancelled") status = cacheType; else status = "remove"; else if (cacheType === "watched") status = "finished"; else if (cacheType === "watchlist") status = "later"; else status = "remove";
                updateButtonStates(status, !isSerial, true);
            }, function() {});
            if (isSerial) findShowInCache("unwatched_serials", "shows", originalName, function(foundShow) {
                if (!isSameFullCardOpen(currentCard)) return;
                if (foundShow && (foundShow.progress_marker || foundShow.next_episode || foundShow.remaining)) updateFullCardMarkers(foundShow); else if (!foundShow) completeFullCardMarkers(currentCard);
            }, currentCard);
            return;
        }
        if (isSerial) {
            findShowInCache("unwatched_serials", "shows", originalName, function(foundShow) {
                if (!isSameFullCardOpen(currentCard)) return;
                if (foundShow && (foundShow.progress_marker || foundShow.next_episode || foundShow.remaining)) updateFullCardMarkers(foundShow); else if (!foundShow) completeFullCardMarkers(currentCard);
            }, currentCard);
            findShowInCache("serial_status", "shows", originalName, function(foundShow) {
                if (!isSameFullCardOpen(currentCard)) return;
                if (foundShow) updateButtonStates(foundShow.watchStatus, false, true);
            });
        } else findShowInCache("movie_status", "movies", originalName, function(foundMovie) {
            if (!isSameFullCardOpen(currentCard)) return;
            if (foundMovie) updateButtonStates(foundMovie.watchStatus, true, true);
        });
    }
    function updateFullCardMarkers(showData, bodyElement) {
        var posterElement = bodyElement ? bodyElement.find(".full-start-new__poster") : $(".full-start-new__poster");
        if (!posterElement.length) return;
        var posterDom = posterElement[0];
        var existingProgress = posterDom.querySelector(".myshows-progress");
        var existingRemaining = posterDom.querySelector(".myshows-remaining");
        var existingNext = posterDom.querySelector(".myshows-next-episode");
        function addMarker(cls, text) {
            var el = document.createElement("div");
            el.className = cls;
            el.textContent = text;
            posterDom.appendChild(el);
            setTimeout(function() {
                el.style.opacity = "0";
                el.style.transform = "translateY(10px)";
                el.style.transition = "all 0.4s ease";
                setTimeout(function() {
                    el.style.opacity = "1";
                    el.style.transform = "translateY(0)";
                }, 10);
                setTimeout(function() {
                    el.style.transition = "";
                }, 410);
            }, 50);
        }
        var showProgress = getProfileSetting("myshows_badge_progress", true);
        var showRemaining = getProfileSetting("myshows_badge_remaining", true);
        var showNext = getProfileSetting("myshows_badge_next", true);
        if (showData.progress_marker && (showProgress === true || showProgress === "true")) if (existingProgress) animateFullCardMarker(existingProgress, showData.progress_marker, "progress"); else addMarker("myshows-progress", showData.progress_marker); else if (existingProgress) existingProgress.remove();
        if (showData.remaining !== void 0 && showData.remaining !== null && (showRemaining === true || showRemaining === "true")) if (existingRemaining) animateFullCardMarker(existingRemaining, showData.remaining.toString(), "remaining"); else addMarker("myshows-remaining", showData.remaining); else if (existingRemaining) existingRemaining.remove();
        if (showData.next_episode && (showNext === true || showNext === "true")) if (existingNext) animateFullCardMarker(existingNext, showData.next_episode, "next"); else addMarker("myshows-next-episode", showData.next_episode); else if (existingNext) existingNext.remove();
    }
    function completeFullCardMarkers(currentCard) {
        if (currentCard && !isSameFullCardOpen(currentCard)) return;
        var posterElement = $(".full-start-new__poster");
        if (!posterElement.length) return;
        var posterDom = posterElement[0];
        var progress = posterDom.querySelector(".myshows-progress");
        var remaining = posterDom.querySelector(".myshows-remaining");
        var next = posterDom.querySelector(".myshows-next-episode");
        if (!progress && !remaining && !next) return;
        if (progress) {
            var parts = (progress.textContent || "").split("/");
            if (parts.length === 2 && parts[1]) animateFullCardMarker(progress, parts[1] + "/" + parts[1], "progress");
        }
        if (remaining) animateFullCardMarker(remaining, "0", "remaining");
        setTimeout(function() {
            [ progress, remaining, next ].forEach(function(el) {
                if (!el || !el.parentNode) return;
                el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
                el.style.opacity = "0";
                el.style.transform = "translateY(10px)";
                setTimeout(function() {
                    if (el.parentNode) el.remove();
                }, 500);
            });
        }, 1600);
    }
    function removeUnwatchedTraces(card) {
        if (!card) return;
        var showName = card.original_name || card.original_title || card.title || card.name;
        var myshowsId = card.myshowsId;
        var poster = $(".full-start-new__poster")[0];
        if (poster) [ ".myshows-progress", ".myshows-remaining", ".myshows-next-episode" ].forEach(function(sel) {
            var el = poster.querySelector(sel);
            if (!el) return;
            el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
            el.style.opacity = "0";
            el.style.transform = "translateY(10px)";
            setTimeout(function() {
                if (el.parentNode) el.remove();
            }, 400);
        });
        removeMarkersFromAllCards(showName, myshowsId);
        var cardEl = findCardInMyShowsSection(showName, myshowsId);
        if (cardEl) {
            var parentSection = cardEl.closest(".items-line");
            var allCards = parentSection ? parentSection.querySelectorAll(".card") : [];
            var idx = [].slice.call(allCards).indexOf(cardEl);
            removeCompletedCard(cardEl, showName, parentSection, idx);
        }
    }
    function addUnwatchedTraces(card, attempt) {
        if (!card) return;
        attempt = attempt || 0;
        var showName = card.original_name || card.original_title || card.title || card.name;
        var needle = card.myshowsId || showName;
        findShowInCache("unwatched_serials", "shows", needle, function(foundShow) {
            if (foundShow && (foundShow.progress_marker || foundShow.next_episode || foundShow.remaining)) {
                if (isSameFullCardOpen(card)) updateFullCardMarkers(foundShow);
                updateAllMyShowsCards(showName, foundShow.myshowsId, foundShow.progress_marker, foundShow.next_episode, foundShow.remaining);
                if (!findCardInMyShowsSection(showName, foundShow.myshowsId)) insertNewCardIntoMyShowsSection(foundShow);
            } else if (attempt < 6) setTimeout(function() {
                addUnwatchedTraces(card, attempt + 1);
            }, 2e3);
        }, card);
    }
    function removeMarkersFromAllCards(showName, showMyshowsId) {
        var cards = document.querySelectorAll(".card");
        var showNameLower = showName ? showName.toLowerCase() : "";
        var n = 0;
        cards.forEach(function(cardElement) {
            var cardData = cardElement.card_data;
            if (!cardData) return;
            var cardName = getCardName(cardData) || "";
            var match = showMyshowsId && cardData.myshowsId ? cardData.myshowsId === showMyshowsId : cardName.toLowerCase() === showNameLower;
            if (!match) return;
            cardData.progress_marker = null;
            cardData.next_episode = null;
            cardData.remaining = null;
            var cardView = cardElement.querySelector(".card__view");
            if (!cardView) return;
            [ ".myshows-progress", ".myshows-remaining", ".myshows-next-episode" ].forEach(function(sel) {
                var el = cardView.querySelector(sel);
                if (!el) return;
                el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
                el.style.opacity = "0";
                el.style.transform = "translateY(10px)";
                setTimeout(function() {
                    if (el.parentNode) el.remove();
                }, 400);
            });
            n++;
        });
        if (n) ;
    }
    function animateFullCardMarker(markerElement, newValue, markerType) {
        var oldValue = markerElement.textContent || "";
        if (oldValue === newValue) return;
        if (!oldValue.trim()) {
            markerElement.textContent = newValue;
            markerElement.classList.add("digit-animating");
            setTimeout(function() {
                markerElement.classList.remove("digit-animating");
            }, 400);
            return;
        }
        if (markerType === "progress") {
            var oldParts = oldValue.split("/");
            var newParts = newValue.split("/");
            if (oldParts.length === 2 && newParts.length === 2) {
                var oldWatched = parseInt(oldParts[0], 10);
                var newWatched = parseInt(newParts[0], 10);
                var oldTotal = oldParts[1];
                var newTotal = newParts[1];
                if (!isNaN(oldWatched) && !isNaN(newWatched) && oldTotal === newTotal && oldWatched !== newWatched) {
                    animateDigitByDigit(markerElement, oldWatched, newWatched, newTotal);
                    return;
                }
            }
        } else if (markerType === "remaining") {
            var oldRemaining = parseInt(oldValue, 10);
            var newRemaining = parseInt(newValue, 10);
            if (!isNaN(oldRemaining) && !isNaN(newRemaining) && oldRemaining !== newRemaining) {
                animateCounter(markerElement, oldRemaining, newRemaining, "remaining");
                return;
            }
        } else if (markerType === "next") {
            animateNextEpisode(markerElement, oldValue, newValue);
            return;
        }
        markerElement.textContent = newValue;
        markerElement.classList.add("digit-animating");
        setTimeout(function() {
            markerElement.classList.remove("digit-animating");
        }, 400);
    }
    function animateCounter(container, startNum, endNum, type) {
        if (startNum === endNum) {
            container.classList.add("counter-pulse");
            setTimeout(function() {
                container.classList.remove("counter-pulse");
            }, 400);
            return;
        }
        var direction = startNum < endNum ? "up" : "down";
        var current = startNum;
        var speed = 250;
        function updateCounter() {
            container.textContent = current;
            setTimeout(function() {
                if (direction === "up" && current < endNum) {
                    current++;
                    setTimeout(updateCounter, speed);
                } else if (direction === "down" && current > endNum) {
                    current--;
                    setTimeout(updateCounter, speed);
                }
            }, 80);
        }
        updateCounter();
    }
    function animateNextEpisode(container, oldEpisode, newEpisode) {
        var oldTrimmed = (oldEpisode || "").toString().trim();
        var newTrimmed = (newEpisode || "").toString().trim();
        if (oldTrimmed === newTrimmed) return;
        var oldMatch = oldTrimmed.match(/S(\d+)\/E(\d+)/);
        var newMatch = newTrimmed.match(/S(\d+)\/E(\d+)/);
        if (!oldMatch || !newMatch) {
            simpleUpdate(container, newTrimmed);
            return;
        }
        var oldSeason = parseInt(oldMatch[1], 10);
        var oldEpNum = parseInt(oldMatch[2], 10);
        var newSeason = parseInt(newMatch[1], 10);
        var newEpNum = parseInt(newMatch[2], 10);
        if (newSeason < oldSeason) {
            countDownEpisodes(container, oldSeason, oldEpNum, newSeason, newEpNum);
            return;
        }
        if (newSeason > oldSeason) {
            animateSeasonTransition(container, oldSeason, oldEpNum, newSeason, newEpNum);
            return;
        }
        if (oldSeason === newSeason && oldEpNum !== newEpNum) {
            if (oldEpNum < newEpNum) animateInSameSeason(container, oldSeason, oldEpNum, newEpNum, "forward"); else animateInSameSeason(container, oldSeason, oldEpNum, newEpNum, "backward");
            return;
        }
        simpleUpdate(container, newTrimmed);
    }
    function countDownEpisodes(container, oldSeason, oldEpNum, newSeason, newEpNum) {
        var currentSeason = oldSeason;
        var currentEp = oldEpNum;
        var speed = 250;
        function update() {
            var seasonStr = "S" + padTwo(currentSeason);
            var epStr = "E" + padTwo(currentEp);
            container.textContent = seasonStr + "/" + epStr;
            setTimeout(function() {
                if (currentSeason === oldSeason && currentEp > 1) {
                    currentEp--;
                    setTimeout(update, speed);
                } else if (currentSeason === oldSeason && currentEp === 1 && newSeason < oldSeason) {
                    currentSeason--;
                    currentEp = 1;
                    setTimeout(update, speed);
                } else if (currentSeason === newSeason && currentEp < newEpNum) {
                    currentEp++;
                    setTimeout(update, speed);
                } else if (currentSeason === newSeason && currentEp > newEpNum) {
                    currentEp--;
                    setTimeout(update, speed);
                }
            }, 80);
        }
        update();
    }
    function simpleUpdate(container, text) {
        container.textContent = text;
        container.classList.add("digit-animating");
        setTimeout(function() {
            container.classList.remove("digit-animating");
        }, 400);
    }
    function animateSeasonTransition(container, oldSeason, oldEpNum, newSeason, newEpNum) {
        var speed = 250;
        var currentSeason = oldSeason;
        var currentEp = oldEpNum;
        function update() {
            var seasonStr = "S" + padTwo(currentSeason);
            var epStr = "E" + padTwo(currentEp);
            container.textContent = seasonStr + "/" + epStr;
            setTimeout(function() {
                if (currentSeason < newSeason) {
                    currentSeason++;
                    currentEp = 1;
                    setTimeout(update, speed);
                } else if (currentSeason === newSeason && currentEp < newEpNum) {
                    currentEp++;
                    setTimeout(update, speed);
                }
            }, 80);
        }
        update();
    }
    function animateInSameSeason(container, season, startEp, endEp, direction) {
        var seasonPrefix = "S" + padTwo(season) + "/E";
        var current = startEp;
        var speed = 250;
        function update() {
            var epStr = padTwo(current);
            var fullText = seasonPrefix + epStr;
            container.textContent = fullText;
            setTimeout(function() {
                var shouldContinue = false;
                if (direction === "forward" && current < endEp) {
                    current++;
                    shouldContinue = true;
                } else if (direction === "backward" && current > endEp) {
                    current--;
                    shouldContinue = true;
                }
                if (shouldContinue) setTimeout(update, speed);
            }, 80);
        }
        update();
    }
    function updateCompletedShowCard(showName, showMyshowsId) {
        var cards = document.querySelectorAll(".card");
        var showNameLower = showName ? showName.toLowerCase() : "";
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var cardData = cardElement.card_data || {};
            var match;
            if (showMyshowsId && cardData.myshowsId) match = cardData.myshowsId === showMyshowsId; else {
                var cardName = getCardName(cardData) || "";
                match = cardName.toLowerCase() === showNameLower;
            }
            if (match && cardData.progress_marker) {
                cardElement.dataset.removing = "true";
                var releasedEpisodes = cardData.released_count;
                var totalEpisodes = cardData.total_count;
                if (releasedEpisodes) {
                    var newProgressMarker = releasedEpisodes + "/" + releasedEpisodes;
                    cardData.progress_marker = newProgressMarker;
                    updateCardWithAnimation(cardElement, newProgressMarker, "myshows-progress");
                    cardData.remaining = 0;
                    updateCardWithAnimation(cardElement, "0", "myshows-remaining");
                    var parentSection = cardElement.closest(".items-line");
                    var allCards = parentSection.querySelectorAll(".card");
                    var currentIndex = [].slice.call(allCards).indexOf(cardElement);
                    setTimeout(function() {
                        removeCompletedCard(cardElement, showName, parentSection, currentIndex);
                    }, 3e3);
                }
                break;
            }
        }
    }
    function removeCompletedCard(cardElement, showName, parentSection, cardIndex) {
        var isCurrentlyFocused = cardElement.classList.contains("focus");
        var nextCard = null;
        if (isCurrentlyFocused) {
            var allCards = parentSection.querySelectorAll(".card");
            if (cardIndex < allCards.length - 1) nextCard = allCards[cardIndex + 1]; else if (cardIndex > 0) nextCard = allCards[cardIndex - 1];
        }
        cardElement.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        cardElement.style.opacity = "0";
        setTimeout(function() {
            if (cardElement && cardElement.parentNode) {
                cardElement.remove();
                if (nextCard && window.Lampa && window.Lampa.Controller) setTimeout(function() {
                    Lampa.Controller.collectionSet(parentSection);
                    Lampa.Controller.collectionFocus(nextCard, parentSection);
                }, 50); else if (isCurrentlyFocused) setTimeout(function() {
                    if (window.Lampa && window.Lampa.Controller) Lampa.Controller.collectionSet(parentSection);
                }, 50);
            }
        }, 500);
    }
    function findMyShowsSection() {
        var titleElements = document.querySelectorAll(".items-line__title");
        for (var i = 0; i < titleElements.length; i++) {
            var titleText = titleElements[i].textContent || titleElements[i].innerText;
            if (titleText.indexOf("MyShows") !== -1) return titleElements[i].closest(".items-line");
        }
        return null;
    }
    function getCardName(cardData) {
        if (!cardData) return "";
        return cardData.original_title || cardData.original_name || cardData.name || cardData.title;
    }
    function findCardInMyShowsSection(showName, showMyshowsId) {
        var section = findMyShowsSection();
        if (!section) return null;
        var showNameLower = showName ? showName.toLowerCase() : "";
        var cards = section.querySelectorAll(".card");
        for (var i = 0; i < cards.length; i++) {
            var cardElement = cards[i];
            var cardData = cardElement.card_data || {};
            if (showMyshowsId && cardData.myshowsId) {
                if (cardData.myshowsId === showMyshowsId) return cardElement;
            } else {
                var cardName = getCardName(cardData) || "";
                if (cardName.toLowerCase() === showNameLower) return cardElement;
            }
        }
        return null;
    }
    function insertNewCardIntoMyShowsSection(showData, retryCount) {
        if (showData && showData._renderToken !== void 0 && showData._renderToken !== _profileRenderToken) return;
        if (showData && !showData.release_date && showData.first_air_date) showData.release_date = showData.first_air_date;
        showData.name || showData.title, showData.progress_marker, showData.remaining, showData.next_episode;
        if (typeof retryCount === "undefined") retryCount = 0;
        if (retryCount > 5) {
            showData.name || showData.title;
            return;
        }
        var titleElements = document.querySelectorAll(".items-line__title");
        var targetSection = null;
        for (var i = 0; i < titleElements.length; i++) {
            var titleText = titleElements[i].textContent || titleElements[i].innerText;
            if (titleText.indexOf("MyShows") !== -1) {
                targetSection = titleElements[i].closest(".items-line");
                break;
            }
        }
        if (!targetSection) {
            setTimeout(function() {
                insertNewCardIntoMyShowsSection(showData, retryCount + 1);
            }, 500);
            return;
        }
        var scrollElement = targetSection.querySelector(".scroll");
        if (!scrollElement) return;
        if (!scrollElement.Scroll) {
            setTimeout(function() {
                insertNewCardIntoMyShowsSection(showData, retryCount + 1);
            }, 500);
            return;
        }
        var scroll = scrollElement.Scroll;
        try {
            var newCard = Lampa.Maker.make("Card", showData, function(module) {
                return module.only("Card", "Release", "Callback");
            });
            newCard.use({
                onEnter: function(html, data) {
                    Lampa.Activity.push({
                        url: data.url,
                        component: "full",
                        id: data.id,
                        method: "tv",
                        card: data,
                        source: "tmdb"
                    });
                },
                onVisible: function() {
                    addProgressMarkerToCard(this.html, this.data);
                },
                onUpdate: function() {
                    addProgressMarkerToCard(this.html, this.data);
                }
            });
            newCard.create();
            var cardElement = newCard.render(true);
            if (cardElement) {
                var domEl = cardElement[0] || cardElement;
                domEl.card_data = showData;
                scroll.append(cardElement);
                reorderCardsInMyShowsSection();
                addProgressMarkerToCard(cardElement, showData);
                newCard.visible();
                if (window.Lampa && window.Lampa.Controller) window.Lampa.Controller.collectionAppend(cardElement);
            }
        } catch (error) {}
    }
    function addProgressMarkerStyles() {
        var style = document.createElement("style");
        style.textContent = [ ".myshows-progress {", "    position: absolute; left: 0em; bottom: 0em;", "    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 0.5em;", "    font-weight: bold; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.15);", "    background: #4CAF50; color: #fff;", "    transition: all 0.3s ease, transform 0.15s ease !important;", "    will-change: transform, color, background-color;", "}", "@keyframes digitFlip {", "    0%   { transform: translateY(0) scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }", "    50%  { transform: scale(1); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }", "    100% { transform: translateY(0) scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }", "}", "@keyframes pulse {", "    0%   { transform: scale(1); }", "    50%  { transform: scale(1); }", "    100% { transform: scale(1); }", "}", ".digit-animating { animation: digitFlip 0.6s ease; }", ".marker-update   { animation: pulse 0.6s ease; }", ".counter-animating { animation: counterPulse 0.8s ease; }", "@keyframes counterPulse {", "    0%   { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }", "    25%  { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.25); }", "    50%  { transform: scale(1); box-shadow: 0 3px 10px rgba(0,0,0,0.2); }", "    100% { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }", "}", ".myshows-remaining {", "    position: absolute; right: 0em; top: 0em;", "    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 1em;", "    font-weight: bold; z-index: 2;", "    background: rgba(0,0,0,0.5); color: #fff; transition: all 0.3s ease;", "}", ".myshows-next-episode {", "    position: absolute; left: 0em; bottom: 1.5em;", "    padding: 0.2em 0.4em; font-size: 1.2em; border-radius: 0.5em;", "    font-weight: bold; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.15);", "    letter-spacing: 0.04em; line-height: 1.1;", "    background: #2196F3; color: #fff; transition: all 0.3s ease;", "}", ".myshows-explorer-next {", "    margin: 0 0 1em;", "    font-size: 1.15em; font-weight: 300;", "}", ".full-start-new__poster { position: relative; }", ".full-start-new__poster .myshows-progress,", ".full-start-new__poster .myshows-next-episode {", "    position: absolute; left: 0.5em; z-index: 3;", "}", ".full-start-new__poster .myshows-progress,", ".full-start-new__poster .myshows-remaining,", ".full-start-new__poster .myshows-next-episode {", "    transition: all 0.3s ease !important;", "    will-change: transform, color, background-color;", "}", ".full-start-new__poster .myshows-progress.digit-animating,", ".full-start-new__poster .myshows-remaining.digit-animating,", ".full-start-new__poster .myshows-next-episode.digit-animating {", "    animation: digitFlip 0.6s ease;", "}", ".full-start-new__poster .marker-update { animation: gentlePulse 0.6s ease; }", "@keyframes gentlePulse {", "    0%   { transform: scale(1); }", "    50%  { transform: scale(1); }", "    100% { transform: scale(1); }", "}", ".full-start-new__poster .myshows-progress    { bottom: 0.5em; }", ".full-start-new__poster .myshows-next-episode { bottom: 2em; }", "body.true--mobile.orientation--portrait .full-start-new__poster .myshows-progress    { bottom: 15em; }", "body.true--mobile.orientation--portrait .full-start-new__poster .myshows-next-episode { bottom: 17em; }", "body.true--mobile.orientation--landscape .full-start-new__poster .myshows-progress    { bottom: 2.5em; }", "body.true--mobile.orientation--landscape .full-start-new__poster .myshows-next-episode { bottom: 4em; }", "@media screen and (min-width: 580px) and (max-width: 1024px) {", "    body.true--mobile .full-start-new__poster .myshows-progress    { bottom: 2.5em; font-size: 1.1em; }", "    body.true--mobile .full-start-new__poster .myshows-next-episode { bottom: 4em;   font-size: 1.1em; }", "}", "body.glass--style.platform--browser .card .myshows-progress,", "body.glass--style.platform--nw .card .myshows-progress,", "body.glass--style.platform--apple .card .д-progress {", "    background-color: rgba(76,175,80,0.8);", "    -webkit-backdrop-filter: blur(1em); backdrop-filter: blur(1em);", "}", "body.glass--style.platform--browser .card .myshows-next-episode,", "body.glass--style.platform--nw .card .myshows-next-episode,", "body.glass--style.platform--apple .card .myshows-next-episode {", "    background-color: rgba(33,150,243,0.8);", "    -webkit-backdrop-filter: blur(1em); backdrop-filter: blur(1em);", "}", ".myshows-progress.marker-update,", ".myshows-next-episode.marker-update { font-weight: 900; animation: gentleAppear 0.4s ease; }", "@keyframes gentleAppear {", "    0%   { opacity: 0; transform: translateY(10px); }", "    100% { opacity: 1; transform: translateY(0); }", "}", "@keyframes gentlePulse {", "    0%   { transform: scale(1); }", "    50%  { transform: scale(1); }", "    100% { transform: scale(1); }", "}", ".scale-animation { animation: gentlePulse 0.6s ease; }", 'body[data-myshows-badge-style="2"] .card .myshows-next-episode,', 'body[data-myshows-badge-style="2"] .full-start-new__poster .myshows-next-episode {', "    left: 0; bottom: 0; border-radius: 0 0.83em;", "    background: rgba(0,0,0,0.5); box-shadow: none;", "}", 'body[data-myshows-badge-style="2"] .card .myshows-progress,', 'body[data-myshows-badge-style="2"] .full-start-new__poster .myshows-progress {', "    left: auto; right: 0; bottom: 0; border-radius: 0.83em 0;", "    background: rgba(0,0,0,0.5); box-shadow: none;", "}", 'body[data-myshows-badge-style="2"].glass--style .card .myshows-progress,', 'body[data-myshows-badge-style="2"].glass--style .card .myshows-next-episode {', "    background-color: rgba(0,0,0,0.5);", "    -webkit-backdrop-filter: none; backdrop-filter: none;", "}", 'body[data-myshows-badge-style="2"] .card .myshows-remaining,', 'body[data-myshows-badge-style="2"] .full-start-new__poster .myshows-remaining {', "    right: 0; top: 0; border-radius: 0 0.83em;", "}", 'body[data-myshows-badge-style="2"][data-status-badge-style="2"] .card .view--has-status .myshows-remaining {', "    top: 1.25em; border-radius: 0.83em 0 0 0.83em;", "}", 'body[data-myshows-badge-style="2"] .card .card__quality {', "    left: 0; border-radius: 0 0.75em 0.75em 0;", "}", 'body[data-myshows-badge-style="2"] .card .card__vote {', "    right: 0; bottom: 1.5em; left: auto; top: auto;", "    padding: 0.2em 0.4em; font-size: 1.2em; font-weight: bold;", "    background: rgba(0,0,0,0.5); color: #fff;", "    border-radius: 0.83em 0 0 0.83em;", "}", 'body[data-myshows-badge-style="2"].true--mobile.orientation--portrait .full-start-new__poster .myshows-next-episode { bottom: 15em; }', 'body[data-myshows-badge-style="2"].true--mobile.orientation--landscape .full-start-new__poster .myshows-next-episode { bottom: 2.5em; }', "@media screen and (min-width: 580px) and (max-width: 1024px) {", '    body[data-myshows-badge-style="2"].true--mobile .full-start-new__poster .myshows-next-episode { bottom: 2.5em; font-size: 1.1em; }', "}" ].join("\n");
        document.head.appendChild(style);
    }
    function addMyShowsData(data, oncomplite) {
        if (getProfileSetting("myshows_view_in_main", true)) {
            var token = getProfileSetting("myshows_token", "");
            if (token) {
                var startProfile = getProfileId();
                getUnwatchedShowsWithDetails(function(result) {
                    if (getProfileId() === startProfile && result && result.shows && result.shows.length > 0) {
                        var PAGE_SIZE = 20;
                        var myshowsCategory = {
                            title: "Непросмотренные сериалы (MyShows)",
                            results: result.shows.slice(0, PAGE_SIZE),
                            source: "tmdb",
                            url: "myshows://unwatched",
                            line_type: "myshows_unwatched",
                            total_pages: Math.ceil(result.shows.length / PAGE_SIZE)
                        };
                        window.myShowsData = myshowsCategory;
                        myShowsData = myshowsCategory;
                        data.unshift(myshowsCategory);
                    }
                    oncomplite(data);
                });
                return true;
            }
        }
        oncomplite(data);
        return false;
    }
    function patchActivityForMyShows() {
        if (window._myshows_activity_patched) return;
        window._myshows_activity_patched = true;
        var originalPush = Lampa.Activity.push;
        Lampa.Activity.push = function(params) {
            if (params && params.url === "myshows://unwatched") return originalPush.call(this, {
                component: "myshows_unwatched",
                title: params.title || "Непросмотренные сериалы (MyShows)",
                page: params.page || 1
            });
            return originalPush.call(this, params);
        };
    }
    function addMyShowsToTMDB() {
        if (window._myshows_tmdb_patched) return;
        window._myshows_tmdb_patched = true;
        var originalTMDBMain = Lampa.Api.sources.tmdb.main;
        Lampa.Api.sources.tmdb.main = function(params, oncomplite, onerror) {
            return originalTMDBMain.call(this, params, function(data) {
                addMyShowsData(data, oncomplite);
            }, onerror);
        };
    }
    function addMyShowsToCUB() {
        if (window._myshows_cub_patched) return;
        window._myshows_cub_patched = true;
        var originalCUBMain = Lampa.Api.sources.cub.main;
        Lampa.Api.sources.cub.main = function(params, oncomplite, onerror) {
            var originalLoadPart = originalCUBMain.call(this, params, function(data) {
                addMyShowsData(data, oncomplite);
            }, onerror);
            return originalLoadPart;
        };
    }
    function createMyShowsButtons(e, currentStatus, isMovie) {
        if (!e || !e.object || !e.object.activity) return;
        var container = e.object.activity.render().find(".full-start-new__buttons");
        if (!container.length) return;
        if (container.data("myshows-initialized")) return;
        container.data("myshows-initialized", true);
        if (container.find(".myshows-btn").length) {
            container.data("myshows-initialized", true);
            return;
        }
        var buttonsConfig = isMovie ? [ {
            title: "Просмотрел",
            status: "finished"
        }, {
            title: "Буду смотреть",
            status: "later"
        }, {
            title: "Не смотрел",
            status: "remove"
        } ] : [ {
            title: "Смотрю",
            status: "watching"
        }, {
            title: "Буду смотреть",
            status: "later"
        }, {
            title: "Перестал смотреть",
            status: "cancelled"
        }, {
            title: "Не смотрю",
            status: "remove"
        } ];
        var statusToClass = {
            watching: "myshows-watching",
            later: "myshows-scheduled",
            cancelled: "myshows-thrown",
            remove: "myshows-cancelled",
            finished: "myshows-movie-watched",
            later_movie: "myshows-movie-later",
            remove_movie: "myshows-movie-remove"
        };
        var statusToIcon = {
            watching: watch_icon,
            finished: watch_icon,
            later: later_icon,
            later_movie: later_icon,
            cancelled: cancelled_icon,
            remove: remove_icon,
            remove_movie: remove_icon
        };
        buttonsConfig.forEach(function(buttonData) {
            var statusKey = buttonData.status;
            if (isMovie) {
                if (buttonData.status === "later") statusKey = "later_movie";
                if (buttonData.status === "remove") statusKey = "remove_movie";
            }
            var buttonClass = statusToClass[statusKey];
            var buttonIcon = statusToIcon[statusKey];
            var isActive = currentStatus === buttonData.status;
            var activeClass = isActive ? " myshows-active" : "";
            var btn = $('<div class="full-start__button selector myshows-btn ' + buttonClass + activeClass + '">' + buttonIcon + "<span>" + buttonData.title + "</span>" + "</div>");
            btn.on("hover:enter", function() {
                var activeStatus = getCardStatusCache(e.data.movie.id, isMovie) || "remove";
                if (activeStatus === buttonData.status) {
                    buttonData.title;
                    updateButtonStates(buttonData.status, isMovie, false);
                    return;
                }
                updateButtonStates(null, isMovie, false);
                var setStatusFunction = isMovie ? setMyShowsMovieStatus : setMyShowsStatus;
                setStatusFunction(e.data.movie, buttonData.status, function(success) {
                    if (success) {
                        Lampa.Noty.show('Статус "' + buttonData.title + '" установлен на MyShows');
                        updateButtonStates(buttonData.status, isMovie, false);
                        if (!isMovie && activeStatus === "watching" && buttonData.status !== "watching") removeUnwatchedTraces(e.data.movie);
                        if (!isMovie && activeStatus !== "watching" && buttonData.status === "watching") addUnwatchedTraces(e.data.movie);
                    } else {
                        Lampa.Noty.show("Ошибка установки статуса");
                        updateButtonStates(currentStatus, isMovie, false);
                    }
                });
            });
            if (!isMovie) e.object.activity.render().find(".full-start-new__buttons").addClass("myshows-btn-series");
            e.object.activity.render().find(".full-start-new__buttons").append(btn);
        });
        if (window.Lampa && window.Lampa.Controller) {
            var container = e.object.activity.render().find(".full-start-new__buttons");
            var allButtons = container.find("> *").filter(function() {
                return $(this).is(":visible");
            });
            Lampa.Controller.collectionSet(container);
            if (allButtons.length > 0) Lampa.Controller.collectionFocus(allButtons.eq(0)[0], container);
        }
    }
    function updateButtonStates(newStatus, isMovie, useAnimation) {
        var selector = '.full-start__button[class*="myshows-"]';
        var statusMap = isMovie ? {
            finished: "myshows-movie-watched",
            later: "myshows-movie-later",
            remove: "myshows-movie-remove"
        } : {
            watching: "myshows-watching",
            later: "myshows-scheduled",
            cancelled: "myshows-thrown",
            remove: "myshows-cancelled"
        };
        var buttons = document.querySelectorAll(selector);
        buttons.forEach(function(button) {
            var svg = button.querySelector("svg");
            button.classList.remove("myshows-active");
            if (useAnimation && svg) svg.style.transition = "color 0.5s ease, filter 0.5s ease";
            if (newStatus && statusMap[newStatus] && button.classList.contains(statusMap[newStatus])) button.classList.add("myshows-active");
        });
    }
    function getShowStatus(showId, callback) {
        loadCacheFromServer("serial_status", "shows", function(showsData) {
            if (showsData && showsData.shows) {
                var numericShowId = parseInt(showId);
                var userShow = null;
                for (var _ui = 0; _ui < showsData.shows.length; _ui++) if (showsData.shows[_ui].id === numericShowId) {
                    userShow = showsData.shows[_ui];
                    break;
                }
                callback(userShow ? userShow.watchStatus : "remove");
            } else callback("remove");
        });
    }
    function addMyShowsButtonStyles() {
        if (getProfileSetting("myshows_button_view", true) && getProfileSetting("myshows_token", false)) {
            var style = document.createElement("style");
            style.textContent = [ '.full-start__button[class*="myshows-"] svg { transition: color 0.5s ease, filter 0.5s ease; }', ".full-start__button.myshows-watching.myshows-active svg  { color: #FFC107; filter: drop-shadow(0 0 3px rgba(255,193,7,0.8)); }", ".full-start__button.myshows-scheduled.myshows-active svg { color: #2196F3; filter: drop-shadow(0 0 3px rgba(33,150,243,0.8)); }", ".full-start__button.myshows-thrown.myshows-active svg    { color: #FF9800; filter: drop-shadow(0 0 3px rgba(255,152,0,0.8)); }", ".full-start__button.myshows-cancelled.myshows-active svg { color: #F44336; filter: drop-shadow(0 0 3px rgba(244,67,54,0.8)); }", ".full-start__button.myshows-movie-watched.myshows-active svg { color: #4CAF50; filter: drop-shadow(0 0 3px rgba(76,175,80,0.8)); }", ".full-start__button.myshows-movie-later.myshows-active svg  { color: #2196F3; filter: drop-shadow(0 0 3px rgba(33,150,243,0.8)); }", ".full-start__button.myshows-movie-remove.myshows-active svg { color: #F44336; filter: drop-shadow(0 0 3px rgba(244,67,54,0.8)); }", "@media screen and (max-width: 580px) {", "    .full-start-new__buttons { flex-wrap: nowrap; }", "    .full-start-new__buttons.myshows-btn-series { flex-wrap: wrap; }", "    .full-start-new__buttons.myshows-btn-series::after {", '        content: ""; flex-basis: 100%; width: 100%; order: 1; margin-bottom: 0.75em;', "    }", "    .full-start-new__buttons.myshows-btn-series .myshows-btn { order: 2; }", "}" ].join("\n");
            document.head.appendChild(style);
        }
    }
    function getStatusByTitle(title, isMovie, callback) {
        var cacheType = isMovie ? "movie_status" : "serial_status";
        var dataKey = isMovie ? "movies" : "shows";
        var statusField = isMovie ? "watchStatus" : "watchStatus";
        loadCacheFromServer(cacheType, dataKey, function(cachedData) {
            if (cachedData && cachedData[dataKey]) {
                var items = cachedData[dataKey];
                var foundItem = null;
                var _tl = title ? title.toLowerCase() : "";
                for (var _it = 0; _it < items.length; _it++) {
                    var _item = items[_it];
                    if (_item.title === title || _item.titleOriginal === title || _item.title && _item.title.toLowerCase() === _tl || _item.titleOriginal && _item.titleOriginal.toLowerCase() === _tl) {
                        foundItem = _item;
                        break;
                    }
                }
                callback(foundItem ? foundItem[statusField] : "remove");
            } else callback("remove");
        });
    }
    function addToHistory(contentData) {
        Lampa.Favorite.add("history", contentData);
    }
    function Movies(body, callback) {
        makeMyShowsJSONRPCRequest(body, {}, function(success, movies) {
            if (success && movies && movies.result) {
                callback(movies);
                return;
            } else {
                callback(null);
                return;
            }
        });
    }
    function getWatchedMovies(callback) {
        var body = "profile.WatchedMovies";
        Movies(body, function(movies) {
            if (movies && movies.result) {
                callback(movies);
                return;
            } else callback(null);
        });
    }
    function getUnwatchedMovies(callback) {
        var body = "profile.UnwatchedMovies";
        Movies(body, function(movies) {
            if (movies && movies.result) {
                callback(movies);
                return;
            } else callback(null);
        });
    }
    function fetchStatusMovies(callback) {
        var startProfile = getProfileId();
        getWatchedMovies(function(watchedData) {
            getUnwatchedMovies(function(unwatchedData) {
                var movies = [];
                processMovieData(watchedData, "finished", movies);
                processMovieData(unwatchedData, "later", movies);
                var statusData = {
                    movies: movies,
                    timestamp: Date.now()
                };
                saveCacheToServer(statusData, "movie_status", function(result) {
                    callback(getProfileId() === startProfile ? result : null);
                }, startProfile);
            });
        });
    }
    function processMovieData(movieData, defaultStatus, targetArray) {
        if (movieData && movieData.result && Array.isArray(movieData.result)) movieData.result.forEach(function(item) {
            if (item && item.id) targetArray.push({
                id: item.id,
                title: item.title,
                titleOriginal: item.titleOriginal,
                watchStatus: item.userMovie && item.userMovie.watchStatus ? item.userMovie.watchStatus : defaultStatus
            });
        });
    }
    function syncMyShows(callback) {
        syncInProgress = true;
        var screensaver = Lampa.Storage.get("screensaver", "true");
        Lampa.Storage.set("screensaver", "false");
        var allTimecodes = [];
        watchedMoviesData(function(movies, error) {
            if (error) {
                if (callback) callback(false, "Ошибка синхронизации фильмов: " + error);
                return;
            }
            movies.length;
            processMovies(movies, allTimecodes, function(movieResult) {
                movieResult.processed, movieResult.errors;
                getWatchedShows(function(shows, showError) {
                    if (showError) {
                        if (callback) callback(false, "Ошибка синхронизации сериалов: " + showError);
                        return;
                    }
                    shows.length;
                    processShows(shows, allTimecodes, function(showResult) {
                        showResult.processed, showResult.errors;
                        var totalProcessed = movieResult.processed + showResult.processed;
                        var totalErrors = movieResult.errors + showResult.errors;
                        if (allTimecodes.length > 0) {
                            allTimecodes.length;
                            Lampa.Noty.show("Синхронизация таймкодов: " + allTimecodes.length + " записей");
                            syncTimecodesToDatabase(allTimecodes, function(syncSuccess) {
                                if (syncSuccess) {
                                    addAllCardsAtOnce(cardsToAdd);
                                    fetchStatusMovies(function(data) {
                                        fetchShowStatus(function(data) {
                                            if (callback) callback(true, "Синхронизация завершена. Обработано: " + totalProcessed + ", ошибок: " + totalErrors);
                                            if (screensaver) localStorage.removeItem("screensaver");
                                            Lampa.Noty.show("Синхронизация завершена! Приложение будет перезагружено через 3 секунды...");
                                            setTimeout(function() {
                                                window.location.reload();
                                            }, 3e3);
                                        });
                                    });
                                } else if (callback) callback(false, "Ошибка записи таймкодов в базу данных");
                            });
                        } else {
                            addAllCardsAtOnce(cardsToAdd);
                            fetchStatusMovies(function(data) {
                                fetchShowStatus(function(data) {
                                    if (callback) callback(true, "Синхронизация завершена. Обработано: " + totalProcessed + ", ошибок: " + totalErrors);
                                });
                            });
                        }
                    });
                });
            });
        });
    }
    function syncTimecodesToDatabase(timecodes, callback) {
        var network = new Lampa.Reguest;
        var uid = Lampa.Storage.get("lampac_unic_id", "");
        var profileId = Lampa.Storage.get("lampac_profile_id", "");
        if (!uid) {
            callback(false);
            return;
        }
        var url = window.location.origin + "/timecode/batch_add?uid=" + encodeURIComponent(uid);
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        var payload = {
            timecodes: timecodes
        };
        network.timeout(1e3 * 60);
        network.native(url, function(response) {
            if (response && response.success) {
                response.added, response.updated;
                callback(true);
            } else callback(false);
        }, function(error) {
            callback(false);
        }, JSON.stringify(payload), {
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
    function processMovies(movies, allTimecodes, callback) {
        var processed = 0;
        var errors = 0;
        var currentIndex = 0;
        function processNextMovie() {
            if (currentIndex >= movies.length) {
                callback({
                    processed: processed,
                    errors: errors
                });
                return;
            }
            var movie = movies[currentIndex];
            movies.length, movie.title;
            Lampa.Noty.show("Обрабатываю фильм: " + movie.title + " (" + (currentIndex + 1) + "/" + movies.length + ")");
            findTMDBId(movie.title, movie.titleOriginal, movie.year, movie.imdbId, movie.kinopoiskId, false, function(tmdbId, tmdbData) {
                if (tmdbId) getTMDBCard(tmdbId, false, function(card, error) {
                    if (card) try {
                        var hash = Lampa.Utils.hash([ movie.titleOriginal || movie.title ].join(""));
                        var duration = movie.runtime ? movie.runtime * 60 : 7200;
                        allTimecodes.push({
                            card_id: tmdbId + "_movie",
                            item: hash.toString(),
                            data: JSON.stringify({
                                duration: duration,
                                time: duration,
                                percent: 100
                            })
                        });
                        cardsToAdd.push(card);
                        processed++;
                    } catch (e) {
                        movie.title;
                        errors++;
                    } else errors++;
                    currentIndex++;
                    setTimeout(processNextMovie, 1);
                }); else {
                    errors++;
                    currentIndex++;
                    setTimeout(processNextMovie, 50);
                }
            });
        }
        processNextMovie();
    }
    function processShows(shows, allTimecodes, callback) {
        var processed = 0;
        var errors = 0;
        var currentShowIndex = 0;
        var tmdbCache = {};
        function processNextShow() {
            if (currentShowIndex >= shows.length) {
                callback({
                    processed: processed,
                    errors: errors
                });
                return;
            }
            var show = shows[currentShowIndex];
            shows.length, show.title;
            Lampa.Noty.show("Обрабатываю сериал: " + show.title + " (" + (currentShowIndex + 1) + "/" + shows.length + ")");
            findTMDBId(show.title, show.titleOriginal, show.year, show.imdbId, show.kinopoiskId, true, function(tmdbId, tmdbData) {
                if (tmdbId) getTMDBCard(tmdbId, true, function(card, error) {
                    if (card) {
                        tmdbCache[show.myshowsId] = card;
                        processShowEpisodes(show, card, tmdbId, allTimecodes, function(episodeResult) {
                            processed += episodeResult.processed;
                            errors += episodeResult.errors;
                            currentShowIndex++;
                            setTimeout(processNextShow, 1);
                        });
                    } else {
                        errors++;
                        currentShowIndex++;
                        setTimeout(processNextShow, 50);
                    }
                }); else {
                    errors++;
                    currentShowIndex++;
                    setTimeout(processNextShow, 50);
                }
            });
        }
        processNextShow();
    }
    function processShowEpisodes(show, tmdbCard, tmdbId, allTimecodes, callback) {
        show.title, show.episodes && show.episodes.length;
        var watchedEpisodeIds = show.watchedEpisodes.map(function(ep) {
            return ep.id;
        });
        var processedEpisodes = 0;
        var errorEpisodes = 0;
        var currentEpisodeIndex = 0;
        function processNextEpisode() {
            if (currentEpisodeIndex >= show.episodes.length) {
                show.title;
                cardsToAdd.push(tmdbCard);
                callback({
                    processed: processedEpisodes,
                    errors: errorEpisodes
                });
                return;
            }
            var episode = show.episodes[currentEpisodeIndex];
            episode.seasonNumber, episode.episodeNumber, show.title, tmdbCard.original_name, 
            tmdbCard.original_title;
            if (watchedEpisodeIds.indexOf(episode.id) !== -1) try {
                var hash = Lampa.Utils.hash([ episode.seasonNumber, episode.seasonNumber > 10 ? ":" : "", episode.episodeNumber, tmdbCard.original_name || tmdbCard.original_title || show.titleOriginal || show.title ].join(""));
                var duration = episode.runtime ? episode.runtime * 60 : show.runtime ? show.runtime * 60 : 2700;
                episode.seasonNumber, episode.episodeNumber;
                allTimecodes.push({
                    card_id: tmdbId + "_tv",
                    item: hash.toString(),
                    data: JSON.stringify({
                        duration: duration,
                        time: duration,
                        percent: 100
                    })
                });
                processedEpisodes++;
                episode.seasonNumber, episode.episodeNumber;
            } catch (timelineError) {
                episode.seasonNumber, episode.episodeNumber;
                errorEpisodes++;
            } else episode.seasonNumber, episode.episodeNumber;
            currentEpisodeIndex++;
            setTimeout(processNextEpisode, 1);
        }
        processNextEpisode();
    }
    function getFirstEpisodeYear(show) {
        if (!show.episodes || show.episodes.length === 0) return show.year;
        var firstRealEpisode = null;
        for (var _ei = 0; _ei < show.episodes.length; _ei++) {
            var _ep = show.episodes[_ei];
            if (_ep.seasonNumber === 1 && _ep.episodeNumber >= 1 && !_ep.isSpecial) {
                firstRealEpisode = _ep;
                break;
            }
        }
        if (firstRealEpisode && firstRealEpisode.airDate) {
            var airDate = new Date(firstRealEpisode.airDate);
            return airDate.getFullYear();
        }
        return show.year;
    }
    function findTMDBId(title, originalTitle, year, imdbId, kinopoiskId, isTV, callback, showData) {
        var network = new Lampa.Reguest;
        if (imdbId) {
            var imdbIdFormatted = imdbId.toString().replace("tt", "");
            var url = Lampa.TMDB.api("find/tt" + imdbIdFormatted + "?external_source=imdb_id&api_key=" + Lampa.TMDB.key());
            network.timeout(1e3 * 10);
            network.silent(url, function(results) {
                var items = isTV ? results.tv_results : results.movie_results;
                if (items && items.length > 0) {
                    items[0].id;
                    callback(items[0].id, items[0]);
                    return;
                }
                searchByTitle();
            }, function(error) {
                searchByTitle();
            });
            return;
        }
        searchByTitle();
        function searchByTitle() {
            var searchQueries = [];
            if (originalTitle && originalTitle !== title) searchQueries.push(originalTitle);
            searchQueries.push(title);
            var currentQueryIndex = 0;
            function tryNextQuery() {
                if (currentQueryIndex >= searchQueries.length) {
                    callback(Lampa.Utils.hash(originalTitle || title), null);
                    return;
                }
                var searchQuery = searchQueries[currentQueryIndex];
                var searchType = isTV ? "tv" : "movie";
                tryWithYear(searchQuery, year);
                function tryWithYear(query, searchYear) {
                    var url = Lampa.TMDB.api("search/" + searchType + "?query=" + encodeURIComponent(query) + "&api_key=" + Lampa.TMDB.key());
                    if (searchYear) url += "&" + (isTV ? "first_air_date_year" : "year") + "=" + searchYear;
                    network.timeout(1e3 * 10);
                    network.silent(url, function(results) {
                        if (results && results.results && results.results.length > 0) {
                            var exactMatch = null;
                            for (var i = 0; i < results.results.length; i++) {
                                var item = results.results[i];
                                var itemTitle = isTV ? item.name || item.original_name : item.title || item.original_title;
                                if (itemTitle.toLowerCase() === query.toLowerCase()) {
                                    exactMatch = item;
                                    break;
                                }
                            }
                            if (exactMatch) {
                                exactMatch.id, exactMatch.title || exactMatch.name;
                                callback(exactMatch.id, exactMatch);
                                return;
                            }
                            if (results.results.length === 1) {
                                var singleMatch = results.results[0];
                                singleMatch.id, singleMatch.title || singleMatch.name;
                                callback(singleMatch.id, singleMatch);
                                return;
                            }
                            if (results.results.length > 1 && !searchYear && showData && isTV) {
                                var firstEpisodeYear = getFirstEpisodeYear(showData);
                                if (firstEpisodeYear) {
                                    var yearFilteredResults = results.results.filter(function(item) {
                                        if (item.first_air_date) {
                                            var itemYear = new Date(item.first_air_date).getFullYear();
                                            return Math.abs(itemYear - firstEpisodeYear) <= 1;
                                        }
                                        return false;
                                    });
                                    if (yearFilteredResults.length === 1) {
                                        var filteredMatch = yearFilteredResults[0];
                                        filteredMatch.id, filteredMatch.name;
                                        callback(filteredMatch.id, filteredMatch);
                                        return;
                                    } else if (yearFilteredResults.length > 1) {
                                        var firstFiltered = yearFilteredResults[0];
                                        firstFiltered.id, firstFiltered.name;
                                        callback(firstFiltered.id, firstFiltered);
                                        return;
                                    }
                                }
                            }
                            var fallbackMatch = results.results[0];
                            fallbackMatch.id, fallbackMatch.title || fallbackMatch.name;
                            callback(fallbackMatch.id, fallbackMatch);
                            return;
                        }
                        if (searchYear) {
                            tryWithYear(query, null);
                            return;
                        }
                        if (showData && isTV && !searchYear) {
                            var firstEpisodeYear = getFirstEpisodeYear(showData);
                            if (firstEpisodeYear && firstEpisodeYear !== year) {
                                tryWithYear(query, firstEpisodeYear);
                                return;
                            }
                        }
                        currentQueryIndex++;
                        tryNextQuery();
                    }, function(error) {
                        if (searchYear) {
                            tryWithYear(query, null);
                            return;
                        }
                        currentQueryIndex++;
                        tryNextQuery();
                    });
                }
            }
            tryNextQuery();
        }
    }
    function getTMDBCard(tmdbId, isTV, callback) {
        if (!tmdbId || typeof tmdbId !== "number") {
            callback(null, "Invalid TMDB ID");
            return;
        }
        var method = isTV ? "tv" : "movie";
        var params = {
            method: method,
            id: tmdbId
        };
        Lampa.Api.full(params, function(response) {
            var movieData = response.movie || response.tv || response;
            if (movieData && movieData.id && (movieData.title || movieData.name)) {
                if (response.persons) movieData.credits = response.persons;
                if (response.videos) movieData.videos = response.videos;
                if (response.recomend) movieData.recommendations = response.recomend;
                if (response.simular) movieData.similar = response.simular;
                callback(movieData, null);
            } else callback(null, "Invalid card data");
        }, function(error) {
            callback(null, error);
        });
    }
    var cardsToAdd = [];
    function addAllCardsAtOnce(cards) {
        try {
            cards.length;
            var sortedCards = cards.sort(function(a, b) {
                var dateA, dateB;
                if (a.number_of_seasons || a.seasons) dateA = a.last_air_date || a.first_air_date || "0000-00-00"; else dateA = a.release_date || "0000-00-00";
                if (b.number_of_seasons || b.seasons) dateB = b.last_air_date || b.first_air_date || "0000-00-00"; else dateB = b.release_date || "0000-00-00";
                return new Date(dateB) - new Date(dateA);
            });
            var cardsToAddToHistory = sortedCards.slice(0, 100).reverse();
            cardsToAddToHistory.length;
            for (var i = 0; i < cardsToAddToHistory.length; i++) Lampa.Favorite.add("history", cardsToAddToHistory[i], 100);
            cardsToAddToHistory.length;
        } catch (error) {}
    }
    function watchedMoviesData(callback) {
        getWatchedMovies(function(watchedMoviesData) {
            if (watchedMoviesData && watchedMoviesData.result) {
                var movies = watchedMoviesData.result.map(function(movie) {
                    return {
                        myshowsId: movie.id,
                        title: movie.title,
                        titleOriginal: movie.titleOriginal,
                        year: movie.year,
                        runtime: movie.runtime,
                        imdbId: movie.imdbId,
                        kinopoiskId: movie.kinopoiskId
                    };
                });
                movies.length;
                callback(movies, null);
            } else callback(null, "Ошибка получения фильмов");
        });
    }
    function getWatchedShows(callback) {
        makeAuthenticatedRequest({
            method: "POST",
            headers: JSON_HEADERS,
            body: createJSONRPCRequest("profile.Shows", {
                page: 0,
                pageSize: 1e3
            })
        }, function(showsData) {
            if (!showsData || !showsData.result || showsData.result.length === 0) {
                callback([], null);
                return;
            }
            var shows = [];
            var totalShows = showsData.result.length;
            var currentIndex = 0;
            function processNextShow() {
                if (currentIndex >= totalShows) {
                    shows.length;
                    callback(shows, null);
                    return;
                }
                var userShow = showsData.result[currentIndex];
                var showId = userShow.show.id;
                var showTitle = userShow.show.title;
                Lampa.Noty.show("Получаю просмотренные эпизоды для сериала: " + showTitle + " (" + (currentIndex + 1) + "/" + totalShows + ")");
                makeAuthenticatedRequest({
                    method: "POST",
                    headers: JSON_HEADERS,
                    body: createJSONRPCRequest("shows.GetById", {
                        showId: showId
                    })
                }, function(showDetailsData) {
                    makeAuthenticatedRequest({
                        method: "POST",
                        headers: JSON_HEADERS,
                        body: createJSONRPCRequest("profile.Episodes", {
                            showId: showId
                        })
                    }, function(episodesData) {
                        if (showDetailsData && showDetailsData.result && episodesData && episodesData.result && episodesData.result.length > 0) {
                            var showData = showDetailsData.result;
                            var watchedEpisodes = episodesData.result;
                            shows.push({
                                myshowsId: showData.id,
                                title: showData.title,
                                titleOriginal: showData.titleOriginal,
                                year: showData.year,
                                imdbId: showData.imdbId,
                                kinopoiskId: showData.kinopoiskId,
                                totalSeasons: showData.totalSeasons,
                                runtime: showData.runtime,
                                episodes: showData.episodes || [],
                                watchedEpisodes: watchedEpisodes
                            });
                        }
                        currentIndex++;
                        setTimeout(processNextShow, 10);
                    }, function(error) {
                        currentIndex++;
                        setTimeout(processNextShow, 100);
                    });
                }, function(error) {
                    currentIndex++;
                    setTimeout(processNextShow, 100);
                });
            }
            processNextShow();
        }, function(error) {
            callback(null, "Ошибка получения сериалов");
        });
    }
    if (window.Lampa && Lampa.Player && Lampa.Player.listener) Lampa.Player.listener.follow("start", function(data) {
        var card = data.card || Lampa.Activity.active() && Lampa.Activity.active().movie;
        if (!card) return;
        Lampa.Storage.set("myshows_last_card", card);
    });
    if (window.Lampa && Lampa.Player && Lampa.Player.listener) {
        Lampa.Player.listener.follow("start", function(data) {
            Lampa.Storage.set("myshows_was_watching", true);
        });
        Lampa.Player.listener.follow("external", function(data) {
            Lampa.Storage.set("myshows_was_watching", true);
        });
    }
    Lampa.Listener.follow("full", function(e) {
        if (e.type == "complite" && e.data && e.data.movie) {
            var identifiers = getCardIdentifiers(e.data.movie);
            if (!identifiers) return;
            var isTV = !isMovieContent(e.data.movie);
            var title = identifiers.title;
            var originalTitle = identifiers.originalName;
            if (useNpServer() && identifiers.tmdbId) {
                if (getProfileSetting("myshows_button_view", true) && getProfileSetting("myshows_token", false)) {
                    var mediaType = isTV ? "tv" : "movie";
                    var profileId = getProfileId();
                    var statusUrl = getNpBaseUrl() + "/myshows/status" + "?token=" + encodeURIComponent(getNpToken()) + "&profile_id=" + encodeURIComponent(profileId) + "&tmdb_id=" + encodeURIComponent(identifiers.tmdbId) + "&media_type=" + mediaType;
                    var net = new Lampa.Reguest;
                    net.silent(statusUrl, function(response) {
                        var cacheType = response && response.cache_type;
                        var status;
                        if (isTV) if (cacheType === "watchlist") status = "later"; else if (cacheType === "watching" || cacheType === "cancelled") status = cacheType; else status = "remove"; else if (cacheType === "watched") status = "finished"; else if (cacheType === "watchlist") status = "later"; else status = "remove";
                        setCardStatusCache(identifiers.tmdbId, !isTV, status);
                        createMyShowsButtons(e, status, !isTV);
                        updateButtonStates(status, !isTV, true);
                    }, function() {
                        createMyShowsButtons(e, null, !isTV);
                    });
                }
                return;
            }
            if (isTV) {
                getStatusByTitle(originalTitle, false, function(cachedStatus) {
                    if (cachedStatus) setCardStatusCache(identifiers.tmdbId, false, cachedStatus);
                    if (!cachedStatus || cachedStatus === "remove") updateButtonStates("remove", false, false);
                    if (getProfileSetting("myshows_button_view", true) && getProfileSetting("myshows_token", false)) createMyShowsButtons(e, cachedStatus, false);
                });
                getShowIdByExternalIds(identifiers.imdbId, identifiers.kinopoiskId, title, originalTitle, identifiers.tmdbId, identifiers.year, identifiers.alternativeTitles, function(showId) {
                    if (showId) getShowStatus(showId, function(currentStatus) {
                        setCardStatusCache(identifiers.tmdbId, false, currentStatus);
                        updateButtonStates(currentStatus, false, true);
                    });
                });
            } else getStatusByTitle(originalTitle, true, function(cachedStatus) {
                if (cachedStatus) setCardStatusCache(identifiers.tmdbId, true, cachedStatus);
                if (!cachedStatus || cachedStatus === "remove") updateButtonStates("remove", true, false);
                if (getProfileSetting("myshows_button_view", true) && getProfileSetting("myshows_token", false)) createMyShowsButtons(e, cachedStatus, true);
            });
        }
    });
    var cachedShuffledItems = {};
    var _unwatchedProgressMap = {};
    function _populateProgressMap(shows) {
        if (!shows) return;
        shows.forEach(function(s) {
            if (s.myshowsId && (s.progress_marker || s.next_episode || s.remaining !== void 0)) _unwatchedProgressMap[s.myshowsId] = {
                progress_marker: s.progress_marker,
                next_episode: s.next_episode,
                remaining: s.remaining
            };
        });
    }
    function _applyProgressFromMap(cardData) {
        if (!cardData || !cardData.myshowsId) return;
        if (cardData.progress_marker) return;
        var p = _unwatchedProgressMap[cardData.myshowsId];
        if (!p) return;
        cardData.progress_marker = p.progress_marker;
        cardData.next_episode = p.next_episode;
        cardData.remaining = p.remaining;
    }
    function ApiMyShows() {
        function myshowsWatchlist(object, oncomplite, onerror) {
            var currentPage = object.page || 1;
            var PAGE_SIZE_W = 20;
            var startProfile = getProfileId();
            if (useNpServer()) {
                if (object.forceRefresh) {
                    _doFetchWatchlist();
                    return;
                }
                loadCacheFromServer("watchlist", "results", function(cached) {
                    if (cached && cached.results && cached.results.length > 0) {
                        cached.page = currentPage;
                        oncomplite(cached);
                        return;
                    }
                    _doFetchWatchlist();
                }, {
                    page: currentPage
                });
                return;
            }
            _doFetchWatchlist();
            function _doFetchWatchlist() {
                makeMyShowsJSONRPCRequest("profile.Shows", {}, function(success, showsData) {
                    showsData && JSON.stringify(showsData).substring(0, 200);
                    makeMyShowsJSONRPCRequest("profile.UnwatchedMovies", {}, function(success, moviesData) {
                        moviesData && JSON.stringify(moviesData).substring(0, 200);
                        var allItems = [];
                        if (showsData && showsData.result) {
                            showsData.result.length;
                            for (var i = 0; i < showsData.result.length; i++) {
                                var item = showsData.result[i];
                                if (item.watchStatus === "later") allItems.push({
                                    myshowsId: item.show.id,
                                    title: item.show.title,
                                    originalTitle: item.show.titleOriginal,
                                    year: item.show.year,
                                    watchStatus: item.watchStatus,
                                    type: "show"
                                });
                            }
                        }
                        if (moviesData && moviesData.result) {
                            moviesData.result.length;
                            for (var i = 0; i < moviesData.result.length; i++) {
                                var movie = moviesData.result[i];
                                allItems.push({
                                    myshowsId: movie.id,
                                    title: movie.title,
                                    originalTitle: movie.titleOriginal,
                                    year: movie.year,
                                    watchStatus: "later",
                                    type: "movie"
                                });
                            }
                        }
                        allItems.length;
                        var cacheKey = "watchlist";
                        if (!cachedShuffledItems[cacheKey]) {
                            Lampa.Arrays.shuffle(allItems);
                            cachedShuffledItems[cacheKey] = allItems.slice();
                        } else allItems = cachedShuffledItems[cacheKey].slice();
                        var PAGE_SIZE = 20;
                        var currentPage = object.page || 1;
                        var totalPages = Math.ceil(allItems.length / PAGE_SIZE);
                        var start = (currentPage - 1) * PAGE_SIZE;
                        var end = start + PAGE_SIZE;
                        var itemsForPage = allItems.slice(start, end);
                        itemsForPage.length;
                        if (useNpServer()) getTMDBDetailsSimple(allItems, function(allEnriched) {
                            saveCacheToServer({
                                results: allEnriched.results
                            }, "watchlist", function() {}, startProfile);
                            var enrichedTotal = allEnriched.results.length;
                            var enrichedPages = Math.ceil(enrichedTotal / PAGE_SIZE_W) || 1;
                            oncomplite({
                                results: allEnriched.results.slice(start, end),
                                page: currentPage,
                                total_pages: enrichedPages,
                                total_results: enrichedTotal
                            });
                        }); else getTMDBDetailsSimple(itemsForPage, function(result) {
                            result.page = currentPage;
                            result.total_pages = totalPages;
                            result.total_results = allItems.length;
                            oncomplite(result);
                        });
                    });
                });
            }
        }
        function myshowsWatched(object, oncomplite, onerror) {
            var PAGE_SIZE = 20;
            var currentPage = object.page || 1;
            var startProfile = getProfileId();
            if (useNpServer()) {
                if (object.forceRefresh) {
                    _doFetchWatched();
                    return;
                }
                loadCacheFromServer("watched", "results", function(cached) {
                    if (cached && cached.results && cached.results.length > 0) {
                        cached.page = currentPage;
                        oncomplite(cached);
                        return;
                    }
                    _doFetchWatched();
                }, {
                    page: currentPage
                });
                return;
            }
            _doFetchWatched();
            function _doFetchWatched() {
                makeMyShowsJSONRPCRequest("profile.Shows", {}, function(success, showsData) {
                    makeMyShowsJSONRPCRequest("profile.WatchedMovies", {}, function(success, moviesData) {
                        var allItems = [];
                        if (showsData && showsData.result) for (var i = 0; i < showsData.result.length; i++) {
                            var item = showsData.result[i];
                            if (item.watchStatus === "watching" || item.watchStatus === "finished") allItems.push({
                                myshowsId: item.show.id,
                                title: item.show.title,
                                originalTitle: item.show.titleOriginal,
                                year: item.show.year,
                                watchStatus: item.watchStatus,
                                type: "show"
                            });
                        }
                        if (moviesData && moviesData.result) for (var i = 0; i < moviesData.result.length; i++) {
                            var movie = moviesData.result[i];
                            allItems.push({
                                myshowsId: movie.id,
                                title: movie.title,
                                originalTitle: movie.titleOriginal,
                                year: movie.year,
                                watchStatus: "finished",
                                type: "movie"
                            });
                        }
                        allItems.length;
                        var cacheKey = "watched";
                        if (!cachedShuffledItems[cacheKey]) {
                            Lampa.Arrays.shuffle(allItems);
                            cachedShuffledItems[cacheKey] = allItems.slice();
                        } else allItems = cachedShuffledItems[cacheKey].slice();
                        var totalPages = Math.ceil(allItems.length / PAGE_SIZE);
                        var start = (currentPage - 1) * PAGE_SIZE;
                        var end = start + PAGE_SIZE;
                        var itemsForPage = allItems.slice(start, end);
                        itemsForPage.length;
                        if (useNpServer()) getTMDBDetailsSimple(allItems, function(allEnriched) {
                            saveCacheToServer({
                                results: allEnriched.results
                            }, "watched", function() {}, startProfile);
                            var enrichedTotal = allEnriched.results.length;
                            var enrichedPages = Math.ceil(enrichedTotal / PAGE_SIZE) || 1;
                            oncomplite({
                                results: allEnriched.results.slice(start, end),
                                page: currentPage,
                                total_pages: enrichedPages,
                                total_results: enrichedTotal
                            });
                        }); else getTMDBDetailsSimple(itemsForPage, function(result) {
                            result.page = currentPage;
                            result.total_pages = totalPages;
                            result.total_results = allItems.length;
                            oncomplite(result);
                        });
                    });
                });
            }
        }
        function myshowsCancelled(object, oncomplite, onerror) {
            var PAGE_SIZE = 20;
            var currentPage = object.page || 1;
            var startProfile = getProfileId();
            if (useNpServer()) {
                if (object.forceRefresh) {
                    _doFetchCancelled();
                    return;
                }
                loadCacheFromServer("cancelled", "results", function(cached) {
                    if (cached && cached.results && cached.results.length > 0) {
                        cached.page = currentPage;
                        oncomplite(cached);
                        return;
                    }
                    _doFetchCancelled();
                }, {
                    page: currentPage
                });
                return;
            }
            _doFetchCancelled();
            function _doFetchCancelled() {
                makeMyShowsJSONRPCRequest("profile.Shows", {}, function(success, showsData) {
                    var allItems = [];
                    if (showsData && showsData.result) for (var i = 0; i < showsData.result.length; i++) {
                        var item = showsData.result[i];
                        if (item.watchStatus === "cancelled") allItems.push({
                            myshowsId: item.show.id,
                            title: item.show.title,
                            originalTitle: item.show.titleOriginal,
                            year: item.show.year,
                            watchStatus: item.watchStatus,
                            type: "show"
                        });
                    }
                    var cacheKey = "cancelled";
                    if (!cachedShuffledItems[cacheKey]) {
                        Lampa.Arrays.shuffle(allItems);
                        cachedShuffledItems[cacheKey] = allItems.slice();
                    } else allItems = cachedShuffledItems[cacheKey].slice();
                    var totalPages = Math.ceil(allItems.length / PAGE_SIZE);
                    var start = (currentPage - 1) * PAGE_SIZE;
                    var end = start + PAGE_SIZE;
                    var itemsForPage = allItems.slice(start, end);
                    if (useNpServer()) getTMDBDetailsSimple(allItems, function(allEnriched) {
                        saveCacheToServer({
                            results: allEnriched.results
                        }, "cancelled", function() {}, startProfile);
                        var enrichedTotal = allEnriched.results.length;
                        var enrichedPages = Math.ceil(enrichedTotal / PAGE_SIZE) || 1;
                        oncomplite({
                            results: allEnriched.results.slice(start, end),
                            page: currentPage,
                            total_pages: enrichedPages,
                            total_results: enrichedTotal
                        });
                    }); else getTMDBDetailsSimple(itemsForPage, function(result) {
                        result.page = currentPage;
                        result.total_pages = totalPages;
                        result.total_results = allItems.length;
                        oncomplite(result);
                    });
                });
            }
        }
        function myshowsUnwatched(object, oncomplite, onerror) {
            var PAGE_SIZE = 20;
            var currentPage = object.page || 1;
            var cacheKey = "unwatched_raw";
            if (useNpServer()) {
                loadCacheFromServer("unwatched_serials", "shows", function(response) {
                    if (response && response.results) {
                        var all = response.results;
                        all.forEach(function(s) {
                            if (s.remaining === void 0 && s.unwatched_count !== void 0) s.remaining = s.unwatched_count;
                        });
                        var totalPages = Math.ceil(all.length / PAGE_SIZE) || 1;
                        var start = (currentPage - 1) * PAGE_SIZE;
                        oncomplite({
                            results: all.slice(start, start + PAGE_SIZE),
                            page: currentPage,
                            total_pages: totalPages,
                            total_results: all.length
                        });
                    } else if (onerror) onerror();
                }, {
                    page: 1
                });
                return;
            }
            getUnwatchedShowsWithDetails(function(result) {
                if (!result || result.error || !result.shows || result.shows.length === 0) {
                    if (onerror) onerror();
                    return;
                }
                if (!cachedShuffledItems[cacheKey]) cachedShuffledItems[cacheKey] = result.shows.slice();
                var cached = cachedShuffledItems[cacheKey];
                var totalPages = Math.ceil(cached.length / PAGE_SIZE);
                var start = (currentPage - 1) * PAGE_SIZE;
                oncomplite({
                    results: cached.slice(start, start + PAGE_SIZE),
                    page: currentPage,
                    total_pages: totalPages,
                    total_results: cached.length
                });
            });
        }
        return {
            myshowsWatchlist: myshowsWatchlist,
            myshowsWatched: myshowsWatched,
            myshowsCancelled: myshowsCancelled,
            myshowsUnwatched: myshowsUnwatched
        };
    }
    var Api = ApiMyShows();
    Object.keys(Api);
    function addMyShowsComponents() {
        Lampa.Component.add("myshows_all", function(object) {
            var comp = Lampa.Maker.make("Main", object);
            comp.use({
                onCreate: function() {
                    this.activity.loader(true);
                    var self = this;
                    var token = getProfileSetting("myshows_token", "");
                    if (!token) {
                        self.empty();
                        self.activity.loader(false);
                        return;
                    }
                    var allData = {};
                    var loaded = 0;
                    var total = 4;
                    var _t0 = Date.now();
                    var _times = {};
                    function checkComplete(label) {
                        _times[label] = Date.now() - _t0;
                        _times[label];
                        loaded++;
                        if (loaded === total) {
                            Date.now();
                            buildLines();
                        }
                    }
                    getUnwatchedShowsWithDetails(function(result) {
                        allData.unwatched = result;
                        checkComplete("unwatched");
                    });
                    Api.myshowsWatchlist({
                        page: 1
                    }, function(result) {
                        allData.watchlist = result;
                        checkComplete("watchlist");
                    }, function() {
                        checkComplete("watchlist_err");
                    });
                    Api.myshowsWatched({
                        page: 1
                    }, function(result) {
                        allData.watched = result;
                        checkComplete("watched");
                    }, function() {
                        checkComplete("watched_err");
                    });
                    Api.myshowsCancelled({
                        page: 1
                    }, function(result) {
                        allData.cancelled = result;
                        checkComplete("cancelled");
                    }, function() {
                        checkComplete("cancelled_err");
                    });
                    function buildLines() {
                        var lines = [];
                        var PAGE_SIZE = 20;
                        function addLine(title, results, totalPages, moreComponent) {
                            if (!results || !results.length) return;
                            lines.push({
                                title: title,
                                results: results,
                                total_pages: totalPages || 1,
                                params: {
                                    module: Lampa.Maker.module("Line").only("Items", "Create", "More", "Event"),
                                    emit: {
                                        onMore: function() {
                                            Lampa.Activity.push({
                                                url: moreComponent === "myshows_unwatched" ? "myshows://unwatched" : "",
                                                title: title,
                                                component: moreComponent,
                                                page: 1
                                            });
                                        }
                                    }
                                }
                            });
                        }
                        function finish() {
                            if (lines.length) self.build(lines); else self.empty();
                            self.activity.loader(false);
                        }
                        var unwatchedShows = allData.unwatched && !allData.unwatched.error && allData.unwatched.shows;
                        if (unwatchedShows && unwatchedShows.length) {
                            var totalPages = Math.ceil(unwatchedShows.length / PAGE_SIZE);
                            addLine("Непросмотренные сериалы (MyShows)", unwatchedShows.slice(0, PAGE_SIZE), totalPages, "myshows_unwatched");
                        }
                        addLine("Хочу посмотреть", allData.watchlist && allData.watchlist.results, allData.watchlist && allData.watchlist.total_pages, "myshows_watchlist");
                        addLine("История", allData.watched && allData.watched.results, allData.watched && allData.watched.total_pages, "myshows_watched");
                        addLine("Бросил смотреть", allData.cancelled && allData.cancelled.results, allData.cancelled && allData.cancelled.total_pages, "myshows_cancelled");
                        if (typeof window.surs_getCustomButtonsRow === "function") {
                            var sursParts = [];
                            window.surs_getCustomButtonsRow(sursParts);
                            if (sursParts.length > 0) {
                                sursParts[0](function(buttonsData) {
                                    if (buttonsData && buttonsData.results && buttonsData.results.length) lines.unshift(buttonsData);
                                    finish();
                                });
                                return;
                            }
                        }
                        finish();
                    }
                },
                onInstance: function(item, data) {
                    item.use({
                        onInstance: function(card, data) {
                            card.use({
                                onEnter: function() {
                                    Lampa.Activity.push({
                                        url: "",
                                        component: "full",
                                        id: data.id,
                                        method: data.name ? "tv" : "movie",
                                        card: data
                                    });
                                },
                                onFocus: function() {
                                    Lampa.Background.change(Lampa.Utils.cardImgBackground(data));
                                }
                            });
                        }
                    });
                }
            });
            return comp;
        });
        function addCategoryComponent(name, apiFn, useSource) {
            Lampa.Component.add(name, function(object) {
                var comp = Lampa.Maker.make("Category", object, function(module) {
                    return module.toggle(module.MASK.base, "Pagination");
                });
                comp.use({
                    onCreate: function() {
                        this.activity.loader(true);
                        if (!getProfileSetting("myshows_token", "")) {
                            this.empty();
                            this.activity.loader(false);
                            return;
                        }
                        var self = this;
                        apiFn(object, function(result) {
                            self.build(useSource ? Lampa.Utils.addSource(result, "myshows") : result);
                        }, function() {
                            self.empty();
                        });
                    },
                    onNext: function(resolve, reject) {
                        apiFn(object, function(result) {
                            resolve(useSource ? Lampa.Utils.addSource(result, "myshows") : result);
                        }, function() {
                            reject();
                        });
                    },
                    onInstance: function(item, data) {
                        item.use({
                            onEnter: function() {
                                Lampa.Activity.push({
                                    url: "",
                                    component: "full",
                                    id: data.id,
                                    method: data.name ? "tv" : "movie",
                                    card: data
                                });
                            },
                            onFocus: function() {
                                Lampa.Background.change(Lampa.Utils.cardImgBackground(data));
                            },
                            onVisible: function() {
                                _applyProgressFromMap(data);
                                addProgressMarkerToCard(this.html, data);
                            },
                            onUpdate: function() {
                                _applyProgressFromMap(data);
                                addProgressMarkerToCard(this.html, data);
                            }
                        });
                    }
                });
                return comp;
            });
        }
        addCategoryComponent("myshows_watchlist", Api.myshowsWatchlist, true);
        addCategoryComponent("myshows_watched", Api.myshowsWatched, true);
        addCategoryComponent("myshows_cancelled", Api.myshowsCancelled, true);
        addCategoryComponent("myshows_unwatched", Api.myshowsUnwatched, false);
    }
    var _TMDB_CARD_CACHE_KEY = "myshows_tmdb_cards";
    var _tmdbCardCache = function() {
        var stored = Lampa.Storage.get(_TMDB_CARD_CACHE_KEY);
        return stored && typeof stored === "object" ? stored : {};
    }();
    function _cardCacheTTL() {
        var days = parseInt(getProfileSetting("myshows_cache_days", DEFAULT_CACHE_DAYS)) || DEFAULT_CACHE_DAYS;
        return days * 24 * 60 * 60 * 1e3;
    }
    function _getCardFromCache(myshowsId) {
        if (!myshowsId) return null;
        var entry = _tmdbCardCache[String(myshowsId)];
        if (!entry) return null;
        if (entry.t && Date.now() - entry.t > _cardCacheTTL()) {
            delete _tmdbCardCache[String(myshowsId)];
            return null;
        }
        entry.card.title || entry.card.name;
        return entry.card;
    }
    function _saveCardToCache(myshowsId, card) {
        if (!myshowsId || !card) return;
        _tmdbCardCache[String(myshowsId)] = {
            card: card,
            t: Date.now()
        };
        card.title || card.name;
        Lampa.Storage.set(_TMDB_CARD_CACHE_KEY, _tmdbCardCache);
    }
    function getTMDBDetailsSimple(items, callback) {
        items.length;
        var data = {
            results: []
        };
        if (items.length === 0) {
            callback({
                page: 1,
                results: [],
                total_pages: 0,
                total_results: 0
            });
            return;
        }
        var status = new Lampa.Status(items.length);
        status.onComplite = function() {
            data.results.length;
            callback({
                results: data.results
            });
        };
        for (var i = 0; i < items.length; i++) (function(currentItem, index) {
            var cachedCard = _getCardFromCache(currentItem.myshowsId);
            if (cachedCard) {
                var cardCopy = {};
                for (var _k in cachedCard) if (cachedCard.hasOwnProperty(_k)) cardCopy[_k] = cachedCard[_k];
                cardCopy.myshowsId = currentItem.myshowsId;
                cardCopy.watchStatus = currentItem.watchStatus;
                data.results.push(cardCopy);
                status.append("item_" + index, {});
                return;
            }
            var originalTitle = currentItem.originalTitle || currentItem.title;
            var cleanedTitle = cleanTitle(originalTitle);
            var titles = [ originalTitle ];
            if (cleanedTitle !== originalTitle) titles.push(cleanedTitle);
            var attempts = [];
            titles.forEach(function(t) {
                if (currentItem.year > 1900 && currentItem.year < 2100) attempts.push({
                    query: t,
                    year: currentItem.year
                });
                attempts.push({
                    query: t,
                    year: null
                });
            });
            var attemptIndex = 0;
            var found = false;
            function tryAttempt() {
                if (found || attemptIndex >= attempts.length) {
                    status.append("item_" + index, {});
                    return;
                }
                var attempt = attempts[attemptIndex];
                var endpoint = currentItem.type === "movie" ? "search/movie" : "search/tv";
                var searchUrl = endpoint + "?api_key=" + Lampa.TMDB.key() + "&query=" + encodeURIComponent(attempt.query) + (attempt.year ? "&year=" + attempt.year : "") + "&language=" + Lampa.Storage.get("tmdb_lang", "ru");
                var network = new Lampa.Reguest;
                network.silent(Lampa.TMDB.api(searchUrl), function(response) {
                    if (!found && response && response.results && response.results.length > 0) {
                        found = true;
                        var enriched = response.results[0];
                        enriched.myshowsId = currentItem.myshowsId;
                        enriched.watchStatus = currentItem.watchStatus;
                        enriched.type = currentItem.type === "movie" ? "movie" : "tv";
                        if (enriched.type === "tv") {
                            enriched.last_episode_date = enriched.first_air_date;
                            enriched.release_date = enriched.first_air_date || "";
                        }
                        enriched.release_year = extractYear(enriched);
                        _saveCardToCache(currentItem.myshowsId, enriched);
                        data.results.push(enriched);
                        enriched.title || enriched.name, currentItem.myshowsId;
                    }
                    if (!found) {
                        attemptIndex++;
                        tryAttempt();
                    } else status.append("item_" + index, {});
                }, function(error) {
                    currentItem.title;
                    attemptIndex++;
                    tryAttempt();
                });
            }
            if (attempts.length > 0) tryAttempt(); else status.append("item_" + index, {});
        })(items[i], i);
    }
    function addMyShowsMenuItems() {
        function updateMyShowsMenuItem() {
            var token = getProfileSetting("myshows_token", "");
            var menuItem = $('.menu__item.selector .menu__text:contains("MyShows")').closest(".menu__item");
            if (token) {
                if (menuItem.length === 0) {
                    var allButton = $('<li class="menu__item selector">' + '<div class="menu__ico">' + myshows_icon + "</div>" + '<div class="menu__text">MyShows</div>' + "</li>");
                    allButton.on("hover:enter", function() {
                        Lampa.Activity.push({
                            url: "",
                            title: "MyShows",
                            component: "myshows_all"
                        });
                    });
                    $(".menu .menu__list").eq(0).append(allButton);
                }
            } else if (menuItem.length > 0) menuItem.remove();
        }
        updateMyShowsMenuItem();
        Lampa.Listener.follow("profile", function(e) {
            if (e.type === "changed") {
                setTimeout(updateMyShowsMenuItem, 100);
                setTimeout(addMyShowsButtonStyles, 100);
                setTimeout(addProgressMarkerStyles, 100);
            }
        });
        Lampa.Listener.follow("state:changed", function(e) {
            if (e.target === "favorite" && e.reason === "profile") setTimeout(updateMyShowsMenuItem, 100);
        });
    }
    Lampa.Listener.follow("line", function(event) {
        if (event.data && event.data.title && event.data.title.indexOf("MyShows") !== -1) if (event.type === "create") {
            if (event.data && event.data.results && event.line) event.data.results.forEach(function(show) {
                if (!show.ready && event.line.append) event.line.append(show);
            });
            var shows = event.data && event.data.results;
            if (shows && shows.length) setTimeout(function() {
                shows.forEach(function(show) {
                    var name = getCardName(show);
                    if (name && (show.progress_marker || show.remaining || show.next_episode)) updateAllMyShowsCards(name, show.myshowsId, show.progress_marker, show.next_episode, show.remaining);
                });
            }, 500);
        }
    });
    var _onUnwatchedSaved = null;
    var _msttT0 = Date.now();
    function _fireUnwatchedSaved(shows) {
        Date.now();
        if (_onUnwatchedSaved) {
            _onUnwatchedSaved(shows);
            _onUnwatchedSaved = null;
        }
    }
    var _MS_TT_CACHE_KEY = "myshows_timetable";
    function invalidateTimetableCache() {
        try {
            setProfileSetting(_MS_TT_CACHE_KEY, null, false);
        } catch (e) {}
    }
    function initMyShowsTimetable() {
        Lampa.TimeTable;
        Lampa.Component;
        Lampa.Scroll;
        Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
        if (!Lampa.TimeTable || !Lampa.Component) return;
        function pad(n) {
            return n < 10 ? "0" + n : "" + n;
        }
        function toDateStr(d) {
            return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
        }
        function parseDate(s) {
            if (Lampa.Utils && Lampa.Utils.parseToDate) return Lampa.Utils.parseToDate(s);
            var p = s.split("-");
            return new Date(+p[0], +p[1] - 1, +p[2]);
        }
        function hsl(str) {
            if (Lampa.Utils && Lampa.Utils.stringToHslColor) return Lampa.Utils.stringToHslColor(str, 50, 50);
            var h = 0;
            for (var i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
            return "hsl(" + (h % 360 + 360) % 360 + ",50%,50%)";
        }
        function dayLabel(date) {
            if (Lampa.Utils && Lampa.Utils.parseTime) {
                var t = Lampa.Utils.parseTime(date.getTime());
                var W = [ "week_7", "week_1", "week_2", "week_3", "week_4", "week_5", "week_6" ].map(function(k) {
                    return Lampa.Lang.translate(k);
                });
                return t.short + " — " + W[date.getDay()];
            }
            return date.toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "short",
                weekday: "short"
            });
        }
        function tmdbImg(path) {
            return "https://image.tmdb.org/t/p/w200" + path;
        }
        function cardImg(card, ep) {
            if (card._ms) return card._ms_img || "";
            if (ep && ep.still_path) return tmdbImg(ep.still_path);
            if (card.poster_path) return tmdbImg(card.poster_path);
            return "";
        }
        function readUpcomingCache(callback) {
            loadCacheFromServer("timetable", "shows", function(result) {
                callback(result && result.shows ? result : null);
            });
        }
        function writeUpcomingCache(data) {
            saveCacheToServer({
                shows: data
            }, "timetable", function() {});
        }
        function buildItemsFromCache(cached, msMap) {
            if (!cached || !cached.shows) return [];
            var items = [];
            cached.shows.forEach(function(entry) {
                var card = msMap[String(entry.msId)];
                if (!card || !entry.episodes || !entry.episodes.length) return;
                items.push({
                    tableEntry: {
                        id: card.id,
                        episodes: entry.episodes,
                        next: null
                    },
                    card: {
                        id: card.id,
                        name: card.name || card.original_name || "",
                        original_name: card.original_name || card.name || "",
                        poster_path: card.poster_path || null,
                        source: "tmdb"
                    }
                });
            });
            return items;
        }
        function refreshUpcoming(msMap, callback) {
            loadCacheFromServer("unwatched_serials", "shows", function(fresh) {
                var freshShows = fresh && fresh.shows || [];
                if (freshShows.length) {
                    msMap = {};
                    freshShows.forEach(function(s) {
                        if (s.myshowsId) msMap[String(s.myshowsId)] = s;
                    });
                }
                _doRefreshUpcoming(msMap, callback);
            }, getProfileId());
        }
        function _doRefreshUpcoming(msMap, callback) {
            var today = new Date;
            today.setHours(0, 0, 0, 0);
            makeMyShowsJSONRPCRequest("lists.EpisodesUnwatched", {}, function(ok, resp) {
                if (!ok || !resp || !resp.result) {
                    if (callback) callback(null);
                    return;
                }
                var seen = {};
                var showIds = [];
                resp.result.forEach(function(item) {
                    var ep = item.episodes && item.episodes[0];
                    var showId = String(ep && ep.showId || "");
                    if (showId && msMap[showId] && !seen[showId]) {
                        seen[showId] = true;
                        showIds.push(showId);
                    }
                });
                Object.keys(msMap).forEach(function(showId) {
                    if (!seen[showId]) {
                        seen[showId] = true;
                        showIds.push(showId);
                    }
                });
                if (!showIds.length) {
                    writeUpcomingCache([]);
                    if (callback) callback([]);
                    return;
                }
                var cacheData = [];
                var pending = showIds.length;
                function done() {
                    if (--pending > 0) return;
                    writeUpcomingCache(cacheData);
                    if (callback) callback(buildItemsFromCache({
                        shows: cacheData
                    }, msMap));
                }
                showIds.forEach(function(msId) {
                    var showName = (msMap[msId] || {}).name || (msMap[msId] || {}).original_name || msId;
                    getEpisodesByShowId(msId, null, function(eps) {
                        if (eps && eps.length) {
                            var future = eps.filter(function(ep) {
                                return ep.airDate && parseDate(ep.airDate.substring(0, 10)) >= today;
                            });
                            if (future.length) {
                                future.length, future[0].airDate.substring(0, 10);
                                cacheData.push({
                                    msId: msId,
                                    episodes: future.map(function(ep) {
                                        return {
                                            air_date: ep.airDate.substring(0, 10),
                                            season_number: ep.seasonNumber || 0,
                                            episode_number: ep.episodeNumber || 0,
                                            name: ep.title || ""
                                        };
                                    })
                                });
                            } else eps.length;
                        }
                        done();
                    });
                });
            });
        }
        function fetchUpcoming(msMap, onCache, onRefresh) {
            if (onCache) readUpcomingCache(function(cached) {
                var items = buildItemsFromCache(cached, msMap);
                if (items.length > 0) onCache(items);
            });
            if (!getProfileSetting("myshows_token", "")) {
                if (!onCache && onRefresh) onRefresh([]);
                return;
            }
            (function() {
                var mode = getStorageMode();
                window.IS_NP, Date.now();
                if (mode === "np") {
                    function refreshNpTimetable(shows, doSync) {
                        var reqList = [], localMap = {};
                        (shows || []).forEach(function(s) {
                            if (!s || !s.id) return;
                            if (s.myshowsId) localMap[String(s.myshowsId)] = s;
                            reqList.push({
                                tmdb_id: s.id,
                                myshows_id: s.myshowsId || 0
                            });
                        });
                        reqList.length, Date.now();
                        if (!reqList.length) {
                            if (onRefresh) onRefresh([]);
                            return;
                        }
                        var ttUrl = getNpBaseUrl() + "/myshows/timetable?token=" + encodeURIComponent(getNpToken()) + "&profile_id=" + encodeURIComponent(getProfileId()) + (doSync ? "&sync=1" : "");
                        var xhr = new XMLHttpRequest;
                        xhr.open("POST", ttUrl, true);
                        xhr.setRequestHeader("Content-Type", "application/json");
                        xhr.timeout = doSync ? 185e3 : 2e4;
                        xhr.onload = function() {
                            var resp = null;
                            try {
                                resp = JSON.parse(xhr.responseText);
                            } catch (e) {}
                            if (!resp || !Array.isArray(resp.episodes)) {
                                if (onRefresh) onRefresh([]);
                                return;
                            }
                            var tmdbMap = {};
                            Object.keys(localMap).forEach(function(msId) {
                                var c = localMap[msId];
                                if (c && c.id) tmdbMap[String(c.id)] = c;
                            });
                            var grouped = {};
                            resp.episodes.forEach(function(ep) {
                                var sid = String(ep.tmdb_show_id);
                                if (!tmdbMap[sid]) return;
                                if (!grouped[sid]) grouped[sid] = [];
                                grouped[sid].push({
                                    air_date: ep.air_date,
                                    season_number: ep.season_number || 0,
                                    episode_number: ep.episode_number || 0,
                                    name: ep.name || ""
                                });
                            });
                            var items = [];
                            Object.keys(grouped).forEach(function(sid) {
                                var card = tmdbMap[sid];
                                items.push({
                                    tableEntry: {
                                        id: card.id,
                                        episodes: grouped[sid],
                                        next: null
                                    },
                                    card: {
                                        id: card.id,
                                        name: card.name || card.original_name || "",
                                        original_name: card.original_name || card.name || "",
                                        poster_path: card.poster_path || null,
                                        source: "tmdb"
                                    }
                                });
                            });
                            resp.episodes.length, items.length, Date.now();
                            if (onRefresh) onRefresh(items);
                        };
                        xhr.onerror = function() {
                            if (onRefresh) onRefresh([]);
                        };
                        xhr.ontimeout = function() {
                            if (onRefresh) onRefresh([]);
                        };
                        xhr.send(JSON.stringify(reqList));
                    }
                    var currentShows = Object.keys(msMap).map(function(id) {
                        return msMap[id];
                    });
                    if (currentShows.length) refreshNpTimetable(currentShows, false);
                    _onUnwatchedSaved = function(freshShows) {
                        freshShows.length, Date.now();
                        refreshNpTimetable(freshShows, true);
                    };
                } else {
                    Date.now();
                    _onUnwatchedSaved = function(freshShows) {
                        freshShows.length, Date.now();
                        var freshMap = {};
                        freshShows.forEach(function(s) {
                            if (s && s.myshowsId) freshMap[String(s.myshowsId)] = s;
                        });
                        refreshUpcoming(freshMap, onRefresh);
                    };
                }
            })();
        }
        function makeScroll() {
            if (Lampa.Scroll) try {
                return new Lampa.Scroll({
                    mask: true,
                    over: true,
                    step: 300
                });
            } catch (e) {}
            var wrap = $('<div style="overflow-y:auto;height:100%;position:relative"></div>');
            var content = $("<div></div>");
            wrap.append(content);
            return {
                render: function() {
                    return wrap;
                },
                append: function(el) {
                    content.append(el);
                },
                minus: function() {},
                update: function() {},
                destroy: function() {
                    wrap.remove();
                }
            };
        }
        Lampa.Component.add("timetable", function(object) {
            var scroll = makeScroll();
            var html = $("<div></div>");
            var body = $('<div class="timetable"></div>');
            var self = this;
            var last;
            function getEpisodes(episodes, next) {
                var r = [].concat(episodes || []);
                if (next && !r.find(function(e) {
                    return e.air_date === next.air_date;
                })) r.push(next);
                return r;
            }
            this.create = function() {
                self.activity.loader(true);
                scroll.minus();
                scroll.append(body);
                html.append(scroll.render());
                self.activity.toggle();
                var lampaCards = [];
                try {
                    lampaCards = (Lampa.Account.Permit.sync ? Lampa.Account.Bookmarks.all() : Lampa.Favorite.full().card) || [];
                } catch (e) {}
                var cardsMap = {};
                var existingNames = {};
                lampaCards.forEach(function(c) {
                    cardsMap[c.id] = c;
                    existingNames[(c.original_name || c.name || "").toLowerCase()] = true;
                });
                var lampaTable = Lampa.TimeTable.all() || [];
                if (!getProfileSetting("myshows_calendar", true)) {
                    self._fill(lampaTable, cardsMap);
                    return self.render();
                }
                var lampaTableIds = {};
                lampaTable.forEach(function(e) {
                    lampaTableIds[e.id] = true;
                });
                function applyItems(msItems) {
                    msItems.length;
                    var msTable = [];
                    msItems.forEach(function(item) {
                        if (lampaTableIds[item.tableEntry.id]) {
                            item.card.name;
                            return;
                        }
                        cardsMap[item.tableEntry.id] = item.card;
                        msTable.push(item.tableEntry);
                    });
                    msTable.length, lampaTable.length, msTable.length;
                    self._fill(lampaTable.concat(msTable), cardsMap);
                }
                function buildMsMap(shows) {
                    var map = {};
                    (shows || []).forEach(function(s) {
                        var mid = s.myshowsId || s.myshows_id;
                        if (!mid) return;
                        s.myshowsId = mid;
                        map[String(mid)] = s;
                    });
                    return map;
                }
                function refreshTimetableExtra(baseMap, onDone) {
                    if (!getProfileSetting("myshows_token", "")) {
                        onDone(baseMap);
                        return;
                    }
                    makeMyShowsJSONRPCRequest("profile.Shows", {}, function(success, data) {
                        if (!success || !data || !data.result) {
                            onDone(baseMap);
                            return;
                        }
                        var msMap = {};
                        Object.keys(baseMap).forEach(function(k) {
                            msMap[k] = baseMap[k];
                        });
                        var toEnrich = [];
                        data.result.forEach(function(item) {
                            var ws = item.watchStatus;
                            if (ws !== "watching" && ws !== "finished") return;
                            var mid = String(item.show.id);
                            if (msMap[mid]) return;
                            toEnrich.push({
                                myshowsId: item.show.id,
                                title: item.show.title,
                                originalTitle: item.show.titleOriginal,
                                year: item.show.year,
                                type: "tv"
                            });
                        });
                        function saveAndDone(map) {
                            var allCards = Object.keys(map).map(function(k) {
                                return map[k];
                            });
                            saveCacheToServer({
                                shows: allCards
                            }, "timetable_extra", function() {}, getProfileId());
                            allCards.length;
                            onDone(map);
                        }
                        if (!toEnrich.length) {
                            saveAndDone(msMap);
                            return;
                        }
                        getTMDBDetailsSimple(toEnrich, function(result) {
                            (result.results || []).forEach(function(card) {
                                if (!card.myshowsId || !card.id) return;
                                msMap[String(card.myshowsId)] = card;
                            });
                            toEnrich.length, Object.keys(msMap).length;
                            saveAndDone(msMap);
                        });
                    });
                }
                loadCacheFromServer("timetable_extra", "shows", function(extraResult) {
                    var extraShows = extraResult && extraResult.shows;
                    if (extraShows && extraShows.length > 0) {
                        var msMap = buildMsMap(extraShows);
                        extraShows.length;
                        fetchUpcoming(msMap, applyItems, applyItems);
                        loadCacheFromServer("unwatched_serials", "shows", function(uwResult) {
                            var baseMap = buildMsMap(uwResult && uwResult.shows);
                            refreshTimetableExtra(baseMap, function(freshMap) {
                                Object.keys(freshMap).length;
                                fetchUpcoming(freshMap, null, applyItems);
                            });
                        }, getProfileId());
                    } else loadCacheFromServer("unwatched_serials", "shows", function(uwResult) {
                        var baseMap = buildMsMap(uwResult && uwResult.shows);
                        refreshTimetableExtra(baseMap, function(fullMap) {
                            Object.keys(fullMap).length;
                            fetchUpcoming(fullMap, null, applyItems);
                        });
                    }, getProfileId());
                }, getProfileId());
                return self.render();
            };
            this._fill = function(table, cardsMap) {
                self.activity.loader(false);
                var lastDate = last ? $(last).attr("data-air") : "";
                body.empty();
                if (!table.length) {
                    body.append('<div style="padding:2em;text-align:center;color:#aaa">' + Lampa.Lang.translate("timetable_empty") + "</div>");
                    return;
                }
                var today = new Date;
                today.setHours(0, 0, 0, 0);
                var days = 30;
                var cur = new Date(today);
                for (var i = 0; i < days; i++) {
                    self._day(new Date(cur), table, cardsMap);
                    cur.setDate(cur.getDate() + 1);
                }
                if (!last || !document.body.contains(last)) last = (lastDate ? body.find('.timetable__item[data-air="' + lastDate + '"]')[0] : null) || body.find(".timetable__item").first()[0];
                try {
                    var enabled = Lampa.Controller.enabled();
                    if (enabled && enabled.name === "content") Lampa.Controller.toggle("content");
                } catch (e) {}
            };
            this._day = function(date, table, cardsMap) {
                var airDate = toDateStr(date);
                var epis = [];
                table.forEach(function(elem) {
                    var card = cardsMap[elem.id];
                    if (!card) return;
                    getEpisodes(elem.episodes, elem.next).forEach(function(ep) {
                        if (ep.air_date === airDate) epis.push({
                            episode: ep,
                            card: card
                        });
                    });
                });
                var item = $([ '<div class="timetable__item selector" data-air="' + airDate + '">', '<div class="timetable__inner">', '<div class="timetable__date"></div>', '<div class="timetable__body"></div>', "</div></div>" ].join(""));
                item.find(".timetable__date").text(dayLabel(date));
                if (epis.length) {
                    var seen = {}, uniq = [];
                    epis.forEach(function(e) {
                        var key = e.card.id;
                        if (seen[key]) return;
                        seen[key] = true;
                        uniq.push(e);
                    });
                    if (uniq.length === 1) {
                        var img0 = cardImg(uniq[0].card, uniq[0].episode);
                        var prev = $('<div class="timetable__preview"><img><div>' + (uniq[0].card.name || Lampa.Lang.translate("noname")) + "</div></div>");
                        if (img0) prev.find("img").attr("src", img0).on("error", function() {
                            $(this).remove();
                        }); else prev.find("img").remove();
                        item.find(".timetable__body").append(prev);
                    } else {
                        uniq.slice(0, 3).forEach(function(e) {
                            item.find(".timetable__body").append('<div><span style="background-color:' + hsl(e.card.name) + '"></span>' + e.card.name + "</div>");
                        });
                        if (uniq.length > 3) item.find(".timetable__body").append("<div>+" + (uniq.length - 3) + "</div>");
                    }
                    item.addClass("timetable__item--any");
                }
                item.on("hover:focus", function() {
                    last = this;
                    try {
                        scroll.update($(this));
                    } catch (e) {}
                }).on("hover:hover", function() {
                    last = this;
                    try {
                        Navigator.focused(last);
                    } catch (e) {}
                }).on("hover:enter", function() {
                    last = this;
                    self._modal(airDate, epis);
                });
                body.append(item);
            };
            this._modal = function(airDate, epis) {
                var modal = $("<div></div>");
                epis.forEach(function(elem) {
                    var timeStr = Lampa.Utils && Lampa.Utils.parseTime ? Lampa.Utils.parseTime(airDate).full : airDate;
                    var noty = Lampa.Template.get("notice_card", {
                        time: timeStr,
                        title: elem.card.name,
                        descr: Lampa.Lang.translate("card_new_episode")
                    });
                    var foot = $('<div class="notice__footer"></div>');
                    foot.append("<div>S&nbsp;&mdash;&nbsp;<b>" + elem.episode.season_number + "</b></div>");
                    foot.append("<div>E&nbsp;&mdash;&nbsp;<b>" + elem.episode.episode_number + "</b></div>");
                    noty.find(".notice__descr").append(foot);
                    var img = cardImg(elem.card, null);
                    if (img) noty.find("img").attr("src", img).on("load", function() {
                        noty.addClass("image--loaded");
                    }).on("error", function() {
                        $(this).remove();
                    });
                    noty.on("hover:enter", function() {
                        Lampa.Modal.close();
                        if (!elem.card._ms) Lampa.Activity.push({
                            url: "",
                            component: "full",
                            id: elem.card.id,
                            method: "tv",
                            card: elem.card,
                            source: elem.card.source
                        });
                    });
                    modal.append(noty);
                });
                Lampa.Modal.open({
                    title: Lampa.Lang.translate("menu_tv"),
                    size: "medium",
                    html: modal,
                    onBack: function() {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle("content");
                    }
                });
            };
            this.start = function() {
                Lampa.Controller.add("content", {
                    link: self,
                    toggle: function() {
                        try {
                            Lampa.Controller.collectionSet(scroll.render());
                        } catch (e) {}
                        try {
                            Lampa.Controller.collectionFocus(last || false, scroll.render());
                        } catch (e) {}
                        if (Lampa.Background) Lampa.Background.change("https://image.tmdb.org/t/p/w200/oXPYD4c3bLtfAS2FzwjZh7NWqo4.jpg");
                    },
                    left: function() {
                        if (Navigator.canmove("left")) Navigator.move("left"); else Lampa.Controller.toggle("menu");
                    },
                    right: function() {
                        Navigator.move("right");
                    },
                    up: function() {
                        if (Navigator.canmove("up")) Navigator.move("up"); else Lampa.Controller.toggle("head");
                    },
                    down: function() {
                        if (Navigator.canmove("down")) Navigator.move("down");
                    },
                    back: self.back
                });
                Lampa.Controller.toggle("content");
            };
            this.back = function() {
                Lampa.Activity.backward();
            };
            this.pause = function() {};
            this.stop = function() {};
            this.render = function() {
                return html;
            };
            this.destroy = function() {
                try {
                    scroll.destroy();
                } catch (e) {}
                html.remove();
            };
        });
    }
    function init() {
        if (typeof Lampa === "undefined" || !Lampa.Storage) {
            setTimeout(init, 100);
            return;
        }
        document.addEventListener("visible", function(e) {
            var cardElement = e.target;
            if (cardElement && cardElement.classList.contains("card")) {
                var cardData = cardElement.card_data;
                _applyProgressFromMap(cardData);
                if (cardData && (cardData.progress_marker || cardData.next_episode || cardData.remaining)) {
                    cardData.original_title || cardData.title;
                    addProgressMarkerToCard(cardElement, cardData);
                }
            }
        }, true);
        Lampa.Listener.follow("timeline", function(e) {
            setTimeout(function() {
                var cards = document.querySelectorAll(".card");
                cards.forEach(function(cardElement) {
                    var cardData = cardElement.card_data;
                    if (cardData && (cardData.progress_marker || cardData.next_episode || cardData.remaining)) addProgressMarkerToCard(cardElement, cardData);
                });
            }, 100);
        });
    }
    function addProgressMarkerToCard(htmlElement, cardData) {
        var cardElement = htmlElement;
        if (htmlElement && (htmlElement.get || htmlElement.jquery)) cardElement = htmlElement.get ? htmlElement.get(0) : htmlElement[0];
        if (!cardElement) return;
        if (!cardData) cardData = cardElement.card_data || cardElement.data;
        if (!cardData) return;
        var cardView = cardElement.querySelector(".card__view");
        if (!cardView) return;
        var showProgress = getProfileSetting("myshows_badge_progress", true);
        var showRemaining = getProfileSetting("myshows_badge_remaining", true);
        var showNext = getProfileSetting("myshows_badge_next", true);
        if (cardData.progress_marker && (showProgress === true || showProgress === "true")) {
            var progressMarker = cardView.querySelector(".myshows-progress");
            if (progressMarker) {
                var oldText = progressMarker.textContent || "";
                var newText = cardData.progress_marker;
                if (oldText !== newText) updateCardWithAnimation(cardElement, newText, "myshows-progress");
            } else {
                progressMarker = document.createElement("div");
                progressMarker.className = "myshows-progress";
                progressMarker.textContent = cardData.progress_marker;
                cardView.appendChild(progressMarker);
                setTimeout(function() {
                    progressMarker.classList.add("digit-animating");
                    setTimeout(function() {
                        progressMarker.classList.remove("digit-animating");
                    }, 600);
                }, 50);
            }
        } else {
            var existingProgress = cardView.querySelector(".myshows-progress");
            if (existingProgress) existingProgress.remove();
        }
        if (cardData.remaining !== void 0 && cardData.remaining !== null && (showRemaining === true || showRemaining === "true")) {
            var remainingMarker = cardView.querySelector(".myshows-remaining");
            if (remainingMarker) {
                var oldRemaining = remainingMarker.textContent || "";
                var newRemaining = cardData.remaining.toString();
                if (oldRemaining !== newRemaining) updateCardWithAnimation(cardElement, newRemaining, "myshows-remaining");
            } else {
                remainingMarker = document.createElement("div");
                remainingMarker.className = "myshows-remaining";
                remainingMarker.textContent = cardData.remaining;
                cardView.appendChild(remainingMarker);
                setTimeout(function() {
                    remainingMarker.classList.add("digit-animating");
                    setTimeout(function() {
                        remainingMarker.classList.remove("digit-animating");
                    }, 600);
                }, 50);
            }
        } else {
            var existingRemaining = cardView.querySelector(".myshows-remaining");
            if (existingRemaining) existingRemaining.remove();
        }
        if (cardData.next_episode && (showNext === true || showNext === "true")) {
            var nextEpisodeMarker = cardView.querySelector(".myshows-next-episode");
            if (nextEpisodeMarker) {
                var oldNext = nextEpisodeMarker.textContent || "";
                var newNext = cardData.next_episode;
                if (oldNext !== newNext) updateCardWithAnimation(cardElement, newNext, "myshows-next-episode");
            } else {
                nextEpisodeMarker = document.createElement("div");
                nextEpisodeMarker.className = "myshows-next-episode";
                nextEpisodeMarker.textContent = cardData.next_episode;
                cardView.appendChild(nextEpisodeMarker);
                setTimeout(function() {
                    nextEpisodeMarker.classList.add("digit-animating");
                    setTimeout(function() {
                        nextEpisodeMarker.classList.remove("digit-animating");
                    }, 600);
                }, 50);
            }
        } else {
            var existingNext = cardView.querySelector(".myshows-next-episode");
            if (existingNext) existingNext.remove();
        }
    }
    function initMyShowsPlugin() {
        addMyShowsToTMDB();
        addMyShowsToCUB();
        patchActivityForMyShows();
        checkLampacEnvironment(function(isLampac) {
            IS_LAMPAC = isLampac;
            if (IS_LAMPAC) ;
            initCurrentProfile();
            applyBadgeStyleAttr();
            registerNMSync();
            setTimeout(function() {
                initBadgesSubComponent();
                initSettings();
            }, 2e3);
            setTimeout(function() {
                initMyShowsCaches();
                addMyShowsComponents();
                addMyShowsMenuItems();
                cleanupOldMappings();
                initTimelineListener();
                addProgressMarkerStyles();
                addMyShowsButtonStyles();
                initMyShowsTimetable();
                init();
            }, 50);
        });
    }
    function checkLampacEnvironment(callback) {
        callback(!!window.lampac_plugin);
    }
    function registerNMSync() {
        if (!window.__NMSync) return;
        var MYSHOWS_SYNC_KEYS = [ "myshows_view_in_main", "myshows_calendar", "myshows_button_view", "myshows_sort_order", "myshows_add_threshold", "myshows_min_progress", "myshows_token", "myshows_login", "myshows_password", "myshows_cache_days", "myshows_use_np", "myshows_badge_progress", "myshows_badge_remaining", "myshows_badge_next", "myshows_badge_style" ];
        window.__NMSync.register("myshows", MYSHOWS_SENSITIVE_KEYS, _applyMyShowsSetting, function(serverKeys) {
            try {
                if (sessionStorage.getItem("myshows_just_logged_out")) {
                    sessionStorage.removeItem("myshows_just_logged_out");
                    setProfileSetting("myshows_token", "", false);
                    setProfileSetting("myshows_login", "", false);
                    setProfileSetting("myshows_password", "", false);
                    window.__NMSync.patch("myshows", getProfileKey("myshows_token"), "");
                    window.__NMSync.patch("myshows", getProfileKey("myshows_login"), "");
                    window.__NMSync.patch("myshows", getProfileKey("myshows_password"), "");
                    return;
                }
            } catch (e) {}
            MYSHOWS_SYNC_KEYS.forEach(function(key) {
                var profileKey = getProfileKey(key);
                if (serverKeys.indexOf(profileKey) < 0 && hasProfileSetting(key)) setProfileSetting(key, getProfileSetting(key));
            });
        });
    }
    function addNpSettingsParam() {
        Lampa.SettingsApi.addParam({
            component: "myshows",
            param: {
                name: "myshows_use_np",
                type: "trigger",
                default: getProfileSetting("myshows_use_np", "false")
            },
            field: {
                name: "Использовать NP сервер",
                description: "Хранить данные о непросмотренных на NP-сервере для быстрой загрузки"
            },
            onChange: function(value) {
                setProfileSetting("myshows_use_np", value);
                if (value) {
                    var cached = cachedShuffledItems["unwatched_raw"];
                    if (cached && cached.length) saveCacheToServer({
                        shows: cached
                    }, "unwatched_serials", function() {});
                }
            }
        });
    }
    if (window.appready) initMyShowsPlugin(); else Lampa.Listener.follow("app", function(event) {
        if (event.type === "ready") initMyShowsPlugin();
    });
})();