/**
 * Storage view — disk usage and housekeeping trigger.
 */

async function StorageView(container) {
  try {
    const data = await SKApi.get('/api/v1/profile/storage');
    const bloat = data.bloat || {};

    const dirRows = ['skcapstone', 'skmemory', 'skcomm', 'capauth']
      .map((name) => {
        const d = data[name];
        if (!d) return '';
        if (d.exists === false) {
          return `<div class="kv"><span class="kv-key">${name}</span><span class="kv-val text-muted">not found</span></div>`;
        }
        return `<div class="kv"><span class="kv-key">${name}</span><span class="kv-val">${d.size_mb || 0} MB</span></div>`;
      })
      .join('');

    const bloatRows = Object.entries(bloat)
      .map(([name, info]) => {
        const count = info.file_count ? ` (${info.file_count} files)` : '';
        return `<div class="kv"><span class="kv-key">${name}</span><span class="kv-val text-warning">${info.size_mb} MB${count}</span></div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="card">
        <h2>Storage</h2>
        <div class="kv"><span class="kv-key">Total</span><span class="kv-val" style="font-size:1.2rem">${data.total_mb || 0} MB</span></div>
        ${dirRows}
      </div>

      ${bloatRows ? `
        <div class="card">
          <h3>Prunable Bloat</h3>
          ${bloatRows}
          <div style="margin-top:1rem;display:flex;gap:0.5rem">
            <button id="hk-dry" class="btn btn-sm">Dry Run</button>
            <button id="hk-run" class="btn btn-primary btn-sm">Prune Now</button>
          </div>
          <div id="hk-result" style="margin-top:0.75rem"></div>
        </div>
      ` : ''}
    `;

    // Housekeeping buttons
    const dryBtn = document.getElementById('hk-dry');
    const runBtn = document.getElementById('hk-run');
    const resultDiv = document.getElementById('hk-result');

    if (dryBtn) {
      dryBtn.addEventListener('click', async () => {
        resultDiv.innerHTML = '<div class="loading">Scanning</div>';
        try {
          const r = await SKApi.post('/api/v1/profile/housekeeping?dry_run=true');
          const counts = ['acks', 'comms_outbox', 'seed_outbox']
            .map((k) => `${k}: ${r[k]?.would_delete || 0}`)
            .join(', ');
          resultDiv.innerHTML = `<p class="text-muted">Would delete: ${counts}</p>`;
        } catch (err) {
          resultDiv.innerHTML = `<p class="text-error">${err.message}</p>`;
        }
      });
    }

    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        resultDiv.innerHTML = '<div class="loading">Pruning</div>';
        try {
          const r = await SKApi.post('/api/v1/profile/housekeeping');
          const summary = r.summary || {};
          resultDiv.innerHTML = `<p class="text-success">Deleted ${summary.total_deleted || 0} files, freed ${summary.total_freed_mb || 0} MB</p>`;
          // Refresh storage view
          setTimeout(() => StorageView(container), 1500);
        } catch (err) {
          resultDiv.innerHTML = `<p class="text-error">${err.message}</p>`;
        }
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="text-error">Failed to load storage: ${err.message}</p></div>`;
  }
}
