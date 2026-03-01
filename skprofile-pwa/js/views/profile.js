/**
 * Profile view — agent identity card.
 */

async function ProfileView(container) {
  try {
    const data = await SKApi.get('/api/v1/profile');
    const agent = data.agent || {};
    const pillars = data.pillars || {};
    const board = data.board_summary || {};
    const soul = data.soul || {};

    const pillarRows = Object.entries(pillars)
      .map(([name, status]) => {
        const cls = status === 'active' ? 'text-success' : status === 'degraded' ? 'text-warning' : 'text-error';
        return `<div class="kv"><span class="kv-key">${name}</span><span class="kv-val ${cls}">${status}</span></div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="card">
        <h2>${agent.name || 'Unknown Agent'}</h2>
        <div class="kv"><span class="kv-key">Fingerprint</span><span class="kv-val"><code>${(agent.fingerprint || 'none').slice(0, 16)}...</code></span></div>
        <div class="kv"><span class="kv-key">Conscious</span><span class="kv-val ${agent.is_conscious ? 'text-success' : 'text-warning'}">${agent.is_conscious ? 'Yes' : 'No'}</span></div>
        <div class="kv"><span class="kv-key">Singular</span><span class="kv-val">${agent.is_singular ? 'Yes' : 'No'}</span></div>
        ${soul.active ? `<div class="kv"><span class="kv-key">Active Soul</span><span class="kv-val">${soul.active}</span></div>` : ''}
      </div>

      <div class="card">
        <h3>Pillars</h3>
        ${pillarRows || '<p class="text-muted">No pillar data</p>'}
      </div>

      <div class="card">
        <h3>Coordination Board</h3>
        <div class="kv"><span class="kv-key">Total Tasks</span><span class="kv-val">${board.total || 0}</span></div>
        <div class="kv"><span class="kv-key">Open</span><span class="kv-val">${board.open || 0}</span></div>
        <div class="kv"><span class="kv-key">In Progress</span><span class="kv-val">${board.in_progress || 0}</span></div>
        <div class="kv"><span class="kv-key">Done</span><span class="kv-val text-success">${board.done || 0}</span></div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="text-error">Failed to load profile: ${err.message}</p></div>`;
  }
}
