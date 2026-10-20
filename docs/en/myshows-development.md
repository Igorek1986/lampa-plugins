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
