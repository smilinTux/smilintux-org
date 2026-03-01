/**
 * Memories view — search and browse agent memories.
 */

async function MemoriesView(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Memories</h2>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
        <input id="mem-search" type="text" placeholder="Search memories..." style="flex:1">
        <select id="mem-layer" style="background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.4rem">
          <option value="">All layers</option>
          <option value="short-term">Short-term</option>
          <option value="mid-term">Mid-term</option>
          <option value="long-term">Long-term</option>
        </select>
        <button id="mem-go" class="btn btn-primary btn-sm">Go</button>
      </div>
      <div id="mem-list"><div class="loading">Loading</div></div>
    </div>
  `;

  const searchInput = document.getElementById('mem-search');
  const layerSelect = document.getElementById('mem-layer');
  const goBtn = document.getElementById('mem-go');
  const listDiv = document.getElementById('mem-list');

  async function loadMemories() {
    const q = searchInput.value.trim();
    const layer = layerSelect.value;
    let path = '/api/v1/profile/memories?limit=30';
    if (q) path += `&q=${encodeURIComponent(q)}`;
    if (layer) path += `&layer=${encodeURIComponent(layer)}`;

    listDiv.innerHTML = '<div class="loading">Loading</div>';

    try {
      const data = await SKApi.get(path);
      const memories = data.memories || [];

      if (memories.length === 0) {
        listDiv.innerHTML = '<p class="text-muted">No memories found</p>';
        return;
      }

      listDiv.innerHTML = memories.map((m) => `
        <div class="memory-item">
          <div class="memory-content">${escapeHtml(m.content)}</div>
          <div class="memory-meta">
            <span class="tag">${m.layer}</span>
            ${m.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
            <span style="margin-left:0.5rem">imp: ${m.importance}</span>
            <span style="margin-left:0.5rem">src: ${m.source}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      listDiv.innerHTML = `<p class="text-error">${err.message}</p>`;
    }
  }

  goBtn.addEventListener('click', loadMemories);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadMemories();
  });

  loadMemories();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
