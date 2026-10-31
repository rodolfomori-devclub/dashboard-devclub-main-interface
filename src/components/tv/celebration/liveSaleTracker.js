/** Shared with TV Light as a generated classic script. Keep this function ES5
 * and self-contained: the exact same baseline/deduplication rules run there. */
export function createTvSaleTracker() {
  var day = '', sources = Object.create(null);
  function reset() { day = ''; sources = Object.create(null); }
  function consume(feed, options) {
    options = options || {};
    var now = typeof options.now === 'number' ? options.now : Date.now();
    if (options.active === false || options.healthy === false || !feed || !/^\d{4}-\d{2}-\d{2}$/.test(feed.day) || !Array.isArray(feed.groups) || feed.day !== new Date(now - 10800000).toISOString().slice(0, 10)) { reset(); return []; }
    if (day !== feed.day) { reset(); day = feed.day; }
    var found = Object.create(null), output = [];
    feed.groups.forEach(function (group) {
      if (!group || typeof group.source !== 'string' || !/^[a-z-]{1,30}$/.test(group.source)) return;
      var name = group.source;
      found[name] = true;
      if (group.ready !== true) {
        // Normal stale-while-refreshing polls are not a provider outage. Keep
        // the established cutoff through a short refresh, without emitting.
        if (group.refreshing === true && sources[name]) {
          if (!sources[name].pendingSince) sources[name].pendingSince = now;
          if (now - sources[name].pendingSince <= 120000) return;
        }
        delete sources[name]; return;
      }
      if (!Array.isArray(group.events)) { delete sources[name]; return; }
      var state = sources[name], baseline = !state || state.count > 10000;
      if (baseline) state = sources[name] = { seen: Object.create(null), count: 0, since: now };
      if (state.pendingSince && now - state.pendingSince > 120000) { state = sources[name] = { seen: Object.create(null), count: 0, since: now }; baseline = true; }
      state.pendingSince = 0;
      group.events.forEach(function (event) {
        if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 256 || state.seen[event.id]) return;
        state.seen[event.id] = true; state.count++;
        // Corrections, undated imports and past sales must never turn into a
        // notification merely because the cache or attribution was refreshed.
        if (baseline || typeof event.occurredAt !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(event.occurredAt)) return;
        var time = Date.parse(event.occurredAt);
        if (!isFinite(time) || time < state.since || now - time > 600000 || time > now + 60000 || new Date(time - 10800000).toISOString().slice(0, 10) !== day || typeof event.amount !== 'number' || !isFinite(event.amount) || event.amount <= 0) return;
        var next = { id: event.id, source: name, occurredAt: event.occurredAt, amount: event.amount };
        if (typeof event.sellerName === 'string' && event.sellerName.trim()) next.sellerName = event.sellerName.trim().slice(0, 120);
        output.push(next);
      });
    });
    Object.keys(sources).forEach(function (name) { if (!found[name]) delete sources[name]; });
    output.sort(function (a, b) { return Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id); });
    return output;
  }
  return { consume: consume, reset: reset };
}
