/**
 * Journal view — recent journal entries.
 */

async function JournalView(container) {
  try {
    const data = await SKApi.get('/api/v1/profile/journal?count=10');

    container.innerHTML = `
      <div class="card">
        <h2>Journal</h2>
        <p class="text-muted">${data.total_entries || 0} total entries</p>
      </div>
      <div class="card">
        <div class="journal-content">${escapeHtml(data.entries_markdown || 'No entries')}</div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="text-error">Failed to load journal: ${err.message}</p></div>`;
  }
}
