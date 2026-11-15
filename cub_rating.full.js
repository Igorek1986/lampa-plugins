(function () {
	"use strict";

	if (window.CUBRating) return;

	var REACTION_SCORE = {
		fire: 10,
		nice: 7.5,
		think: 5,
		bore: 2.5,
		shit: 0
	};
	var MIN_VOTES = 20;
	var DEFAULTS = {
		movie: { average: 6.584, weight: 274 },
		tv: { average: 7.436, weight: 69 }
	};
	var cache = {};
	var pending = {};

	function mediaType(data) {
		return data && (data.media_type === "tv" || data.name || data.original_name) ? "tv" : "movie";
	}

	function score(reactions, type) {
		var sum = 0;
		var count = 0;
		var counts = {};
		(reactions || []).forEach(function (reaction) {
			var points = REACTION_SCORE[reaction.type];
			var votes = parseInt(reaction.counter, 10) || 0;
			if (typeof points !== "number" || votes < 1) return;
			sum += votes * points;
			count += votes;
			counts[reaction.type] = votes;
		});
		if (count < MIN_VOTES) return { count: count, rating: null, emoji: "" };

		var prior = DEFAULTS[type] || DEFAULTS.movie;
		var rating = (prior.average * prior.weight + sum) / (prior.weight + count);
		var medianIndex = Math.floor(count / 2);
		var ascending = Object.keys(REACTION_SCORE).sort(function (a, b) {
			return REACTION_SCORE[a] - REACTION_SCORE[b];
		});
		var cumulative = 0;
		var median = ascending[0];
		for (var i = 0; i < ascending.length; i++) {
			cumulative += counts[ascending[i]] || 0;
			median = ascending[i];
			if (cumulative > medianIndex) break;
		}
		return { count: count, rating: Math.round(rating * 10) / 10, emoji: median };
	}

	function get(data, callback) {
		if (!data || !data.id || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.cub) return;
		var type = mediaType(data);
		var key = type + "_" + data.id;
		if (Object.prototype.hasOwnProperty.call(cache, key)) return callback(cache[key]);
		if (pending[key]) {
			pending[key].push(callback);
			return;
		}
		pending[key] = [callback];
		Lampa.Api.sources.cub.reactionsGet({ method: type, id: data.id }, function (result) {
			var value = score(result && result.result, type);
			cache[key] = value;
			var callbacks = pending[key] || [];
			delete pending[key];
			callbacks.forEach(function (done) { done(value); });
		});
	}

	window.CUBRating = {
		VERSION: "1.0.0",
		get: get,
		score: score,
		mediaType: mediaType,
		minVotes: MIN_VOTES
	};
})();
