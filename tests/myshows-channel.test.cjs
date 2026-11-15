const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// DOM, network, timers and the Android bridge are environment boundaries.
// The complete shipped plugin executes unchanged; no private/test-only exports.
function launch(options = {}) {
    const data = new Map(Object.entries({myshows_server_cache_ver: 6,
        myshows_token_profile_a: 'test-token', myshows_android_tv_profile_a: 'true',
        myshows_calendar_profile_a: 'false', myshows_sort_order_profile_a: 'alphabet',
        myshows_unwatched_serials_profile_a: {shows: JSON.parse(JSON.stringify(options.cards || []))}, ...options.storage}));
    const handlers = {}, timers = [], requests = [], calls = [], params = [], notices = [], components = {};
    const bus = {follow(name, fn) { (handlers[name] ||= []).push(fn); }};
    const element = {length: 0, querySelector: () => null, querySelectorAll: () => [],
        classList: {add(){}, remove(){}, contains(){return false;}}, style: {},
        setAttribute(){}, removeAttribute(){}, addEventListener(){}, appendChild(){},
        append(){}, remove(){}};
    const jq = new Proxy({length: 0}, {get(target, key) {
        if (key in target) return target[key];
        if (key === 'get') return () => element;
        return () => jq;
    }});
    const document = {currentScript: null, body: element, head: element,
        documentElement: element, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({...element}), addEventListener(){}, getElementById: () => null};
    let profile = 'a', active = null;
    const permit = {account: {profile: {get id() { return profile; }}}};
    function Reguest() {
        this.timeout = () => {};
        this.silent = this.native = (url, success, failure, body, config) => {
            requests.push({url, success, failure, body: body && JSON.parse(body), config});
        };
    }
    function Status(count) {
        const results = {};
        this.append = (key, value) => {results[key] = value;
            if (Object.keys(results).length === count) this.onComplite(results);};
    }
    const storage = {get: (key, fallback) => data.has(key) ? data.get(key) : fallback,
        set: (key, value) => data.set(key, value), field: () => 'tmdb'};
    const Lampa = {Storage: storage, Listener: bus, Account: {Permit: permit, listener: bus},
        Player: {listener: bus}, Platform: {is: () => false, tv: () => true},
        Reguest, Status, Api: {sources: {tmdb: {main(){}}, cub: {main(){}}},
            partNext(parts) { parts.forEach(fn => fn(() => {})); }, ...options.api},
        SettingsApi: {addComponent(){}, removeComponent(){}, addParam(p) {params.push(p);}},
        Activity: {active: () => active, push(){}, replace(){}},
        Utils: {addUrlComponent: (u) => u, hash: () => 'hash'},
        TMDB: {key: () => 'public-test-key', api: u => 'https://tmdb.invalid/' + u},
        Maker: options.maker, Arrays:{shuffle:array=>array}, Component: {add(name, factory){components[name]=factory;}}, Template: {add(){}}, Manifest: {},
        Timeline: {listener: bus}, Noty: {show: message => notices.push(message)},
        Lang: {translate: x => x, add(){}}};
    const AndroidJS = options.bridge === 'missing' ? undefined : options.bridge === 'old' ? {} : {
        publishPluginChannel(payload) {calls.push({publish: JSON.parse(payload)}); return options.reject !== true;},
        clearPluginChannel(id) {calls.push({clear: id}); return options.reject !== true;}
    };
    const context = {Lampa, AndroidJS, document, console: {log(){}, info(){}, warn(){}, error(){}, debug(){}},
        URLSearchParams, XMLHttpRequest: function() { this.open = this.setRequestHeader = this.send = () => {}; },
        localStorage: {getItem: key => data.has(key) ? JSON.stringify(data.get(key)) : null,
            removeItem: key => data.delete(key), setItem: (key,value) => data.set(key,value)},
        sessionStorage: {getItem: () => null, removeItem(){}, setItem(){}},
        $: () => jq, setTimeout(fn, delay) {const t = {fn, delay}; timers.push(t); return t;},
        clearTimeout(t) {const i = timers.indexOf(t); if(i >= 0) timers.splice(i,1);},
        location: {origin: 'https://example.invalid', reload(){}}, appready: true};
    if (options.np) {context.IS_NP = true;
        data.set('myshows_use_np_profile_a','true');
        data.set('base_url_numparser','https://np.invalid');
        data.set('numparser_api_key','test-np-token');}
    if (options.sync) context.__NMSync = {patch(...args){(context.syncPatches ||= []).push(args);}, register(name, keys, apply) {context.applySync = apply;context.syncKeys=keys;}};
    context.window = context;
    if (options.nativeActivity) {
        Lampa.Activity.own=component=>active?.activity?.component===component;
        vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fixtures/lampa-activity-lifecycle-contract.js'),'utf8'),context);
    }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', options.variant || process.env.MYSHOWS_VARIANT || 'myshows.full.js'), 'utf8'), context);
    const run = delay => {const i = timers.findIndex(t => t.delay === delay);
        assert.notEqual(i, -1, 'expected lifecycle timer ' + delay); timers.splice(i,1)[0].fn();};
    const setting = key => {const p = params.findLast(p => p.param.name === key);
        assert.ok(p, 'setting exists: ' + key); return p;};
    const changeProfile = id => {profile = id; (handlers.profile_select || []).forEach(fn => fn({}));};
    const answer = (method, response) => {const i = requests.findIndex(r => r.body?.method === method);
        assert.notEqual(i,-1,'requested ' + method); requests.splice(i,1)[0].success(response);};
    const answerUrl = (text, response) => {const i = requests.findIndex(r => r.url.includes(text));
        assert.notEqual(i,-1,'requested URL ' + text); requests.splice(i,1)[0].success(response);};
    const emit = (name, data) => (handlers[name] || []).forEach(fn => fn(data));
    return {context, data, calls, requests, timers, run, setting, params, answer, answerUrl, changeProfile, notices, emit, components, setActive(value){active=value;}};
}

const cards = [
    {id: 2, name: 'Zulu', original_name: 'Zulu', poster_path: '/z.jpg', overview: 'Original',
        myshowsId: 20, remaining: 3, next_episode: 'S02/E04', watched_count: 3, total_count: 4,
        secret: 'must not leave', token: 'must not leave'},
    {id: 1, name: 'Alpha', original_name: 'Alpha', poster_path: '/a.jpg', myshowsId: 10,
        remaining: 1, watched_count: 1, total_count: 4}
];

test('startup uses sorted copies and excludes authentication/unrelated data', () => {
    const app = launch({cards}); app.run(50);
    const payload = app.calls.find(c => c.publish)?.publish;
    assert.ok(payload, 'enabled startup publishes cache');
    assert.deepEqual(payload.items.map(c => c.id), ['1','2']);
    assert.equal(payload.id, 'myshows'); assert.equal(payload.title, 'MyShows');
    assert.equal(payload.items[0].source,'tmdb'); assert.equal(payload.items[0].type,'tv');
    assert.equal(payload.items[1].poster_path,'/z.jpg');
    assert.match(payload.items[1].overview,/S02\/E04/); assert.match(payload.items[1].overview,/3/);
    assert.equal(payload.items[1].secret,undefined); assert.equal(payload.items[1].token,undefined);
    assert.equal(cards[0].source,undefined); assert.equal(cards[0].overview,'Original');
});
for (const bridge of ['missing','old']) test('unsupported ' + bridge + ' native keeps plugin usable', () => {
    const app = launch({cards, bridge}); app.run(50); app.run(2000);
    assert.equal(app.calls.length,0); assert.ok(app.context.MyShows.isLoggedIn());
    assert.match(app.setting('myshows_android_tv').field.description,/Android|Lampa/);
});
test('default opt-out never publishes', () => {
    const app = launch({cards, storage: {myshows_android_tv_profile_a: 'false'}}); app.run(50);
    assert.equal(app.calls.filter(c => c.publish).length,0);
});
test('enable publishes cache; disable clears immediately', () => {
    const app = launch({cards, storage: {myshows_android_tv_profile_a: 'false'}});
    app.run(2000); app.setting('myshows_android_tv').onChange(true);
    assert.equal(app.calls.filter(c => c.publish).length,1);
    app.setting('myshows_android_tv').onChange(false);
    assert.equal(app.calls.at(-1)?.clear,'myshows');
});
test('successful empty refresh clears but request errors preserve published data', () => {
    const app = launch({cards}); app.run(50); app.run(10000);
    const count = app.calls.length;
    app.answer('lists.EpisodesUnwatched',{error: {code: 500}});
    assert.equal(app.calls.length,count);
    app.context.MyShows.getUnwatchedShowsWithDetails(() => {}); app.run(10000);
    app.answer('lists.EpisodesUnwatched',{result: []});
    assert.equal(app.calls.at(-1)?.clear,'myshows');
});
test('profile ABA rejects the first profile generation response', () => {
    const app = launch({cards, storage: {myshows_token_profile_b: 'other',
        myshows_android_tv_profile_b:'true', myshows_calendar_profile_b:'false'}});
    app.run(50); app.run(10000);
    app.changeProfile('b'); app.changeProfile('a');
    assert.equal(app.calls.at(-1)?.clear,'myshows');
    const count = app.calls.length;
    app.answer('lists.EpisodesUnwatched',{result: []});
    assert.equal(app.calls.length,count);
});
test('logout rejects an in-flight response even after same token is restored', () => {
    const app = launch({cards}); app.run(50); app.run(2000); app.run(10000);
    app.params.find(p => p.field.name === 'Выйти из MyShows').onChange();
    assert.equal(app.calls.at(-1)?.clear,'myshows');
    app.data.set('myshows_token_profile_a','test-token');
    const count = app.calls.length;
    app.answer('lists.EpisodesUnwatched',{result: []});
    assert.equal(app.calls.length,count);
});
test('sort change republishes last successful list without API request', () => {
    const app = launch({cards}); app.run(50); app.run(2000);
    const count = app.requests.length;
    app.setting('myshows_sort_order').onChange('progress');
    assert.deepEqual(app.calls.at(-1)?.publish.items.map(c => c.id),['2','1']);
    app.setting('myshows_sort_order').onChange('unwatched_count');
    assert.deepEqual(app.calls.at(-1).publish.items.map(c => c.id),['1','2']);
    app.setting('myshows_sort_order').onChange('air_date');
    assert.equal(app.requests.length,count);
});
test('native rejection is reported and does not crash disable', () => {
    const app = launch({cards, reject: true}); app.run(50); app.run(2000);
    app.setting('myshows_android_tv').onChange(false);
    assert.equal(app.calls.at(-1).clear,'myshows'); assert.ok(app.notices.length > 0);
});

test('partial NP cache is replaced by the full fresh enriched list', () => {
    const app = launch({np: true}); app.run(50);
    const partial = {...cards[1], seasons: [{season_number: 1}], progress_marker:'1/4'};
    app.answerUrl('/myshows/watching?',{results: [partial], page:1, total_pages:2});
    assert.deepEqual(app.calls.at(-1)?.publish.items.map(c => c.id),['1']);
    app.run(10000);
    app.answer('lists.EpisodesUnwatched',{result: [
        {show: {id:10,title:'Alpha',titleOriginal:'Alpha',year:2020},episodes:[
            {id:101,seasonNumber:1,episodeNumber:2,shortName:'s01e02',airDate:'2020-01-02'}]},
        {show: {id:20,title:'Zulu',titleOriginal:'Zulu',year:2020},episodes:[
            {id:201,seasonNumber:2,episodeNumber:4,shortName:'s02e04',airDate:'2020-01-03'}]}
    ]});
    app.answerUrl('/myshows/watching?',{results:[partial]});
    app.answer('shows.GetById',{result:{episodes:[{id:101,seasonNumber:1,episodeNumber:2,airDate:'2020-01-02'}]}});
    app.answerUrl('search/tv',{results:[{id:2,name:'Zulu',original_name:'Zulu',first_air_date:'2020-01-01'}]});
    app.answerUrl('/tv/2?',{id:2,name:'Zulu',original_name:'Zulu',poster_path:'/z.jpg',first_air_date:'2020-01-01',seasons:[{season_number:2}]});
    app.answer('shows.GetById',{result:{episodes:[{id:201,seasonNumber:2,episodeNumber:4,airDate:'2020-01-03'}]}});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c => c.id),['1','2']);
    assert.match(app.calls.at(-1).publish.items[1].overview,/S02\/E04/);
});

test('disable then enable rejects an old refresh even for the same profile', () => {
    const app = launch({cards}); app.run(50); app.run(2000); app.run(10000);
    app.setting('myshows_android_tv').onChange(false);
    app.setting('myshows_android_tv').onChange(true);
    const count = app.calls.length;
    app.answer('lists.EpisodesUnwatched',{result: []});
    assert.equal(app.calls.length,count);
    assert.deepEqual(app.calls.at(-1).publish.items.map(c => c.id),['1','2']);
});

test('episode mark and unmark republish next episode and completed show clears', () => {
    const card = {id:1, name:'Alpha', original_name:'Alpha', poster_path:'/a.jpg', myshowsId:10,
        remaining:2, watched_count:0, total_count:2, progress_marker:'0/2', next_episode:'S01/E01',
        unwatchedEpisodes:[{id:101},{id:102}]};
    const app = launch({cards:[card], storage:{
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',titleOriginal:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{
            '1:first':{tmdbId:1,episodeId:101,seasonNumber:1,episodeNumber:1,airDate:'2020-01-01',timestamp:Date.now()},
            '1:second':{tmdbId:1,episodeId:102,seasonNumber:1,episodeNumber:2,airDate:'2020-01-02',timestamp:Date.now()}
        }
    }});
    app.run(50); app.emit('full',{type:'complite',data:{movie:card}});
    app.emit('start',{card});
    app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    assert.match(app.calls.at(-1).publish.items[0].overview,/S01\/E02/);
    assert.match(app.calls.at(-1).publish.items[0].overview,/Unwatched: 1/);
    app.emit('update',{data:{hash:'first',road:{percent:0}}});
    app.answer('manage.UnCheckEpisode',{result:true});
    assert.match(app.calls.at(-1).publish.items[0].overview,/S01\/E01/);
    assert.match(app.calls.at(-1).publish.items[0].overview,/Unwatched: 2/);
    app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    app.emit('update',{data:{hash:'second',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    assert.equal(app.calls.at(-1).clear,'myshows');
});

test('logout rejects a pending episode-mark publication after token restoration', () => {
    const card = {id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,
        remaining:2,progress_marker:'0/2',unwatchedEpisodes:[{id:101},{id:102}]};
    const app = launch({cards:[card], storage:{
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,seasonNumber:1,
            episodeNumber:1,airDate:'2020-01-01',timestamp:Date.now()}}
    }});
    app.run(50); app.run(2000); app.emit('full',{type:'complite',data:{movie:card}});
    app.emit('start',{card}); app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.params.find(p => p.field.name === 'Выйти из MyShows').onChange();
    app.data.set('myshows_token_profile_a','test-token');
    const count = app.calls.length;
    app.answer('manage.CheckEpisode',{result:true});
    assert.equal(app.calls.length,count,'late episode mark cannot restore cleared cards');
});

module.exports = {launch, cards};

test('unmark after completion restores the show through authoritative refresh', () => {
    const card = {id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,
        remaining:1,progress_marker:'0/1',unwatchedEpisodes:[{id:101}]};
    const app = launch({cards:[card], storage:{
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,seasonNumber:1,
            episodeNumber:1,airDate:'2020-01-01',timestamp:Date.now()}}
    }});
    app.run(50); app.emit('full',{type:'complite',data:{movie:card}}); app.emit('start',{card});
    app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    assert.equal(app.calls.at(-1).clear,'myshows');
    app.emit('update',{data:{hash:'first',road:{percent:0}}});
    app.answer('manage.UnCheckEpisode',{result:true});
    app.answer('lists.EpisodesUnwatched',{result:[{show:{id:10,title:'Alpha',titleOriginal:'Alpha',year:2020},
        episodes:[{id:101,seasonNumber:1,episodeNumber:1,shortName:'s01e01',airDate:'2020-01-01'}]}]});
    app.answerUrl('search/tv',{results:[{id:1,name:'Alpha',original_name:'Alpha',first_air_date:'2020-01-01'}]});
    app.answerUrl('/tv/1?',{id:1,name:'Alpha',original_name:'Alpha',first_air_date:'2020-01-01',seasons:[{season_number:1}]});
    app.answer('shows.GetById',{result:{episodes:[{id:101,seasonNumber:1,episodeNumber:1,airDate:'2020-01-01'}]}});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c => c.id),['1']);
    assert.match(app.calls.at(-1).publish.items[0].overview,/S01\/E01/);
});

test('local episode update from partial NP cache preserves unrelated published shows', () => {
    const first = {id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,remaining:2,
        progress_marker:'0/2',unwatchedEpisodes:[{id:101},{id:102}]};
    const other = {id:2,name:'Zulu',original_name:'Zulu',myshowsId:20,remaining:1};
    const app = launch({np:true,storage:{myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,
        seasonNumber:1,episodeNumber:1,airDate:'2020-01-01',timestamp:Date.now()}}}});
    app.run(50); app.answerUrl('/myshows/watching?',{results:[first,other]});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c => c.id),['1','2']);
    app.emit('full',{type:'complite',data:{movie:first}});
    app.answerUrl('/myshows/watching?',{results:[first,other]});
    app.answerUrl('/myshows/status?',{cache_type:'watching'});
    app.emit('start',{card:first}); app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    assert.equal(app.requests.filter(r => r.body?.method === 'lists.EpisodesUnwatched').length,0);
    app.answerUrl('/myshows/watching?',{results:[first],page:1,total_pages:2});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c => c.id),['1','2']);
    assert.match(app.calls.at(-1).publish.items[0].overview,/Unwatched: 1/);
});

test('logout invalidates the authoritative unmark fallback response', () => {
    const card = {id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,
        remaining:1,progress_marker:'0/1',unwatchedEpisodes:[{id:101}]};
    const app = launch({cards:[card],storage:{
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,seasonNumber:1,
            episodeNumber:1,airDate:'2020-01-01',timestamp:Date.now()}}
    }});
    app.run(50); app.run(2000); app.emit('full',{type:'complite',data:{movie:card}});
    app.emit('start',{card}); app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    app.emit('update',{data:{hash:'first',road:{percent:0}}});
    app.answer('manage.UnCheckEpisode',{result:true});
    assert.ok(app.requests.some(r => r.body?.method === 'lists.EpisodesUnwatched'));
    app.params.find(p => p.field.name === 'Выйти из MyShows').onChange();
    app.data.set('myshows_token_profile_a','test-token');
    const count = app.calls.length;
    app.answer('lists.EpisodesUnwatched',{result:[]});
    assert.equal(app.calls.length,count,'old fallback cannot touch the current generation');
});

// A missing history fetch/comparator, cache reuse, or generation guard breaks these tests.
const relevanceCards = [
    {id:3,name:'Alpha',myshowsId:30},
    {id:2,name:'Bravo',myshowsId:20,last_episode_to_myshows:{air_date:'2020-01-03'}},
    {id:1,name:'Zulu',myshowsId:10,last_episode_to_myshows:{air_date:'2020-01-01'}},
    {id:4,name:'Delta',myshowsId:40,last_episode_to_myshows:{air_date:'2999-01-01'}},
    {id:5,name:'Echo',myshowsId:50,last_episode_to_myshows:{air_date:'2020-02-30'}}
];
const history = date => ({result:date ? [{id:101,watchDate:date,rating:0,isMoveAble:false}] : []});
function answerHistory(app, id, response) {
    const index = app.requests.findIndex(r => r.body?.method === 'profile.Episodes' && r.body.params.showId === id);
    assert.notEqual(index,-1,'history requested for show '+id);
    app.requests.splice(index,1)[0].success(response);
}
test('relevance merges last viewing and released episode dates with list/channel parity', () => {
    const app = launch({cards:relevanceCards,storage:{myshows_sort_order_profile_a:'relevance'}});
    app.run(50);
    answerHistory(app,10,history('2020-01-04T00:00:00Z'));
    answerHistory(app,20,history('2020-01-02'));
    answerHistory(app,30,history('2020-01-02'));
    answerHistory(app,40,history('2999-01-01'));
    answerHistory(app,50,history('01.02.2020'));
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['1','2','3','4','5']);
    let list;
    app.context.MyShows.getUnwatchedShowsWithDetails(result=>list=result.shows);
    assert.deepEqual(Array.from(list,c=>c.id),[1,2,3,4,5]);
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,0);
    assert.equal(app.calls.at(-1).publish.items[0].watchDate,undefined);
});
test('relevance bounds concurrency and ignores history after profile ABA', () => {
    const app=launch({cards:relevanceCards,storage:{myshows_sort_order_profile_a:'relevance',myshows_token_profile_b:'other'}});
    app.run(50);
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,2);
    const before = JSON.stringify(app.data.get('myshows_relevance_history_profile_a'));
    app.changeProfile('b'); app.changeProfile('a');
    const count=app.calls.length;
    answerHistory(app,10,history('2020-01-04')); answerHistory(app,20,history('2020-01-02'));
    assert.equal(app.calls.length,count);
    assert.equal(JSON.stringify(app.data.get('myshows_relevance_history_profile_a')),before);
});
test('other modes do not fetch viewing history', () => {
    const app=launch({cards}); app.run(50); app.run(2000);
    app.setting('myshows_sort_order').onChange('air_date');
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,0);
});

test('relevance error preserves persisted watch date and successful empty clears it', () => {
    const app=launch({cards:cards,storage:{myshows_sort_order_profile_a:'relevance',
        myshows_relevance_history_profile_a:{20:{watch:1578096000000,dateParser:2,checked:1}}}});
    app.run(50);
    answerHistory(app,10,history('2020-01-02'));
    answerHistory(app,20,{error:{code:500}});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['2','1']);
    const stored=JSON.parse(JSON.stringify(app.data.get('myshows_relevance_history_profile_a')));
    stored[20].checked=1;
    const restarted=launch({cards,storage:{myshows_sort_order_profile_a:'relevance',myshows_relevance_history_profile_a:stored}});
    restarted.run(50);
    answerHistory(restarted,20,history(null));
    assert.deepEqual(restarted.calls.at(-1).publish.items.map(c=>c.id),['1','2']);
});
test('relevance logout ignores history after restoring the same token', () => {
    const app=launch({cards,storage:{myshows_sort_order_profile_a:'relevance'}});
    app.run(50); app.run(2000);
    app.params.find(p=>p.field.name==='Выйти из MyShows').onChange();
    app.data.set('myshows_token_profile_a','test-token');
    const count=app.calls.length;
    answerHistory(app,10,history('2020-01-04')); answerHistory(app,20,history(null));
    assert.equal(app.calls.length,count);
    assert.equal(app.data.get('myshows_relevance_history_profile_a')?.[10]?.watch,undefined);
});
test('successful mark raises relevance then unmark refetches and restores older date', () => {
    const card={id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,remaining:2,
        progress_marker:'0/2',unwatchedEpisodes:[{id:101},{id:102}]};
    const app=launch({cards:[card,cards[0]],storage:{myshows_sort_order_profile_a:'relevance',
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,seasonNumber:1,episodeNumber:1,
            airDate:'2020-01-01',timestamp:Date.now()}}}});
    app.run(50); answerHistory(app,10,history('2020-01-02')); answerHistory(app,20,history('2020-01-03'));
    app.emit('full',{type:'complite',data:{movie:card}}); app.emit('start',{card});
    app.emit('update',{data:{hash:'first',road:{percent:100}}});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['2','1']);
    app.answer('manage.CheckEpisode',{result:true});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['1','2']);
    app.emit('update',{data:{hash:'first',road:{percent:0}}});
    app.answer('manage.UnCheckEpisode',{result:true});
    answerHistory(app,10,history('2020-01-02'));
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['2','1']);
});

test('relevance uses newest released episode when the last metadata episode is future', () => {
    const app=launch({cards:[{id:1,name:'Alpha',myshowsId:10,
        last_episode_to_myshows:{air_date:'2999-01-01'},
        unwatchedEpisodes:[{id:101,airDate:'2020-01-04'},{id:102,airDate:'2999-01-01'}]},
        {id:2,name:'Bravo',myshowsId:20,last_episode_to_myshows:{air_date:'2020-01-03'}}],
        storage:{myshows_sort_order_profile_a:'relevance'}});
    app.run(50); answerHistory(app,10,history(null)); answerHistory(app,20,history(null));
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['1','2']);
});

test('relevance NP cards without dates retain persisted release and viewing dates', () => {
    const app=launch({np:true,storage:{myshows_sort_order_profile_a:'relevance',
        myshows_relevance_history_profile_a:{10:{watch:1578096000000,dateParser:2,checked:Date.now()},
            20:{release:1578009600000,dateParser:2,checked:Date.now()}}}});
    app.run(50); app.answerUrl('/myshows/watching?',{results:[cards[0],cards[1]]});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['1','2']);
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,0);
});
test('relevance startup loads history even without an Android bridge', () => {
    const app=launch({cards,bridge:'missing',storage:{myshows_sort_order_profile_a:'relevance'}});
    app.run(50);
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,2);
});

test('logout clears private viewing dates before another MyShows account uses the profile', () => {
    const app=launch({cards,storage:{myshows_relevance_history_profile_a:{10:{watch:1578096000000,dateParser:2,checked:Date.now()}}}});
    app.run(2000); app.params.find(p=>p.field.name==='Выйти из MyShows').onChange();
    assert.deepEqual(Object.keys(app.data.get('myshows_relevance_history_profile_a')),[]);
});
test('successful mark without MyShows id records matched cached history with Android off', () => {
    const card={id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,remaining:2,
        progress_marker:'0/2',unwatchedEpisodes:[{id:101},{id:102}]};
    const app=launch({cards:[card],storage:{myshows_android_tv_profile_a:'false',
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,seasonNumber:1,episodeNumber:1,
            airDate:'2020-01-01',timestamp:Date.now()}}}});
    const playerCard={id:1,name:'Alpha',original_name:'Alpha'};
    app.run(50); app.emit('full',{type:'complite',data:{movie:playerCard}}); app.emit('start',{card:playerCard});
    app.emit('update',{data:{hash:'first',road:{percent:100}}});
    app.answer('manage.CheckEpisode',{result:true});
    assert.ok(app.data.get('myshows_relevance_history_profile_a')?.[10]?.watch > 1578096000000);
});

test('ordinary NP list callback still completes when MyShows has no token', () => {
    const app=launch({np:true,storage:{myshows_token_profile_a:''}});
    let result; app.context.MyShows.getUnwatchedShowsWithDetails(value=>result=value);
    assert.ok(result, 'no-token response completes');
    assert.deepEqual(Array.from(result.shows),[]);
});
test('NP id-only episode arrays do not erase a known release date', () => {
    const app=launch({np:true,storage:{myshows_sort_order_profile_a:'relevance',
        myshows_relevance_history_profile_a:{10:{release:1578009600000,dateParser:2,checked:Date.now()},
            20:{release:1578096000000,dateParser:2,checked:Date.now()}}}});
    app.run(50); app.answerUrl('/myshows/watching?',{results:[
        {...cards[0],unwatched_episodes:[201]},{...cards[1],unwatched_episodes:[101]}]});
    assert.deepEqual(app.calls.at(-1).publish.items.map(c=>c.id),['2','1']);
});

test('relevance NP list callback completes an unauthenticated empty result', () => {
    const app=launch({np:true,storage:{myshows_token_profile_a:'',myshows_sort_order_profile_a:'relevance'}});
    let result; app.context.MyShows.getUnwatchedShowsWithDetails(value=>result=value);
    assert.ok(result,'empty response completes');
    assert.deepEqual(Array.from(result.shows),[]);
});

test('synced replacement token clears private history for its target profile', () => {
    const app=launch({sync:true,cards,storage:{myshows_relevance_history_profile_a:{10:{watch:1578096000000}}}});
    app.context.applySync('myshows_token_profile_a','another-account');
    assert.deepEqual(Object.keys(app.data.get('myshows_relevance_history_profile_a')),[]);
});
test('completed show undo refreshes history with Android channel off', () => {
    const card={id:1,name:'Alpha',original_name:'Alpha',myshowsId:10,remaining:1,
        progress_marker:'0/1',unwatchedEpisodes:[{id:101}]};
    const app=launch({cards:[card],storage:{myshows_sort_order_profile_a:'relevance',myshows_android_tv_profile_a:'false',
        myshows_serial_status_profile_a:{shows:[{id:10,title:'Alpha',watchStatus:'watching'}]},
        myshows_hash_map:{'1:first':{tmdbId:1,episodeId:101,seasonNumber:1,episodeNumber:1,
            airDate:'2020-01-01',timestamp:Date.now()}}}});
    app.run(50); answerHistory(app,10,history(null));
    app.emit('full',{type:'complite',data:{movie:card}}); app.emit('start',{card});
    app.emit('update',{data:{hash:'first',road:{percent:100}}}); app.answer('manage.CheckEpisode',{result:true});
    app.emit('update',{data:{hash:'first',road:{percent:0}}}); app.answer('manage.UnCheckEpisode',{result:true});
    answerHistory(app,10,history(null));
    assert.equal(app.data.get('myshows_relevance_history_profile_a')[10].watch,0);
});

test('DOM cards with older metadata follow the fresh relevance channel order', () => {
    const fresh=[{id:1,name:'Alpha',myshowsId:10,last_episode_to_myshows:{air_date:'2020-01-04'}},
        {id:2,name:'Bravo',myshowsId:20,last_episode_to_myshows:{air_date:'2020-01-03'}}];
    const app=launch({cards:fresh,storage:{myshows_sort_order_profile_a:'relevance',
        myshows_relevance_history_profile_a:{10:{dateParser:2,checked:Date.now()},20:{dateParser:2,checked:Date.now()}}}});
    const elements=fresh.map(c=>({card_data:JSON.parse(JSON.stringify(c)),classList:{contains:()=>true}}));
    elements[0].card_data.last_episode_to_myshows.air_date='2020-01-01';
    const order=[],container={children:elements,appendChild:e=>order.push(e.card_data.id)};
    elements.forEach(e=>e.parentNode=container);
    const section={querySelectorAll:()=>elements,querySelector:()=>null};
    app.context.document.querySelectorAll=q=>q==='.items-line__title'?[{textContent:'MyShows',closest:()=>section}]:[];
    app.run(50);
    assert.deepEqual(order,[1,2]);
});

test('cached relevance list returns once before history completes and remains on error', () => {
    const app=launch({cards,storage:{myshows_sort_order_profile_a:'relevance'}});
    const results=[];
    app.context.MyShows.getUnwatchedShowsWithDetails(result=>results.push(Array.from(result.shows,c=>c.id)));
    assert.deepEqual(results,[[1,2]],'cached cards return while history requests remain pending');
    answerHistory(app,10,{error:{code:500}}); answerHistory(app,20,{error:{code:500}});
    assert.deepEqual(results,[[1,2]],'history does not redeliver the list callback');
});
test('fresh relevance list returns once before viewing history completes', () => {
    const app=launch({storage:{myshows_sort_order_profile_a:'relevance'}});
    const results=[];
    app.context.MyShows.getUnwatchedShowsWithDetails(result=>results.push(Array.from(result.shows,c=>c.id)));
    app.answer('lists.EpisodesUnwatched',{result:[{show:{id:10,title:'Alpha',titleOriginal:'Alpha',year:2020},
        episodes:[{id:101,seasonNumber:1,episodeNumber:1,shortName:'s01e01',airDate:'2020-01-01'}]}]});
    app.answerUrl('search/tv',{results:[{id:1,name:'Alpha',original_name:'Alpha',first_air_date:'2020-01-01'}]});
    app.answerUrl('/tv/1?',{id:1,name:'Alpha',original_name:'Alpha',first_air_date:'2020-01-01',seasons:[{season_number:1}]});
    app.answer('shows.GetById',{result:{episodes:[{id:101,seasonNumber:1,episodeNumber:1,airDate:'2020-01-01'}]}});
    assert.deepEqual(results,[[1]],'enriched fresh list returns while history remains pending');
    answerHistory(app,10,history('2020-01-02'));
    assert.deepEqual(results,[[1]],'history updates cards without another list callback');
});

// Native lazy Line must be rebuilt from the complete newly sorted list, not DOM-sorted.
function relevanceHome(options = {}) {
    let rows, rebuilds = 0, line;
    const source = {main(request, done) { done([]); }};
    const app = launch({bridge:'missing',nativeActivity:true,cards:Array.from({length:21},(_,i)=>({
        id:i+1,myshowsId:i+1,name:i===20?'Zulu':'Alpha '+String(i).padStart(2,'0')})),
        storage:{myshows_sort_order_profile_a:'relevance',...options.storage},
        api:{sources:{tmdb:source,cub:{main(){}}}}});
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fixtures/lampa-line-items-contract.js'),'utf8'),app.context);
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fixtures/lampa-activity-replace-contract.js'),'utf8'),app.context);
    const items = app.context.__nativeLineItemsContract;
    function build(data) {
        rows=data;
        line={data:rows[0],params:{items:{view:7}},scroll:{body:()=>({addClass(){}}),append(){},update(){},render(){}},
            has:()=>false,emit(name,card){ if(name==='createAndAppend') {
                const render={on(){}};const item={data:card,render:()=>render,destroy(){}};
                items.onAppend.call(line,item,{params:{}});
            }}};
        items.onInit.call(line);items.onCreate.call(line);
    }
    const target={component:'main',source:'tmdb'};
    target.activity={...app.context.__nativeActivityLifecycleContract,component:{},loader(){},destroy(){}};
    app.setActive(target);app.run(50);
    app.context.Lampa.Activity.own=component=>component===target.activity.component;
    app.context.Lampa.Activity.replace=app.context.__nativeActivityReplaceContract;
    app.context.__replaceNativePush=()=>{rebuilds++;target.activity={...target.activity,waite_refresh:false};load();};
    function load(){app.context.Lampa.Api.sources.tmdb.main(target,build,assert.fail);}
    load();
    return {...app,target,load,rows:()=>rows,line:()=>line,rebuilds:()=>rebuilds,scroll(){items.onScroll.call(line);}};
}
test('relevance completion replaces first20 membership and native lazy navigation without Android',()=>{
    const app=relevanceHome();
    assert.equal(app.rows()[0].results[0].id,1,'early callback does not wait for history');
    assert.equal(app.line().items.length,7);
    for(let id=1;id<=21;id++) answerHistory(app,id,history(id===21?'2026-10-20T12:00:00Z':null));
    app.run(400);
    assert.equal(app.rebuilds(),1);
    assert.equal(app.rows()[0].results[0].id,21,'recent show beyond first page enters home');
    assert.equal(app.line().items[0].data.id,21,'native backing and DOM share order');
    app.line().active=6;app.scroll();
    assert.deepEqual(Array.from(app.line().items,c=>c.data.id),Array.from(app.rows()[0].results.slice(0,15),c=>c.id));
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,0,'refresh reuses ready history');
    assert.equal(app.timers.filter(t=>t.delay===400).length,0,'no refresh loop');
});
for(const change of ['navigation','profile','account','source'])test('relevance completion cannot refresh stale '+change,()=>{
    const app=relevanceHome();
    if(change==='navigation') app.setActive({component:'main',activity:{refresh(){assert.fail('wrong screen');}}});
    if(change==='profile') app.changeProfile('b');
    if(change==='account') app.data.set('myshows_token_profile_a','replacement');
    if(change==='source') app.target.source='cub';
    for(let id=1;id<=21;id++) {
        const index=app.requests.findIndex(r=>r.body?.method==='profile.Episodes'&&r.body.params.showId===id);
        if(index>=0) app.requests.splice(index,1)[0].success(history(id===21?'2026-10-20T12:00:00Z':null));
    }
    assert.equal(app.timers.filter(t=>t.delay===400).length,0);
});

test('relevance cached release metadata sorts before the one fast callback',()=>{
    const app=launch({bridge:'missing',cards:[{id:1,myshowsId:1,name:'Alpha'},
        {id:2,myshowsId:2,name:'Zulu',last_episode_to_myshows:{air_date:'2020-01-01'}}],
        storage:{myshows_sort_order_profile_a:'relevance',myshows_relevance_history_profile_a:{
            1:{dateParser:2,checked:Date.now()},2:{dateParser:2,checked:Date.now()}}}});
    let count=0, ids;
    app.context.MyShows.getUnwatchedShowsWithDetails(result=>{count++;ids=Array.from(result.shows,c=>c.id);});
    assert.equal(count,1);assert.deepEqual(ids,[2,1]);
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,0);
});
function relevanceMore(options={}) {
    let built, hooks;
    const maker={module:()=>({MASK:{base:1},toggle(){return this;},only(){return this;}}),
        make(){return {use(value){hooks=value;},activity:{loader(){}},build(result){built=result;},empty(){}};}};
    const app=launch({bridge:'missing',maker,cards:options.cards||cards,np:options.np,
        storage:{myshows_sort_order_profile_a:'relevance',...options.storage}});
    app.run(50);
    app.context.Lampa.Activity.replace=()=>{app.context.refreshes=(app.context.refreshes||0)+1;};
    const target={component:'myshows_unwatched',page:1,activity:{}};
    app.setActive(target);
    const comp=app.components.myshows_unwatched(target);hooks.onCreate.call(comp);
    return {...app,target,reload(){const comp=app.components.myshows_unwatched(target);hooks.onCreate.call(comp);},built:()=>built};
}
test('unwatched More rebuild uses newly sorted full list instead of frozen raw cache',()=>{
    const app=relevanceMore();assert.deepEqual(Array.from(app.built().results,c=>c.id),[1,2]);
    answerHistory(app,10,history(null));answerHistory(app,20,history('2026-10-20T12:00:00Z'));
    app.run(400);assert.equal(app.context.refreshes,1);app.reload();
    assert.deepEqual(Array.from(app.built().results,c=>c.id),[2,1]);
});
test('NP unwatched More relevance uses complete normalized shows and history before paging',()=>{
    const app=relevanceMore({np:true});
    while(!app.built()) app.answerUrl('/myshows/watching?',{results:cards});
    assert.deepEqual(Array.from(app.built().results,c=>c.id),[1,2]);
    answerHistory(app,10,history(null));answerHistory(app,20,history('2026-10-20T12:00:00Z'));
    app.run(400);assert.equal(app.context.refreshes,1);app.reload();
    app.answerUrl('/myshows/watching?',{results:cards});
    assert.deepEqual(Array.from(app.built().results,c=>c.id),[2,1]);
});

test('unchanged or failed relevance scores retain initial native row without redundant refresh',()=>{
    const app=relevanceHome({storage:{myshows_relevance_history_profile_a:{21:{watch:1,dateParser:2,checked:1}}}});
    for(let id=1;id<=21;id++) answerHistory(app,id,id===21?{error:{code:500}}:history(null));
    assert.equal(app.timers.filter(t=>t.delay===400).length,0);
    assert.equal(app.line().items.length,7);
    assert.equal(app.data.get('myshows_relevance_history_profile_a')[21].watch,1);
});
test('MyShows full landing rebuild slices the authoritative relevance first20',()=>{
    let hooks,built;
    const maker={module:()=>({only(){return this;}}),make(){return {use(value){hooks=value;},
        activity:{loader(){}},build(result){built=result;},empty(){}};}};
    const list=Array.from({length:21},(_,i)=>({id:i+1,myshowsId:i+1,name:i===20?'Zulu':'Alpha '+i}));
    const app=launch({bridge:'missing',maker,cards:list,storage:{myshows_sort_order_profile_a:'relevance'}});
    app.run(50);
    app.context.Lampa.Activity.replace=()=>{app.context.refreshes=(app.context.refreshes||0)+1;};
    const target={component:'myshows_all',activity:{}};
    app.setActive(target);
    function load(){const comp=app.components.myshows_all(target);hooks.onCreate.call(comp);
        while(app.requests.some(r=>r.body&&['profile.Shows','profile.UnwatchedMovies','profile.WatchedMovies'].includes(r.body.method))) {
            const i=app.requests.findIndex(r=>r.body&&['profile.Shows','profile.UnwatchedMovies','profile.WatchedMovies'].includes(r.body.method));
            app.requests.splice(i,1)[0].success({result:[]});
        }}
    load();assert.ok(built);assert.equal(built[0].results.length,20);assert.notEqual(built[0].results[0].id,21);
    for(let id=1;id<=21;id++)answerHistory(app,id,history(id===21?'2026-10-20T12:00:00Z':null));
    app.run(400);assert.equal(app.context.refreshes,1);load();assert.equal(built[0].results[0].id,21);
});

test('live-shape compact offset viewing dates invalidate old zero cache without clearing known dates',()=>{
    const app=launch({bridge:'missing',cards,storage:{myshows_sort_order_profile_a:'relevance',
        myshows_relevance_history_profile_a:{10:{watch:0,checked:Date.now()},20:{watch:1,release:2,version:3,checked:Date.now()}}}});
    let result;app.context.MyShows.getUnwatchedShowsWithDetails(value=>result=value);
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,2,'old successful zero cannot suppress new parser');
    assert.equal(app.data.get('myshows_relevance_history_profile_a')[20].watch,1);
    answerHistory(app,10,history('2026-10-19T23:37:57+0300'));
    answerHistory(app,20,{error:{code:500}});
    assert.equal(result.shows[0].id,1);
    const map=app.data.get('myshows_relevance_history_profile_a');
    assert.equal(map[10].watch,Date.parse('2026-10-19T23:37:57+03:00'));
    assert.equal(map[20].watch,1);assert.equal(map[20].release,2);assert.equal(map[20].version,3);
    app.context.MyShows.getUnwatchedShowsWithDetails(()=>{});
    assert.equal(app.requests.filter(r=>r.body?.method==='profile.Episodes').length,0,'new schema cache and error retry remain bounded');
});
for(const value of ['2020-01-01T24:00:00+0300','2020-01-01T12:60:00+0300',
    '2020-01-01T12:00:60+0300','2020-01-01T12:00:00+2460',
    '2020-01-01T12:00:00+2360','2020-01-01T12:00:00+2400','2020-01-01T24:00:00+03:00',
    '2020-02-30T12:00:00+0300','2999-01-01T12:00:00+0300',
    '19.10.2026','2026-10-19T23:37:57'])test('relevance rejects damaged or ambiguous date '+value,()=>{
    const app=launch({bridge:'missing',cards:[cards[0]],storage:{myshows_sort_order_profile_a:'relevance'}});
    app.context.MyShows.getUnwatchedShowsWithDetails(()=>{});answerHistory(app,20,history(value));
    assert.equal(app.data.get('myshows_relevance_history_profile_a')[20].watch,0);
});

for(const change of ['navigation','profile','account','source','handle'])test('pending relevance replacement rejects '+change+' at execution time',()=>{
    const app=relevanceHome();
    for(let id=1;id<=21;id++)answerHistory(app,id,history(id===21?'2026-10-20T12:00:00Z':null));
    const oldHandle=app.target.activity;
    const next={component:'full',activity:{refresh(){assert.fail('next screen refreshed');}}};
    if(change==='navigation') app.setActive(next);
    if(change==='profile') app.changeProfile('b');
    if(change==='account') app.data.set('myshows_token_profile_a','replacement');
    if(change==='source') app.target.source='cub';
    if(change==='handle') app.target.activity={};
    app.run(400);
    assert.equal(app.rebuilds(),0,'no native replacement after ownership changed');
    if(change==='navigation')assert.equal(app.context.Lampa.Activity.active(),next,'new screen handle is untouched');
    if(change!=='handle')assert.equal(app.target.activity,oldHandle);
});

test('channel opt-in persists an explicit string false default and native profile mirror locally',()=>{
    const app=launch({sync:true});app.data.delete('myshows_android_tv_profile_a');app.run(2000);
    assert.equal(app.data.get('myshows_android_tv_profile_a'),'false');
    assert.equal(app.data.get('myshows_android_tv'),'false');
    assert.equal(app.setting('myshows_android_tv').param.default,'false');
    assert.equal(app.context.syncKeys.includes('myshows_android_tv'),false);
    assert.equal((app.context.syncPatches||[]).some(call=>call[1].includes('myshows_android_tv')),false);
});
for(const value of [true,false,'true','false'])test('channel mirror preserves explicit profile preference '+typeof value+' '+value,()=>{
    const app=launch({sync:true,storage:{myshows_android_tv_profile_a:value,myshows_android_tv_profile_b:'false'}});
    app.run(2000);assert.equal(app.data.get('myshows_android_tv_profile_a'),value);
    assert.equal(app.data.get('myshows_android_tv'),String(value));
    app.changeProfile('b');assert.equal(app.data.get('myshows_android_tv'),'false');
    app.changeProfile('a');assert.equal(app.data.get('myshows_android_tv'),String(value));
});
