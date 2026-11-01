---
layout: default
lang: en
body_class: prose
title: MyShows development — Lampa Plugins
---

## Generate and verify MyShows releases

The production source is `myshows.full.js`. Node.js 18 or newer and the locked
development dependency Terser **5.44.0** generate the other delivered files:

```sh
npm ci --ignore-scripts
npm run build:myshows
npm test
npm run check:myshows
node --check myshows.full.js
node --check myshows.lite.js
node --check myshows.js
git diff --check
```

Commit source and both generated variants together when shipping a release.
`myshows.lite.js` removes comments and preserves readable names, log calls, and
their argument side effects. `myshows.js` uses standard compression/mangling.
Both target ES5. Generation never uses `drop_console`. The check command fails
if either variant differs from the deterministic output of the locked generator.
These tools build only MyShows and do not alter the other plugins.

`npm test` executes the complete source and both generated variants independently
in a Node VM. It drives production startup, registered settings, profile events,
public API and existing network callbacks. DOM, Lampa environment, timers,
network requests and Android native bridge are boundary doubles; plugin internals
are not replaced or exported for testing. Fixtures contain neutral test data.

## Ratings contract

Movie cards use a distinct outlined star for rating. The movie watched-eye
action toggles finished/remove; series actions retain their existing semantics.
A failed undo keeps the existing watched state. Successful undo clears the
session watched/prompt guards so later playback can mark the movie again.

The existing JSON-RPC transport sends `manage.RateEpisode({id, rating})` and
`manage.RateMovie({movieId, rating})`; ratings are integer stars 1 through 5.
Skip and Back send nothing. The public MyShows client inspected on 2026-10-22
uses these payloads in its `useRating` component, and its Movie component
updates the movie to FINISHED after rating. A successful movie rating therefore
updates the local watched status without an extra SetMovieStatus request.
It patches the canonical movie_status cache by MyShows ID, retaining unrelated
movies, and uses the existing NP set_status path for the exact movie/profile.
The existing full status refresh requires both watched and unwatched snapshots
to succeed; its confirmed rated movie stays watched even if an immediately
returned snapshot does not include it yet. Failed reads leave the patched cache
intact. Context and a movie mutation revision reject obsolete refresh replies,
including profile ABA and a later explicit status change. Late visual updates
require the same full-card movie identity, using native card_data/card/movie
activity fields; another movie or a TV show with the same numeric ID is untouched.
An unwatched movie's selector explains this effect. The public API Swagger
documents RateEpisode's integer 0–5 range; zero is not used by the new selector.
Public client entry point: [MyShows](https://myshows.me/),
[published API schema](https://api.myshows.me/shared/doc/swagger.json).
No live account mutation was used to validate the API contract.

The in-memory queue keeps exact MyShows content IDs, captured titles/episode
numbers and the existing profile/token/generation context. Only a confirmed
successful watched mutation produces an automatic prompt. Card opening and
already-watched timeline updates do not. The independent movie card action
reuses existing literal title/year lookup and its localized fallback, then the
same selector. Manual re-rating bypasses the automatic prompt's seen guard and
personal-rating lookup, so an existing movie rating can still be changed.

Before each automatic proposal the existing account-scoped RPC transport reads
`profile.Episode({episodeId})` or `profile.Movie({movieId})`. These are personal
ratings, not aggregate ratings or a whole-show rating. A positive numeric rating
suppresses the proposal; zero/null allows it. Unknown shapes and read failures
skip the proposal without a retry loop or a watched-status rollback. Async replies
re-enter the queue and recheck player/selector/account state before display.
`manage.CheckEpisode` omits its optional `rating` argument instead of sending zero,
keeping the watched mark separate from a rating change. Official Swagger confirms
the episode contract; the public client `geOJrgU2.js` and `Movie.Dno5cp5T.js`
inspected 2026-11-01 confirm `profile.Movie({movieId})` and `userMovie.rating`.
The episode selector explicitly labels the individual episode and explains that
it does not rate the entire show.

The inspected Lampa 3.3.4 snapshot has SHA-256
`6caf01e110bc5278db897b8f3c766ee1f2672b432cdcb5c3686f45ca75962bda`.
Player.destroy clears opened state and hides Select before emitting destroy;
the player Back callback restores its parent controller after that event.
One asynchronous queue drain therefore runs after native controller restoration.
Late watched replies schedule the same drain. Player.start prevents overlays;
external playback waits for destroy or a confirmed document visibility
hidden-to-visible transition while Player.opened is false. No periodic polling
or platform-specific fabricated player event is introduced. Wrappers that emit
neither lifecycle signal remain a device acceptance limitation.

Native Select hides before onSelect/onBack, and does not restore the previous
controller itself. The plugin restores the captured enabled controller name.
The Select hide listener resumes a queue blocked by another selector; preshow
tracks replacement ownership so stale callbacks cannot act on another dialog.
Each selector instance accepts only one submission. Profile/account generation
invalidation clears queued/visible prompts and ignores pending replies,
including ABA. Context-bound mutations use the existing transport with an
optional context guard and do not automatically refresh credentials/replay a
401 response. JSON-RPC errors, false results and transport errors report failure
and offer an explicit retry or Skip. They never undo watched status.

The complete-plugin VM suite covers movie/episode flow, manual movie card
re-rating, delayed player exit, multiple episode identities, duplicate Enter,
Skip/Back, failures and retries, lookup failures, profile/token/logout ABA at
queued/visible/sending phases, and competing Select ownership. Boundary doubles
model Lampa's documented event order; actual Select DOM, remote focus and player
acceptance are verified separately in the browser harness. Physical TV/external
player integration and real account writes remain outside these VM checks.

## Watched discovery contract

`myshows_watched_mode` is a native select with `show`, `mark`, `hide` values,
device/profile-local and excluded from NMSync. If absent, legacy
`myshows_hide_watched` true/string true migrates to `hide`; all other legacy
values migrate to `show`. Explicit new values take priority. The unscoped mode
key is a native UI mirror refreshed on profile changes. The independent
`myshows_android_tv` trigger retains its explicit false default, string-safe
mirror and local callback handling, avoiding native `undefined` value labels.

`tests/fixtures/lampa-settings-contract.js` contains ten unchanged function
extracts from the supplied real client: Storage get/set, Params registration,
binding/value rendering and SettingsApi registration. Its header records the
snapshot SHA-256. The suite executes those functions with the complete plugin,
asserting the rendered Нет/Да text for fresh defaults, actual native toggles,
cold restart and profile changes. Environment dependencies/DOM translation are
boundary doubles; the Storage fallback and Params label logic are not mirrored.

Mark reuses the exact positive watched classifier and copies `_myshows_watched`
epoch/profile/generation metadata only onto confirmed cards. It preserves cards,
rows, totals, source pages and request cursor and never drains hidden pages.
The existing document `visible` capture hook cleans reused DOM before applying
`.myshows-watched-card` and `.myshows-watched-check` (✓) inside `.card__view`.
Only `.card__img` is dimmed; `.focus`/`:focus` restores its filter. Invalidating
mode/profile/account/status proofs removes current decorations. Metadata has no
token, and stale epoch/profile/generation checks cannot reapply it.

Opening another eligible catalogue resets the ready index and retires marks on
retained screens. Their native ActivitySlide `refresh()` is queued after the
synchronous create-before-push phase, excluding the currently loading handle.
This sets the native deferred refresh flag, so Back refreshes/reclassifies the
retained screen instead of starting its old component with rejected metadata.
The one-tick boundary avoids scheduling a replacement while the previous screen
is still reported active. Unchanged-library, newly released unwatched episode,
profile/account switch and native cursor cases exercise unchanged ActivitySlide
start/refresh/runRefresh functions in `lampa-activity-lifecycle-contract.js`.

The verified built-in `recomend_watch` row has no URL/source and its More uses
`Recomends.page` outside Api.list. During a scoped synchronous ContentRows.call,
a temporary Array.prototype.forEach observer finds the named native registry
row. It restores the exact prior prototype BEFORE iterating native/custom rows,
wraps only that actual row factory, and permanently stops discovery once found.
The original factory retains its own visibility, shuffle, insertion index,
callback, and Router More metadata; copied payload gets private provenance.
No initializer or timer is duplicated. Disabled/absent registries can be found
on a later enabled call; finally restores the prototype on every throw/no-match.
The exported native Recomends.page uses the same guards/classifier/pagination
wrapper. This is tied to the inspected 3.3.4 contract, not arbitrary future rows.
The initially considered copied adapter was rejected because it reordered
later custom rows sharing index1; actual native registration order is preserved.

`tests/fixtures/lampa-recommendations-contract.js` contains unchanged native
ContentRows and Recomends functions from the same hashed source snapshot. Tests
cover the actual registered URL-less row/More path, colliding indices, unrelated
custom rows/arrays, disabled-to-enabled discovery, prototype restoration and
single initialization alongside the complete plugin.

`Api.main/category/list` wrappers accept only known CUB/TMDB
discovery requests/rows. Nonempty queries (including whitespace) remain excluded;
the exact empty query added by the native category_full route is not search
provenance. Source/path still determine scope. Personal, search, calendar and custom rows are
preserved. Verified built-in CUB `collections/<numeric-id>` rows and their More
lists are included. Shared source responses, row objects and result arrays are
never
modified. The native grid's owned `request.page` is advanced to the last consumed
source page before delivery because native Pagination ignores `response.page`
and increments its own request cursor. All other request fields stay unchanged.

Two authenticated reads initialize a separate in-memory index:
`profile.WatchedMovies` and `profile.Shows`. It never imports the existing
`myshowsWatched`/badge caches or fuzzy TMDB mapping guesses. A unique literal
title + exact year + media type match is required. Two conflicting explicit
original titles veto a localized-title match; a missing original still permits
the unique title/year fallback. For a show with
`watching`/`finished` status, `shows.GetById({showId,withEpisodes:true})` and
`profile.Episodes({showId})` must prove every released episode watched, with at
least one released episode. Invalid/missing dates or IDs fail open. Calendar-valid
ISO dates/timestamps with explicit timezone are supported (including `+0300`).

At most two shows run detail/history reads concurrently (four transport reads).
Repeated cards coalesce by MyShows show ID. Details are cached for the current
catalogue index, not persisted. A new main/category invocation or list page 1
reconfirms the index. Profile/token changes and successful mutations invalidate
proofs; pending replies retain profile, token and generation guards including
profile ABA. The request's assigned native activity handle binds the target
even while Activity.push is still creating it before updating the active stack.
Synchronous completion/error callbacks defer once until that push finishes;
later navigation or a replaced handle cannot revive them. Activity/request
fields prevent stale cursor
writes/repaints after navigation. Recent native catalogue activities are refreshed
through their own activity handles, including archived pages after playback.
No refresh is triggered by index completion, avoiding a refresh/load cycle.

Main/category initial callbacks and returned continuations are wrapped. Empty
filtered batches continue asynchronously; explicit repeated source cursors stop
draining, with a 100-batch guard for sources omitting cursors. In hide mode,
paginated batches refill asynchronously to at least their original result count
or source exhaustion. Every visible card from consumed pages is emitted, including
overshoot; no extra buffer or truncated tail is created. The owned list/More
cursor advances to the last consumed source page. Source totals stay unchanged.
Repeated source page numbers terminate. An error after partial success returns
the partial batch with a retry notice; errors before any visible result retain
the original error callback. Duplicate source callbacks are ignored.

Known pageable main/category rows use the captured original Api.list producer
with their verified URL/source/page, preserving their original More metadata
and original row.page. Native Router uses row.page to start a NEW full catalogue,
so its page must not become the row refill's internal consumed-page cursor.
The new grid starts on original page 1 and owns its own refill/next-page cursor.
Unchanged native Router.call/get, category_full route and Arrays helpers in
`lampa-router-contract.js` exercise this exact route-to-Api.list boundary.
Unsupported/unpageable rows are filtered without an invented loader. The native
URL-less recommendation row preserves its original shuffled sample and appends
canonical Recomends.page results starting at page 1, using movie for main and
the native category media otherwise. Stable type/id identities from the whole
sample, including hidden cards, prevent sampled/canonical overlap. Unknown or
invalid IDs are preserved without title-based deduplication. Because the sample
is random, its row.page remains original and is not advertised as a consumed
canonical cursor; More still starts its own canonical pagination normally.
Show/mark never refill or change their source cursors.

The plugin initialization
guard also prevents two queued copies of this build from registering listeners
and settings twice. It does not remove a legacy plugin already running before
the guarded build; registry migration remains a separate delivery step.

The VM suite covers source/batch continuations, the native grid cursor contract,
exceptions, immutable payloads, strict Unicode/type/year matching, completeness,
new releases, request errors, empty success, bounded detail work, settings,
profile ABA/token changes, successful mark/undo and archived activity refresh.
These checks do not prove live v3 response shape, DOM focus, CORS or physical TV
behaviour. Browser/device acceptance remains necessary.

## Android TV channel contract

The profile/device switch is `myshows_android_tv`, default off. No additional
authentication, MyShows server, favorites storage or periodic API poll is added.
Android bridge support requires both methods:

```js
AndroidJS.publishPluginChannel(JSON.stringify({
    id: 'myshows',
    title: 'MyShows',
    items: [{id: '1399', source: 'tmdb', type: 'tv', name: 'Example show',
        poster_path: '/example.jpg', overview: 'Next: S01/E02 · Unwatched: 3'}]
}));
AndroidJS.clearPluginChannel('myshows');
```

Both return boolean: `true` acknowledges validation/enqueue, not a completed
TvProvider write. Native channel identity is `plugin:myshows`. Display and order
belong to the launcher; clicking opens the existing Lampa full show activity.
Android implementations own validation, provider availability and ordered writes.

The plugin serializes new cards with an explicit metadata allowlist and TMDB/TV
identity; no credentials or arbitrary plugin properties cross this interface.
Initial cache publication is integrated with `initMyShowsCaches`; fresh results
and local episode changes are notified through `saveCacheToServer` only for
`unwatched_serials`. Publication does not wait for cache-write success. The
calendar's one-shot `_fireUnwatchedSaved` remains independent.

Local episode changes patch the latest accepted channel snapshot, preserving
unrelated shows if an NP cache read supplies only one page. A completed show is
removed only from that snapshot. Undoing completion can encounter an absent
cached card; only this cache-miss case requests the existing authoritative
MyShows list again. Its original generation remains attached to the request.

Async callers capture profile, authorization token and a generation before the
request. Profile changes, logout and disabling advance the generation, preventing
late responses from restoring cards even after switching A → B → A or restoring
the same token. Cache data can be incomplete (for example an NP page); the
existing successful fresh API result replaces it. Errors do not clear data;
successful empty lists do. Malformed nonempty lists are not interpreted as empty.

The regression suite covers these boundaries and sorting. It does not prove
Android TvProvider persistence, provider permissions, launcher visibility,
deep-link navigation or playback on real hardware; those need APK/device checks.

## Relevance history contract

The opt-in `relevance` mode uses `profile.Episodes({showId})` and the maximum
valid `watchDate` in its episode summaries. The public MyShows Swagger schema
(`https://api.myshows.me/shared/doc/swagger.json`, API version 2.0.2) documents
`watchDate` as a string without a format. The plugin already uses this method
through its existing v3 transport. An owner-authorized narrow live check confirmed
compact numeric timezone offsets (`+0300`) in v3 `watchDate`. Parsing accepts
calendar-valid ISO dates and ISO timestamps with an explicit timezone, including
both `+0300` and `+03:00`; clock and offset fields are checked before parsing.
Ambiguous, damaged and future values remain rejected. Persisted history entries
carry local `dateParser: 2`: older entries are re-read once even if their former
one-hour cache is fresh, preserving known watch/release dates and local versions
until a successful response. Failed reads keep dates and the existing retry delay.
This does not change authentication or synchronize personal history.

History is device-local, profile-scoped, cached for one hour, and deduplicated
with at most two requests in flight. Failed reads keep the known date and retry
on the next relevance refresh after one minute. There is no new periodic poll.
Cached and fresh list callbacks return exactly once with the known-date order
without waiting for history. Cached history and release metadata are applied
before the first page is sliced. Background completion sorts the complete list;
if its order changed, a short owned delay rechecks the owning current activity
before calling public Activity.replace. ActivitySlide.refresh is deliberately
not used here: its unguarded deferred replacement can replace a screen opened
during the delay. This rebuilds the first 20 membership, lazy Line.items
and navigation together instead of only moving existing DOM cards. Native
replacement retains its own activity parameters through native extractObject. The ready cache prevents a refresh loop;
unchanged ordering does not refresh. Request source/URL/page/query, activity
handle and profile/token/generation must still match. MyShows landing and More
pass their own request handles; relevance More uses the full newly sorted list,
including NP, rather than the old shuffled snapshot. The channel keeps its own
existing publication lifecycle and comparator.

The neutral 21-show regression puts the recent show outside the initial page,
then exercises unchanged native Line Items init/append/create/scroll functions
from the hashed snapshot in `lampa-line-items-contract.js` alongside native
public replace/extractObject in `lampa-activity-replace-contract.js`. Pending-delay
regressions change navigation, profile, account, source or native handle after
history completion and assert zero actual native replacements. It verifies lazy 7-card creation, new first20
membership, subsequent lazy navigation, no Android bridge, warm history,
unchanged/error history, NP More and stale navigation/profile/account/source.
DOM rendering/keyboard focus on a real client still require browser acceptance.
Successful empty arrays clear the date. The newest released unwatched episode
comes from existing MyShows episode metadata; known release dates survive NP
cards that omit it. Local successful marks invalidate older pending history
responses. Undo invalidates the history cache. Profile/token/generation guards
reject responses after logout or profile ABA. A changed authorization token,
including automatic renewal and synchronized replacement, clears local history
and the channel. Without verified account identity this prevents reusing another
account's private dates in the same Lampa profile. The next ordinary list refresh
restores current data. The Android metadata allowlist
stays unchanged.

VM tests cover merged ordering, alphabetical ties, malformed/future dates,
list/channel parity, cache reuse and restart, NP missing dates, bounded requests,
errors, empty histories, successful mark/undo, and profile/logout guards. They do
not prove the authorized live v3 date format or ordering on a physical TV.
