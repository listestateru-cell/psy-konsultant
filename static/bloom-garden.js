/* Reveal earned growth once in view. No timers, model calls, or progress writes. */
(() => {
  'use strict';
  if (window.PSUHBloom) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prepared = new WeakSet();
  const seen = new Map();
  let frame = 0;
  function reveal(svg) {
    if (!svg.isConnected || reduced.matches) return;
    const key = svg.dataset.bloomKey || `${svg.dataset.species}:${svg.dataset.seed}`;
    const growth = Number(svg.dataset.growth);
    const previous = seen.get(key);
    if (Number.isFinite(growth)) seen.set(key, growth);
    if (seen.size > 32) seen.delete(seen.keys().next().value);
    if (previous == null) svg.classList.add('bloom-reveal');
    else if (growth > previous) svg.classList.add('bloom-grew');
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      reveal(entry.target);
    }
  }, {threshold: .2}) : null;
  function refresh() {
    document.querySelectorAll('.scene > svg.bloom-tree[data-scene="true"]').forEach(svg => {
      if (prepared.has(svg)) return;
      prepared.add(svg);
      if (observer) observer.observe(svg); else reveal(svg);
    });
  }
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {frame = 0; refresh();});
  }
  // Listen only to inserted scenes; CSS animation does not mutate the document.
  const mutations = new MutationObserver(records => {
    for (const record of records) for (const node of record.removedNodes) {
      if (node.nodeType !== 1) continue;
      const detached = node.matches?.('.bloom-tree') ? [node] : node.querySelectorAll?.('.bloom-tree') || [];
      for (const svg of detached) if (!svg.isConnected) {
        observer?.unobserve(svg);
        prepared.delete(svg);
        svg.classList.remove('bloom-reveal', 'bloom-grew');
      }
    }
    if (records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1 &&
      (node.matches?.('.bloom-tree,.scene') || node.querySelector?.('.bloom-tree'))))) schedule();
  });
  for (const id of ['hometree', 'v-home', 'v-dojo']) {
    const container = document.getElementById(id);
    if (container) mutations.observe(container, {childList:true, subtree:true});
  }
  const quiet = () => {
    if (reduced.matches) document.querySelectorAll('.bloom-reveal,.bloom-grew').forEach(svg => {
      svg.classList.remove('bloom-reveal', 'bloom-grew');
    });
  };
  reduced.addEventListener?.('change', quiet);
  window.PSUHBloom = {refresh};
  refresh();
})();
