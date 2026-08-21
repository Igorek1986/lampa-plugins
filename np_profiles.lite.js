(function() {
    "use strict";
    if (window.profiles_plugin) return;
    window.profiles_plugin = true;
    var VERSION = "1.1.0";
    window.__npClientId = window.__npClientId || (window.Lampa && Lampa.Utils && Lampa.Utils.uid ? Lampa.Utils.uid() : Date.now() + "_" + Math.random());
    if (!window.__NMSync) (function() {
        function _token() {
            return window.Lampa && Lampa.Storage.get("numparser_api_key", "") || "";
        }
        function _baseUrl() {
            return window.Lampa && Lampa.Storage.get("base_url_numparser", "") || "";
        }
        var _hasSubtle = typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function";
        function _deriveKey(token) {
            var enc = new TextEncoder;
            return crypto.subtle.digest("SHA-256", enc.encode(token + ":nm-plugin-settings")).then(function(raw) {
                return crypto.subtle.importKey("raw", raw, {
                    name: "AES-GCM"
                }, false, [ "encrypt", "decrypt" ]);
            });
        }
        function _aesEncrypt(value, token) {
            return _deriveKey(token).then(function(key) {
                var iv = crypto.getRandomValues(new Uint8Array(12));
                var enc = new TextEncoder;
                return crypto.subtle.encrypt({
                    name: "AES-GCM",
                    iv: iv
                }, key, enc.encode(JSON.stringify(value))).then(function(ct) {
                    var b64 = function(buf) {
                        return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
                    };
                    return "enc:" + b64(iv.buffer) + "." + b64(ct);
                });
            });
        }
        function _aesDecrypt(packed, token) {
            try {
                var parts = packed.slice(4).split(".");
                if (parts.length !== 2) return Promise.resolve(null);
                var fromB64 = function(s) {
                    return Uint8Array.from(atob(s), function(c) {
                        return c.charCodeAt(0);
                    });
                };
                var iv = fromB64(parts[0]);
                var ct = fromB64(parts[1]);
                return _deriveKey(token).then(function(key) {
                    return crypto.subtle.decrypt({
                        name: "AES-GCM",
                        iv: iv
                    }, key, ct).then(function(plain) {
                        return JSON.parse((new TextDecoder).decode(plain));
                    }).catch(function() {
                        return null;
                    });
                });
            } catch (e) {
                return Promise.resolve(null);
            }
        }
        function _xorEncrypt(value, token) {
            var str = JSON.stringify(value);
            var out = "";
            for (var i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) ^ token.charCodeAt(i % token.length));
            return Promise.resolve("xor:" + btoa(out));
        }
        function _xorDecrypt(packed, token) {
            try {
                var str = atob(packed.slice(4));
                var out = "";
                for (var i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) ^ token.charCodeAt(i % token.length));
                return Promise.resolve(JSON.parse(out));
            } catch (e) {
                return Promise.resolve(null);
            }
        }
        function _encrypt(value, token) {
            return _hasSubtle ? _aesEncrypt(value, token) : _xorEncrypt(value, token);
        }
        function _decrypt(packed, token) {
            if (!packed || typeof packed !== "string") return Promise.resolve(packed);
            if (packed.indexOf("enc:") === 0) return _aesDecrypt(packed, token);
            if (packed.indexOf("xor:") === 0) return _xorDecrypt(packed, token);
            return Promise.resolve(packed);
        }
        var _ws = null;
        var _handlers = {};
        var _sensitive = {};
        function _whenNpKnown(fn, attempt) {
            if (window.IS_NP !== void 0 || (attempt || 0) >= 15) {
                fn();
                return;
            }
            setTimeout(function() {
                _whenNpKnown(fn, (attempt || 0) + 1);
            }, 1e3);
        }
        function _profileId() {
            try {
                var id = window.Lampa && Lampa.Storage.get("lampac_profile_id", "") || "";
                if (id && id.charAt(0) === "_") id = id.slice(1);
                return id;
            } catch (e) {
                return "";
            }
        }
        function _isSensitive(plugin, key) {
            var baseKey = key.indexOf("_profile_") >= 0 ? key.slice(0, key.lastIndexOf("_profile_")) : key;
            return (_sensitive[plugin] || []).indexOf(baseKey) >= 0;
        }
        function _isEncrypted(value) {
            return typeof value === "string" && (value.indexOf("enc:") === 0 || value.indexOf("xor:") === 0);
        }
        function _applyMsg(plugin, key, value, msgProfileId) {
            if (msgProfileId !== _profileId()) return;
            var fn = _handlers[plugin];
            if (!fn) return;
            if (_isSensitive(plugin, key) && _isEncrypted(value)) _decrypt(value, _token()).then(function(dec) {
                if (dec !== null) fn(key, dec);
            }); else fn(key, value);
        }
        function _connect() {
            var token = _token();
            var baseUrl = _baseUrl();
            if (!token || !baseUrl || !window.IS_NP || _ws) return;
            var wsUrl = baseUrl.replace(/^http/, "ws") + "/api/plugin-settings/ws?token=" + encodeURIComponent(token) + "&client_id=" + encodeURIComponent(window.__npClientId || "");
            try {
                _ws = new WebSocket(wsUrl);
            } catch (e) {
                return;
            }
            _ws.onmessage = function(e) {
                try {
                    var msg = JSON.parse(e.data);
                    if (msg.plugin && msg.key !== void 0) _applyMsg(msg.plugin, msg.key, msg.value, msg.profile_id || "");
                } catch (ex) {}
            };
            _ws.onclose = function() {
                _ws = null;
                setTimeout(function() {
                    if (_token()) _connect();
                }, 5e3);
            };
        }
        function _pull(plugin, callback) {
            var token = _token();
            var baseUrl = _baseUrl();
            var profileId = _profileId();
            if (!token || !baseUrl || !window.IS_NP) {
                if (callback) callback([]);
                return;
            }
            var url = baseUrl + "/api/plugin-settings" + "?token=" + encodeURIComponent(token) + "&plugin=" + encodeURIComponent(plugin) + "&profile_id=" + encodeURIComponent(profileId);
            fetch(url).then(function(r) {
                return r.ok ? r.json() : null;
            }).then(function(data) {
                var serverKeys = [];
                if (data) {
                    serverKeys = Object.keys(data);
                    serverKeys.forEach(function(key) {
                        _applyMsg(plugin, key, data[key], profileId);
                    });
                }
                if (callback) callback(serverKeys);
            }).catch(function() {
                if (callback) callback([]);
            });
        }
        window.__NMSync = {
            register: function(plugin, sensitiveKeys, applyFn, onPullComplete) {
                _handlers[plugin] = applyFn;
                _sensitive[plugin] = sensitiveKeys || [];
                _whenNpKnown(function() {
                    _connect();
                    _pull(plugin, onPullComplete ? function(serverKeys) {
                        onPullComplete(serverKeys);
                    } : null);
                });
            },
            pullAll: function(callback) {
                var plugins = Object.keys(_handlers);
                if (!plugins.length) {
                    if (callback) callback();
                    return;
                }
                var remaining = plugins.length;
                function done() {
                    if (--remaining === 0 && callback) callback();
                }
                plugins.forEach(function(plugin) {
                    _pull(plugin, done);
                });
            },
            patch: function(plugin, key, value, callback) {
                _whenNpKnown(function() {
                    window.__NMSync._patchNow(plugin, key, value, callback);
                });
            },
            _patchNow: function(plugin, key, value, callback) {
                var token = _token();
                var baseUrl = _baseUrl();
                var profileId = _profileId();
                if (!token || !baseUrl || !window.IS_NP) {
                    if (callback) callback();
                    return;
                }
                var url = baseUrl + "/api/plugin-settings" + "?token=" + encodeURIComponent(token) + "&plugin=" + encodeURIComponent(plugin) + "&profile_id=" + encodeURIComponent(profileId) + "&client_id=" + encodeURIComponent(window.__npClientId || "");
                var send = function(val) {
                    fetch(url, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            key: key,
                            value: val
                        })
                    }).then(function() {
                        if (callback) callback();
                    }).catch(function() {
                        if (callback) callback();
                    });
                };
                if (_isSensitive(plugin, key)) _encrypt(value, token).then(send); else send(value);
            }
        };
    })();
    window.sync_disable = true;
    (function sanitize() {
        try {
            var rawActive = window.localStorage.getItem("np_active_profile");
            if (rawActive) {
                var parsed = JSON.parse(rawActive);
                if (parsed && parsed.profile_id && /^\d+$/.test(String(parsed.profile_id))) window.localStorage.removeItem("np_active_profile");
            }
        } catch (e) {}
    })();
    var BASE_URL = function() {
        var src = document.currentScript && document.currentScript.src || "";
        var params = new URLSearchParams(src.split("?")[1] || "");
        return params.get("base_url") || Lampa.Storage.get("base_url_numparser", "") || src.replace(/\/np_profiles\.js.*$/, "");
    }();
    var FV_PREFIX = "np_fv_";
    var FAV_PREFIX = "np_fav_";
    var ACTIVE_KEY = "np_active_profile";
    (function applyEarlyCache() {
        try {
            var profile = getActiveProfile();
            if (!profile) return;
            var cached = Lampa.Storage.get(FAV_PREFIX + profile.profile_id, null);
            if (cached !== null) applyFavorite(cached);
        } catch (e) {}
    })();
    function getToken() {
        return Lampa.Storage.get("numparser_api_key", "");
    }
    function apiUrl(path) {
        return BASE_URL + "/timecode/" + path + "?token=" + encodeURIComponent(getToken()) + "&client_id=" + encodeURIComponent(window.__npClientId || "");
    }
    function devicePluginsUrl(profileId) {
        return BASE_URL + "/device/plugins?token=" + encodeURIComponent(getToken()) + (profileId ? "&profile_id=" + encodeURIComponent(profileId) : "");
    }
    function sortedPluginUrls(data) {
        var plugins = data && data.plugins || [];
        var urls = [];
        for (var i = 0; i < plugins.length; i++) urls.push(plugins[i].url);
        return urls.sort();
    }
    function sameUrlList(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
    }
    function reloadIfPluginsDiffer(newProfileId) {
        if (!window.__lampacLoadedPluginUrls || !getToken()) return;
        var xhr = new XMLHttpRequest;
        xhr.open("GET", devicePluginsUrl(newProfileId), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4 || xhr.status !== 200) return;
            try {
                var newUrls = sortedPluginUrls(JSON.parse(xhr.responseText));
                if (!sameUrlList(newUrls, window.__lampacLoadedPluginUrls)) {
                    console.log("NP-Profiles", "plugin set differs for new profile, reloading page");
                    window.location.reload();
                }
            } catch (e) {}
        };
        xhr.send();
    }
    function fetchProfiles(onDone, onFail) {
        fetch(apiUrl("profiles")).then(function(r) {
            return r.ok ? r.json() : Promise.reject(r.status);
        }).then(onDone).catch(onFail || function() {});
    }
    function apiCreateProfile(name, profileId, onDone, onFail) {
        if (!window.IS_NP) {
            if (onFail) onFail("no connection");
            return;
        }
        var body = {
            name: name
        };
        if (profileId) body.profile_id = profileId;
        fetch(apiUrl("profiles"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        }).then(function(r) {
            return r.ok ? r.json() : r.json().then(function(e) {
                return Promise.reject(e.detail || "Ошибка");
            });
        }).then(onDone).catch(onFail || function() {});
    }
    function apiDeleteProfile(profileId, onDone, onFail) {
        if (!window.IS_NP) {
            if (onFail) onFail("no connection");
            return;
        }
        fetch(apiUrl("profiles/" + encodeURIComponent(profileId)), {
            method: "DELETE"
        }).then(function(r) {
            return r.ok ? r.json() : r.json().then(function(e) {
                return Promise.reject(e.detail || "Ошибка");
            });
        }).then(onDone).catch(onFail || function() {});
    }
    function fetchHistory(object, onDone, onFail) {
        var profileId = object.profile_id !== void 0 ? object.profile_id : getActiveProfile() ? getActiveProfile().profile_id : "";
        var url = apiUrl("history") + "&page=" + (object.page || 1);
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        fetch(url).then(function(r) {
            return r.ok ? r.json() : Promise.reject(r.status);
        }).then(function(data) {
            var results = (data.results || []).map(function(item) {
                var isTv = item.media_type === "tv";
                var card = {
                    id: item.tmdb_id,
                    type: item.media_type,
                    original_title: item.original_title || "",
                    poster_path: item.poster_path || "",
                    vote_average: 0,
                    _np_watched_ep: item.watched_episodes,
                    _np_total_ep: item.total_episodes
                };
                if (isTv) {
                    card.name = item.title || item.original_title || "";
                    card.first_air_date = item.year ? item.year + "-01-01" : "";
                } else {
                    card.title = item.title || item.original_title || "";
                    card.release_date = item.year ? item.year + "-01-01" : "";
                }
                return card;
            });
            onDone({
                results: results,
                total_pages: data.total_pages
            });
        }).catch(onFail || function() {});
    }
    function fetchFavorite(profileId, onDone, onFail) {
        var url = apiUrl("favorite");
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        fetch(url).then(function(r) {
            return r.ok ? r.json() : Promise.reject(r.status);
        }).then(function(data) {
            onDone(data.favorite);
        }).catch(onFail || function() {});
    }
    var _ws = null;
    var _wsReconnectTimer = null;
    var _wsEnabled = false;
    function connectWS() {
        if (!_wsEnabled || !getToken()) return;
        if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;
        clearTimeout(_wsReconnectTimer);
        var wsUrl = BASE_URL.replace(/^http/, "ws") + "/timecode/ws?token=" + encodeURIComponent(getToken()) + "&client_id=" + encodeURIComponent(window.__npClientId || "");
        try {
            _ws = new WebSocket(wsUrl);
            _ws.onopen = function() {
                resyncActiveProfile();
            };
            _ws.onmessage = function(event) {
                try {
                    var msg = JSON.parse(event.data);
                    if (msg.type === "timecode") onWsTimecode(msg); else if (msg.type === "favorite") onWsFavorite(msg); else if (msg.type === "profile_updated") onWsProfileUpdated(msg);
                } catch (e) {}
            };
            _ws.onclose = function() {
                _ws = null;
                if (_wsEnabled) _wsReconnectTimer = setTimeout(connectWS, 5e3);
            };
            _ws.onerror = function() {};
        } catch (e) {
            _wsReconnectTimer = setTimeout(connectWS, 5e3);
        }
    }
    function onWsTimecode(msg) {
        var active = getActiveProfile();
        var activeId = active ? String(active.profile_id) : "";
        if (String(msg.profile_id || "") !== activeId) return;
        if (!msg.item) return;
        try {
            var tc = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
            window.__npRemoteTimelineUpdate = true;
            try {
                if (Lampa.Timeline && Lampa.Timeline.update) Lampa.Timeline.update({
                    hash: msg.item,
                    percent: tc.percent || 0,
                    time: tc.time || 0,
                    duration: tc.duration || 0,
                    profile: 0,
                    received: true
                });
            } finally {
                window.__npRemoteTimelineUpdate = false;
            }
        } catch (e) {}
    }
    function onWsFavorite(msg) {
        var active = getActiveProfile();
        var activeId = active ? String(active.profile_id) : "";
        if (String(msg.profile_id || "") !== activeId) return;
        if (msg.favorite === null || msg.favorite === void 0) return;
        applyFavorite(msg.favorite);
    }
    function onWsProfileUpdated(msg) {
        var active = getActiveProfile();
        if (!active || String(active.profile_id) !== String(msg.profile_id || "")) return;
        active.icon = msg.icon || null;
        active.name = msg.name || active.name;
        setActiveProfile(active);
        renderButton(active);
    }
    function resyncActiveProfile() {
        var active = getActiveProfile();
        if (!active || !active.profile_id) return;
        fetchProfiles(function(data) {
            var list = data.profiles || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].profile_id !== active.profile_id) continue;
                if (list[i].icon !== active.icon || list[i].name !== active.name) {
                    active.icon = list[i].icon || null;
                    active.name = list[i].name || active.name;
                    setActiveProfile(active);
                    renderButton(active);
                }
                break;
            }
        }, function() {});
    }
    var _saveFavTimer = null;
    function applyFavorite(fav) {
        Lampa.Storage.set("favorite", fav || {});
        try {
            Lampa.Favorite.read(true);
        } catch (e) {}
    }
    function scheduleSaveFavorite() {
        if (!window.IS_NP) return;
        clearTimeout(_saveFavTimer);
        _saveFavTimer = setTimeout(function() {
            var profile = getActiveProfile();
            var profileId = profile ? profile.profile_id : "";
            var url = apiUrl("favorite");
            if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
            var fav = Lampa.Storage.get("favorite", {});
            fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    favorite: fav
                })
            }).catch(function() {});
        }, 2e3);
    }
    function fetchFileView(profileId, onDone, onFail) {
        var url = apiUrl("export");
        if (profileId) url += "&profile_id=" + encodeURIComponent(profileId);
        fetch(url).then(function(r) {
            return r.ok ? r.json() : Promise.reject(r.status);
        }).then(function(data) {
            var fv = {};
            Object.keys(data || {}).forEach(function(cardId) {
                Object.keys(data[cardId] || {}).forEach(function(hash) {
                    try {
                        var tc = typeof data[cardId][hash] === "string" ? JSON.parse(data[cardId][hash]) : data[cardId][hash];
                        fv[hash] = {
                            percent: tc.percent || 0,
                            time: tc.time || 0,
                            duration: tc.duration || 0,
                            profile: 0
                        };
                    } catch (e) {}
                });
            });
            onDone(fv);
        }).catch(onFail || function() {});
    }
    function getActiveProfile() {
        return Lampa.Storage.get(ACTIVE_KEY, null);
    }
    function setActiveProfile(profile) {
        Lampa.Storage.set(ACTIVE_KEY, profile);
        var apiId = profile ? String(profile.profile_id) : "";
        var apiName = profile ? String(profile.name || "") : "";
        Lampa.Storage.set("lampac_profile_id", apiId);
        Lampa.Storage.set("np_profile_name", apiName);
    }
    function timelineKey() {
        try {
            if (Lampa.Timeline && Lampa.Timeline.filename) return Lampa.Timeline.filename();
        } catch (e) {}
        return "file_view";
    }
    function refreshPage() {
        try {
            var activity = Lampa.Activity.active();
            if (activity) {
                activity.page = 1;
                Lampa.Activity.replace(activity);
            }
        } catch (e) {}
    }
    function applyFileView(profile, fileView) {
        var key = timelineKey();
        Lampa.Storage.set(key, fileView || {});
        if (Lampa.Timeline && Lampa.Timeline.read) Lampa.Timeline.read();
        Lampa.Listener.send("profile_select", {
            profile: profile
        });
        Lampa.Listener.send("profile", {
            type: "changed",
            profile: profile,
            params: profile && profile.params || {}
        });
        updateButton(getActiveProfile());
    }
    function switchToProfile(profile) {
        var current = getActiveProfile();
        if (current) {
            var curKey = timelineKey();
            Lampa.Storage.set(FV_PREFIX + current.profile_id, Lampa.Storage.get(curKey, {}));
            Lampa.Storage.set(FAV_PREFIX + current.profile_id, Lampa.Storage.get("favorite", {}));
        }
        setActiveProfile(profile);
        reloadIfPluginsDiffer(profile.profile_id);
        var _profileParams = profile && profile.params || {};
        if (window.__NMSync) window.__NMSync.pullAll(function() {
            Lampa.Listener.send("profile", {
                type: "changed",
                params: _profileParams
            });
        }); else Lampa.Listener.send("profile", {
            type: "changed",
            params: _profileParams
        });
        if (getToken()) fetchFileView(profile.profile_id, function(fv) {
            fetchFavorite(profile.profile_id, function(fav) {
                applyFavorite(fav);
                applyFileView(profile, fv);
                refreshPage();
            }, function() {
                var savedFav = Lampa.Storage.get(FAV_PREFIX + profile.profile_id, null);
                if (savedFav !== null) applyFavorite(savedFav);
                applyFileView(profile, fv);
                refreshPage();
            });
        }, function() {
            var savedFav = Lampa.Storage.get(FAV_PREFIX + profile.profile_id, null);
            if (savedFav !== null) applyFavorite(savedFav);
            applyFileView(profile, Lampa.Storage.get(FV_PREFIX + profile.profile_id, {}));
            refreshPage();
        }); else {
            var savedFav = Lampa.Storage.get(FAV_PREFIX + profile.profile_id, null);
            if (savedFav !== null) applyFavorite(savedFav);
            applyFileView(profile, Lampa.Storage.get(FV_PREFIX + profile.profile_id, {}));
            refreshPage();
        }
    }
    var DEFAULT_ICON_SVG = '<svg width="48" height="49" viewBox="0 0 48 49" fill="none" xmlns="http://www.w3.org/2000/svg">' + '<circle cx="24.1445" cy="24.2546" r="23.8115" fill="currentColor" fill-opacity="0.2"/>' + '<path d="M24.1464 9.39355C19.9003 9.39355 16.4294 12.8645 16.4294 17.1106C16.4294 21.3567 19.9003 24.8277 24.1464 24.8277C28.3925 24.8277 31.8635 21.3567 31.8635 17.1106C31.8635 12.8645 28.3925 9.39355 24.1464 9.39355ZM37.3901 30.9946C37.1879 30.4891 36.9184 30.0173 36.6151 29.5792C35.0649 27.2877 32.6723 25.7712 29.9764 25.4005C29.6395 25.3669 29.2688 25.4342 28.9991 25.6364C27.5838 26.6811 25.8989 27.2203 24.1465 27.2203C22.3941 27.2203 20.7092 26.6811 19.2938 25.6364C19.0242 25.4342 18.6535 25.3331 18.3165 25.4005C15.6206 25.7712 13.1943 27.2877 11.6779 29.5792C11.3746 30.0173 11.105 30.5228 10.9028 30.9946C10.8018 31.1968 10.8354 31.4327 10.9365 31.6349C11.2061 32.1067 11.5431 32.5785 11.8464 32.9828C12.3181 33.6232 12.8236 34.196 13.3965 34.7352C13.8683 35.2069 14.4075 35.645 14.9467 36.0831C17.6089 38.0714 20.8103 39.116 24.1128 39.116C27.4153 39.116 30.6167 38.0713 33.2789 36.0831C33.8181 35.6788 34.3573 35.2069 34.8291 34.7352C35.3683 34.196 35.9074 33.6231 36.3793 32.9828C36.7162 32.5447 37.0196 32.1067 37.2891 31.6349C37.4575 31.4327 37.4912 31.1967 37.3901 30.9946Z" fill="currentColor"/>' + "</svg>";
    var AVAILABLE_ICONS = [ {
        id: "id1",
        label: "Мужчина"
    }, {
        id: "id2",
        label: "Женщина"
    }, {
        id: "id3",
        label: "Мальчик"
    }, {
        id: "id4",
        label: "Девочка"
    }, {
        id: "id5",
        label: "Мышь"
    }, {
        id: "id6",
        label: "Безликий"
    }, {
        id: "id7",
        label: "Малыш"
    }, {
        id: "id8",
        label: "Кот"
    }, {
        id: "id9",
        label: "Робот"
    }, {
        id: "id10",
        label: "Принцесса"
    }, {
        id: "id11",
        label: "Дедушка"
    }, {
        id: "id12",
        label: "Ниндзя"
    }, {
        id: "id13",
        label: "Хоккеист"
    }, {
        id: "id14",
        label: "Тхэквондист"
    }, {
        id: "id15",
        label: "Балерина"
    }, {
        id: "id16",
        label: "Супергерой"
    }, {
        id: "id17",
        label: "Пират"
    }, {
        id: "id18",
        label: "Астронавт"
    } ];
    function iconUrl(iconId) {
        if (!iconId) return null;
        var pngIds = {
            id1: 1,
            id2: 1,
            id3: 1,
            id4: 1,
            id5: 1,
            id6: 1,
            id7: 1,
            id13: 1
        };
        var ext = pngIds[iconId] ? ".png" : ".svg";
        return BASE_URL + "/static/profileIcons/" + iconId + ext;
    }
    function iconHtml(iconId) {
        var url = iconUrl(iconId);
        if (!url) return DEFAULT_ICON_SVG;
        return '<img src="' + url + '" style="width:2em;height:2em;border-radius:50%;object-fit:cover"/>';
    }
    var _btn = null;
    function updateButton(profile) {
        if (!_btn) return;
        if (!document.contains(_btn[0])) {
            var $orig = $(".open--profile").not(".np-profile-btn");
            if ($orig.length) $orig.replaceWith(_btn); else {
                var $h = $(".head__actions").first();
                if ($h.length) $h.prepend(_btn);
            }
        }
        var name = profile ? profile.name : "Профили";
        _btn.attr("title", name);
        _btn.empty();
        if (profile && profile.icon) {
            var url = iconUrl(profile.icon);
            _btn.append('<img src="' + url + '" style="width:2.2em;height:2.2em;border-radius:50%;object-fit:cover;display:block"/>');
        } else _btn.append(DEFAULT_ICON_SVG);
    }
    function renderButton(profile) {
        if (_btn) {
            updateButton(profile);
            return;
        }
        _btn = $('<div class="head__action selector open--profile np-profile-btn" title=""></div>');
        updateButton(profile);
        _btn.on("hover:enter hover:click hover:touch click", function() {
            openSelector();
        });
        _btn[0].addEventListener("touchend", function(e) {
            e.preventDefault();
            e.stopPropagation();
            openSelector();
        }, {
            passive: false
        });
        var $orig = $(".open--profile");
        if ($orig.length) $orig.replaceWith(_btn); else {
            var $head = $(".head__actions").first();
            if ($head.length) $head.prepend(_btn);
        }
    }
    var _allProfiles = [];
    var _loading = false;
    function openSelector() {
        if (_loading) return;
        _loading = true;
        fetchProfiles(function(data) {
            _loading = false;
            _allProfiles = data.profiles || [];
            var limit = data.limit;
            var active = getActiveProfile();
            var items = _allProfiles.map(function(p) {
                var isActive = active && active.profile_id === p.profile_id;
                return {
                    title: p.name,
                    subtitle: isActive ? "• активный • " + p.timecodes_count + " таймкодов" : p.timecodes_count + " таймкодов",
                    selected: isActive,
                    template: "selectbox_icon",
                    icon: iconHtml(p.icon),
                    profile: p
                };
            });
            if (limit === null || _allProfiles.length < limit) items.push({
                title: "Создать профиль",
                template: "selectbox_icon",
                icon: '<svg viewBox="0 0 24 24" style="width:2em;height:2em"><use xlink:href="#sprite-plus"></use></svg>',
                create: true
            });
            try {
                Lampa.Controller.toggle("head");
            } catch (e) {}
            Lampa.Select.show({
                title: "Профили",
                items: items,
                onSelect: function(item) {
                    if (item.create) {
                        Lampa.Select.close();
                        openCreateDialog();
                    } else openProfileMenu(item.profile);
                },
                onBack: function() {
                    _loading = false;
                    Lampa.Controller.toggle("content");
                }
            });
        }, function() {
            _loading = false;
            Lampa.Noty.show("Не удалось загрузить профили. Проверьте API-ключ.");
        });
    }
    function openProfileMenu(profile) {
        var active = getActiveProfile();
        var isActive = active && active.profile_id === profile.profile_id;
        var items = [];
        if (!isActive && _allProfiles.length > 1) items.push({
            title: "Переключиться",
            action: "switch"
        });
        items.push({
            title: "Сменить иконку",
            action: "icon"
        });
        items.push({
            title: "Переименовать",
            action: "rename"
        });
        items.push({
            title: "Удалить профиль",
            action: "delete"
        });
        Lampa.Select.show({
            title: profile.name,
            items: items,
            onSelect: function(item) {
                if (item.action === "switch") {
                    Lampa.Select.close();
                    switchToProfile(profile);
                } else if (item.action === "icon") openIconPicker(profile); else if (item.action === "rename") {
                    Lampa.Select.close();
                    setTimeout(function() {
                        openRenameDialog(profile);
                    }, 100);
                } else if (item.action === "delete") confirmDelete(profile);
            },
            onBack: function() {
                openSelector();
            }
        });
    }
    function openIconPicker(profile) {
        var items = AVAILABLE_ICONS.map(function(ic) {
            return {
                title: ic.label,
                template: "selectbox_icon",
                icon: iconHtml(ic.id),
                iconId: ic.id,
                selected: profile.icon === ic.id
            };
        });
        items.unshift({
            title: "Без иконки",
            template: "selectbox_icon",
            icon: DEFAULT_ICON_SVG,
            iconId: null,
            selected: !profile.icon
        });
        Lampa.Select.show({
            title: "Иконка профиля",
            items: items,
            onSelect: function(item) {
                var newIcon = item.iconId || null;
                if (!window.IS_NP) return;
                fetch(apiUrl("profiles/" + encodeURIComponent(profile.profile_id)), {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        icon: newIcon || ""
                    })
                }).then(function(r) {
                    return r.ok ? r.json() : Promise.reject();
                }).then(function() {
                    profile.icon = newIcon;
                    var active = getActiveProfile();
                    if (active && active.profile_id === profile.profile_id) {
                        active.icon = newIcon;
                        setActiveProfile(active);
                    }
                    renderButton(getActiveProfile());
                    Lampa.Noty.show("Иконка обновлена");
                    openProfileMenu(profile);
                }).catch(function() {
                    Lampa.Noty.show("Ошибка сохранения иконки");
                    openProfileMenu(profile);
                });
            },
            onBack: function() {
                openProfileMenu(profile);
            }
        });
    }
    function focusInput() {
        setTimeout(function() {
            var inp = document.querySelector('.np-profile-input input, .input__input, .input input[type="text"], input[type="text"]');
            if (inp) inp.focus();
        }, 200);
    }
    function openCreateDialog() {
        Lampa.Input.edit({
            title: "Новый профиль",
            value: "",
            free: true,
            nosave: true
        }, function(name) {
            if (!name || !name.trim()) return;
            var trimmedName = name.trim();
            var iconItems = AVAILABLE_ICONS.map(function(ic) {
                return {
                    title: ic.label,
                    template: "selectbox_icon",
                    icon: iconHtml(ic.id),
                    iconId: ic.id
                };
            });
            iconItems.unshift({
                title: "Без иконки",
                template: "selectbox_icon",
                icon: DEFAULT_ICON_SVG,
                iconId: null
            });
            Lampa.Select.show({
                title: "Иконка для «" + trimmedName + "»",
                items: iconItems,
                onSelect: function(item) {
                    var iconId = item.iconId || null;
                    apiCreateProfile(trimmedName, null, function(result) {
                        var profile = {
                            profile_id: result.profile_id,
                            name: result.name,
                            icon: iconId
                        };
                        if (iconId) fetch(apiUrl("profiles/" + encodeURIComponent(result.profile_id)), {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                icon: iconId
                            })
                        }).catch(function() {});
                        Lampa.Noty.show("Профиль «" + profile.name + "» создан");
                        switchToProfile(profile);
                    }, function(err) {
                        Lampa.Noty.show("Ошибка: " + (err || "не удалось создать профиль"));
                    });
                },
                onBack: function() {
                    apiCreateProfile(trimmedName, null, function(result) {
                        var profile = {
                            profile_id: result.profile_id,
                            name: result.name,
                            icon: null
                        };
                        Lampa.Noty.show("Профиль «" + profile.name + "» создан");
                        switchToProfile(profile);
                    }, function(err) {
                        Lampa.Noty.show("Ошибка: " + (err || "не удалось создать профиль"));
                    });
                }
            });
        });
        focusInput();
    }
    function openRenameDialog(profile) {
        Lampa.Select.close();
        Lampa.Input.edit({
            title: "Переименовать",
            value: profile.name,
            free: true,
            nosave: true
        }, function(name) {
            if (!name || !name.trim()) return;
            if (!window.IS_NP) return;
            var trimmed = name.trim();
            var isEmpty = !profile.profile_id;
            var url = isEmpty ? apiUrl("profiles") : apiUrl("profiles/" + encodeURIComponent(profile.profile_id));
            var method = isEmpty ? "POST" : "PATCH";
            fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: trimmed
                })
            }).then(function(r) {
                return r.ok ? r.json() : Promise.reject();
            }).then(function(result) {
                var newId = result.profile_id || profile.profile_id;
                var active = getActiveProfile();
                if (active && active.profile_id === profile.profile_id) {
                    active.name = trimmed;
                    active.profile_id = newId;
                    setActiveProfile(active);
                }
                profile.profile_id = newId;
                profile.name = trimmed;
                renderButton(getActiveProfile());
                Lampa.Noty.show("Переименовано");
                try {
                    Lampa.Controller.toggle("content");
                } catch (e) {}
            }).catch(function() {
                Lampa.Noty.show("Ошибка переименования");
                try {
                    Lampa.Controller.toggle("content");
                } catch (e) {}
            });
        });
        focusInput();
    }
    function confirmDelete(profile) {
        Lampa.Select.show({
            title: "Удалить «" + profile.name + "»?",
            items: [ {
                title: "Да, удалить (таймкоды тоже)",
                action: "yes"
            }, {
                title: "Отмена",
                action: "no"
            } ],
            onSelect: function(item) {
                if (item.action === "no") {
                    openProfileMenu(profile);
                    return;
                }
                Lampa.Select.close();
                apiDeleteProfile(profile.profile_id, function() {
                    try {
                        localStorage.removeItem(FV_PREFIX + profile.profile_id);
                    } catch (e) {}
                    Lampa.Noty.show("Профиль «" + profile.name + "» удалён");
                    var active = getActiveProfile();
                    var wasActive = active && active.profile_id === profile.profile_id;
                    if (wasActive) fetchProfiles(function(data) {
                        var remaining = data.profiles || [];
                        if (remaining.length > 0) switchToProfile(remaining[0]); else {
                            setActiveProfile(null);
                            Lampa.Storage.set(timelineKey(), {});
                            if (Lampa.Timeline && Lampa.Timeline.read) Lampa.Timeline.read();
                            updateButton(null);
                            refreshPage();
                        }
                    }, function() {}); else openSelector();
                }, function(err) {
                    Lampa.Noty.show("Ошибка: " + (err || "не удалось удалить профиль"));
                });
            },
            onBack: function() {
                openProfileMenu(profile);
            }
        });
    }
    var HISTORY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' + '<path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7' + "c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54" + '.72-1.21L13.5 13V8H12z"/></svg>';
    function registerHistoryComponent() {
        if (Lampa.Component.get("np_history")) return;
        Lampa.Component.add("np_history", function(object) {
            var comp = Lampa.Maker.make("Category", object, function(module) {
                return module.toggle(module.MASK.base, "Pagination");
            });
            comp.use({
                onCreate: function() {
                    var self = this;
                    self.activity.loader(true);
                    var reload = function() {
                        var profile = getActiveProfile();
                        object.profile_id = profile ? profile.profile_id : "";
                        object.page = 1;
                        self.activity.loader(true);
                        fetchHistory(object, function(result) {
                            self.build(result);
                            self.activity.loader(false);
                        }, function() {
                            self.empty();
                            self.activity.loader(false);
                        });
                    };
                    fetchHistory(object, function(result) {
                        self.build(result);
                        self.activity.loader(false);
                    }, function() {
                        self.empty();
                        self.activity.loader(false);
                    });
                    Lampa.Listener.follow("profile", function(e) {
                        if (e.type === "changed") reload();
                    });
                },
                onNext: function(resolve, reject) {
                    fetchHistory(object, resolve, reject);
                },
                onInstance: function(item, data) {
                    item.use({
                        onCreate: function() {
                            var isTv = data.type === "tv";
                            var watched = data._np_watched_ep;
                            var total = data._np_total_ep;
                            var cardImg = this.render().find(".card__view");
                            if (isTv && watched != null && total > 0) {
                                var remaining = total - watched;
                                if (remaining > 0) cardImg.append($("<div>").css({
                                    position: "absolute",
                                    top: "4px",
                                    right: "4px",
                                    background: "rgba(0,0,0,.75)",
                                    color: "#fff",
                                    borderRadius: "4px",
                                    padding: "2px 5px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    lineHeight: "1.4"
                                }).text(remaining));
                                cardImg.append($("<div>").css({
                                    position: "absolute",
                                    bottom: "8px",
                                    left: "4px",
                                    background: "#2d8a4e",
                                    color: "#fff",
                                    borderRadius: "4px",
                                    padding: "2px 5px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    lineHeight: "1.4"
                                }).text(watched + "/" + total));
                            }
                        },
                        onEnter: function() {
                            Lampa.Activity.push({
                                url: "",
                                component: "full",
                                id: data.id,
                                method: data.type === "tv" ? "tv" : "movie",
                                card: data
                            });
                        },
                        onFocus: function() {
                            Lampa.Background.change(Lampa.Utils.cardImgBackground(data));
                        }
                    });
                }
            });
            return comp;
        });
    }
    function addHistoryMenuItem() {
        if ($('.menu__item[data-action="np_history"]').length) return;
        var menuItem = $('<li data-action="np_history" class="menu__item selector">' + '<div class="menu__ico">' + HISTORY_ICON_SVG + "</div>" + '<div class="menu__text">История NP</div>' + "</li>");
        menuItem.on("hover:enter", function() {
            var profile = getActiveProfile();
            Lampa.Activity.push({
                title: "История NP",
                component: "np_history",
                page: 1,
                profile_id: profile ? profile.profile_id : ""
            });
        });
        $(".menu .menu__list").eq(0).append(menuItem);
    }
    function init() {
        if (!getToken()) return;
        if (!Lampa.Favorite._np_patched) {
            Lampa.Favorite._np_patched = true;
            var _favAdd = Lampa.Favorite.add.bind(Lampa.Favorite);
            var _favRemove = Lampa.Favorite.remove.bind(Lampa.Favorite);
            Lampa.Favorite.add = function(where, card, limit) {
                if (card && card.received && getActiveProfile()) return;
                return _favAdd(where, card, limit);
            };
            Lampa.Favorite.remove = function(where, card) {
                if (card && card.received && getActiveProfile()) return;
                return _favRemove(where, card);
            };
        }
        var _cachedProfile = getActiveProfile();
        if (_cachedProfile) setTimeout(function() {
            renderButton(_cachedProfile);
        }, 300);
        Lampa.Listener.follow("activity", function(e) {
            if (e.type !== "start") return;
            var activity = Lampa.Activity.active();
            if (!activity) return;
            var p = getActiveProfile();
            var currentId = p ? p.profile_id : "";
            if (activity._npLastProfileId === void 0) {
                activity._npLastProfileId = currentId;
                return;
            }
            if (activity._npLastProfileId !== currentId) {
                activity._npLastProfileId = currentId;
                activity.page = 1;
                Lampa.Activity.replace(activity);
            }
        });
        fetchProfiles(function(data) {
            var profiles = data.profiles || [];
            var saved = getActiveProfile();
            var active = null;
            if (saved) active = profiles.find(function(p) {
                return p.profile_id === saved.profile_id;
            }) || null;
            if (!active && profiles.length > 0) active = profiles[0];
            if (active) {
                active.icon = active.icon !== void 0 ? active.icon : saved ? saved.icon : null;
                setActiveProfile(active);
                renderButton(active);
                var cachedFav = Lampa.Storage.get(FAV_PREFIX + active.profile_id, null);
                if (cachedFav !== null) applyFavorite(cachedFav);
                fetchFileView(active.profile_id, function(fv) {
                    Lampa.Storage.set(timelineKey(), fv);
                    if (Lampa.Timeline && Lampa.Timeline.read) Lampa.Timeline.read();
                    fetchFavorite(active.profile_id, function(fav) {
                        applyFavorite(fav);
                    }, function() {});
                }, function() {});
            } else {
                setActiveProfile(null);
                renderButton(null);
            }
            Lampa.Listener.follow("state:changed", function(e) {
                if (e.target === "favorite" && e.reason === "update") scheduleSaveFavorite();
            });
            try {
                Lampa.Favorite.listener.follow("remove", function() {
                    scheduleSaveFavorite();
                });
                Lampa.Favorite.listener.follow("add", function() {
                    scheduleSaveFavorite();
                });
            } catch (e) {}
            _wsEnabled = true;
            connectWS();
            addHistoryMenuItem();
            fetch(BASE_URL + "/api/check-ongoing?token=" + encodeURIComponent(getToken())).catch(function() {});
        }, function(status) {
            if (status === 401 || status === 403) return;
            var saved = getActiveProfile();
            renderButton(saved);
        });
    }
    function listenFullCardOpen() {
        Lampa.Listener.follow("activity", function(e) {
            if (e.type === "start" && e.component === "full") setTimeout(function() {
                var profile = getActiveProfile();
                if (!getToken()) return;
                fetchFileView(profile ? profile.profile_id : "", function(fv) {
                    Lampa.Storage.set(timelineKey(), fv || {});
                    if (Lampa.Timeline && Lampa.Timeline.read) Lampa.Timeline.read();
                }, function() {});
            }, 400);
        });
        Lampa.Listener.follow("full", function(e) {
            if (e.type !== "complite" || !e.data || !e.data.movie) return;
            var movie = e.data.movie;
            if (!movie.id || movie.media_type !== "tv" && !movie.number_of_seasons) return;
            if (!getToken()) return;
            var cardId = movie.id + "_tv";
            fetch(BASE_URL + "/api/refresh-card-episodes?card_id=" + encodeURIComponent(cardId) + "&token=" + encodeURIComponent(getToken())).catch(function() {});
        });
    }
    registerHistoryComponent();
    listenFullCardOpen();
    function boot() {
        init();
        try {
            Lampa.Manifest.plugins = {
                type: "other",
                version: VERSION,
                name: "NUMParser Profiles",
                description: "Профили с синхронизацией через NP-сервер"
            };
        } catch (e) {}
        console.log("NP-Profiles", "plugin ready, version", VERSION);
    }
    if (window.appready) boot(); else Lampa.Listener.follow("app", function(e) {
        if (e.type === "ready") boot();
    });
})();