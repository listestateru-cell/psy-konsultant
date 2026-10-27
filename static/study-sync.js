/* One server checkpoint for all of a learner's browsers. */
(function (root) {
  'use strict';
  const fields = ['cards', 'pos', 'ok', 'done', 'mode', 'subject', 'terms', 'lecture', 'seen',
    'generation', 'availability', 'requeue', 'pending', 'draft', 'earned', 'voice'];
  const transient = new Set(['_flight', 'advancing', 'storageError', 'blob', 'file', 'stream', 'recorder',
    '__proto__', 'prototype', 'constructor']);
  function clean(session) {
    if (!session) return null;
    const picked = {};
    for (const name of fields) if (session[name] !== undefined) picked[name] = session[name];
    return JSON.parse(JSON.stringify(picked, (key, value) =>
      transient.has(key) || key.startsWith('_') ? undefined : value));
  }
  function fingerprint(value) {
    return JSON.stringify(value, function (_, item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    });
  }
  function create(options) {
    const storage = options.storage, outboxKey = options.key + '.outbox', backupKey = options.key + '.backup';
    let generation = options.generation, revision = 0, ready = false, applying = false;
    let baseline = '', pending = null, flight = null, polling = null, timer = null, deferred = null;
    let status = 'loading', epoch = 0, urgentDelivery = false;
    const put = (key, value) => { try { value == null ? storage.removeItem(key) : storage.setItem(key, JSON.stringify(value)); } catch (_) {} };
    const read = key => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; } };
    const state = value => { status = value; options.status?.(value, !!read(backupKey)); };
    const persist = () => put(outboxKey, pending && { generation, revision, session: pending.session });
    function rememberConflict(session) { if (session) put(backupKey, { generation, session }); }
    function apply(snapshot) {
      if (snapshot.generation !== generation) { options.reset?.(snapshot.generation); return false; }
      if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < revision) return false;
      if (options.busy?.()) { deferred = snapshot; return false; }
      revision = snapshot.revision;
      const session = clean(snapshot.session);
      baseline = fingerprint(session); pending = null; deferred = null; persist();
      applying = true;
      try { options.apply(session); } finally { applying = false; }
      state(read(backupKey) ? 'conflict' : 'saved');
      return true;
    }
    function changed(session) {
      if (applying) return;
      const value = clean(session), signature = fingerprint(value);
      if (ready && signature === baseline && !flight) {
        pending = null; persist();
        if (timer != null) options.cancel?.(timer);
        timer = null; state(read(backupKey) ? 'conflict' : 'saved'); return;
      }
      if (pending && pending.signature === signature) return;
      pending = { session: value, signature }; persist(); state('saving');
      if (timer != null) options.cancel?.(timer);
      timer = options.schedule(() => { timer = null; flush(); }, 250);
    }
    async function start() {
      const token = epoch;
      state('loading');
      try {
        const snapshot = await options.request('GET');
        if (token !== epoch) return false;
        if (snapshot.generation !== generation) { options.reset?.(snapshot.generation); return false; }
        ready = true; revision = snapshot.revision;
        const saved = read(outboxKey), local = clean(options.read());
        const candidate = pending || (saved?.generation === generation ? { session: clean(saved.session) } : null);
        if (snapshot.revision === 0 && snapshot.session == null && (candidate?.session || local)) {
          baseline = fingerprint(null); pending = null; changed(candidate?.session || local);
          await flush(); return true;
        }
        if (candidate && saved?.revision === snapshot.revision) {
          baseline = fingerprint(clean(snapshot.session)); pending = null; changed(candidate.session);
          if (pending) await flush(); else apply(snapshot);
          return true;
        }
        if (candidate && fingerprint(candidate.session) !== fingerprint(clean(snapshot.session))) rememberConflict(candidate.session);
        else if (!candidate && local && fingerprint(local) !== fingerprint(clean(snapshot.session))) rememberConflict(local);
        apply(snapshot); return true;
      } catch (_) { if (token === epoch) state('offline'); return false; }
    }
    function flush(urgent = false) {
      urgentDelivery ||= urgent;
      if (!ready || !pending) return flight || Promise.resolve(false);
      if (flight) return flight;
      const sent = pending, token = epoch, base = revision;
      state('saving');
      const operation = (async () => {
        try {
          const reply = await options.request('POST', { generation, revision: base, session: sent.session }, urgentDelivery);
          if (token !== epoch) return false;
          if (reply.reset) { options.reset?.(reply.generation); return false; }
          if (reply.conflict) {
            if (fingerprint(clean(reply.session)) === sent.signature) {
              revision = reply.revision; baseline = sent.signature;
              if (pending === sent || pending?.signature === baseline) pending = null;
              persist(); state(pending ? 'saving' : read(backupKey) ? 'conflict' : 'saved'); return true;
            }
            rememberConflict(pending?.session || sent.session);
            pending = null; persist();
            if (!apply(reply)) deferred = reply;
            state('conflict'); return false;
          }
          if (!Number.isSafeInteger(reply.revision) || reply.revision <= base) throw Error('checkpoint not confirmed');
          revision = reply.revision; baseline = fingerprint(clean(reply.session));
          if (pending === sent || pending?.signature === baseline) pending = null;
          persist(); state(pending ? 'saving' : read(backupKey) ? 'conflict' : 'saved'); return true;
        } catch (_) { if (token === epoch) { persist(); state('offline'); } return false; }
        finally {
          if (token === epoch) {
            flight = null;
            if (pending && pending !== sent && status !== 'offline' && status !== 'conflict') flush(urgentDelivery);
            else if (!pending) { urgentDelivery = false; state(read(backupKey) ? 'conflict' : 'saved'); }
          }
        }
      })();
      flight = operation; return operation;
    }
    async function poll() {
      if (polling || options.hidden?.()) return polling;
      if (!ready) return start();
      if (deferred && !options.busy?.()) { const next = deferred; deferred = null; apply(next); }
      if (pending || flight) return flush();
      const token = epoch;
      polling = (async () => {
        try {
          const snapshot = await options.request('GET');
          if (token !== epoch || pending || flight) return;
          if (snapshot.generation !== generation) return options.reset?.(snapshot.generation);
          if (snapshot.revision > revision) apply(snapshot);
          else if (status === 'offline') state('saved');
        } catch (_) { if (token === epoch) state('offline'); }
        finally { polling = null; }
      })();
      return polling;
    }
    function reset(value) {
      if (generation === value) return;
      epoch++; generation = value; revision = 0; ready = false; pending = null; flight = null;
      deferred = null; baseline = ''; urgentDelivery = false; put(outboxKey, null); put(backupKey, null); state('loading');
    }
    function recover() {
      const saved = read(backupKey);
      if (!saved || saved.generation !== generation || options.busy?.()) return false;
      put(backupKey, null); applying = true;
      try { options.apply(saved.session); } finally { applying = false; }
      changed(saved.session); flush(); return true;
    }
    async function settled() {
      for (let count = 0; count < 20 && (pending || flight); count++) {
        await flush();
        if (status === 'offline' || status === 'conflict' && pending) return false;
      }
      return !pending && !flight && ready;
    }
    return { start, changed, flush, settled, poll, reset, recover, get status() { return status; }, get revision() { return revision; }, get isCurrent() { return ready && !pending && !flight && !deferred; } };
  }
  root.FukushuStudySync = { create, clean };
})(typeof window !== 'undefined' ? window : globalThis);
