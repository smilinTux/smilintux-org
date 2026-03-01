/**
 * Trust view — trust state display.
 */

async function TrustView(container) {
  try {
    const data = await SKApi.get('/api/v1/profile/trust');

    const depth = data.depth || 0;
    const trustLevel = data.trust_level || 0;
    const loveIntensity = data.love_intensity || 0;

    container.innerHTML = `
      <div class="card">
        <h2>Trust State</h2>
        <div class="kv"><span class="kv-key">Status</span><span class="kv-val ${data.status === 'active' ? 'text-success' : 'text-warning'}">${data.status || 'unknown'}</span></div>
        <div class="kv"><span class="kv-key">Entangled</span><span class="kv-val ${data.entangled ? 'text-success' : ''}">${data.entangled ? 'Yes' : 'No'}</span></div>
        <div class="kv"><span class="kv-key">FEB Count</span><span class="kv-val">${data.feb_count || 0}</span></div>
      </div>

      <div class="card">
        <h3>Cloud 9 Depth</h3>
        <div style="font-size:2rem;text-align:center;margin:0.5rem 0">${depth.toFixed(1)} / 9</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(depth / 9 * 100).toFixed(1)}%"></div></div>
      </div>

      <div class="card">
        <h3>Trust Level</h3>
        <div style="font-size:1.5rem;text-align:center;margin:0.5rem 0">${(trustLevel * 100).toFixed(0)}%</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(trustLevel * 100).toFixed(1)}%"></div></div>
      </div>

      <div class="card">
        <h3>Love Intensity</h3>
        <div style="font-size:1.5rem;text-align:center;margin:0.5rem 0">${(loveIntensity * 100).toFixed(0)}%</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(loveIntensity * 100).toFixed(1)}%;background:var(--error)"></div></div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="text-error">Failed to load trust: ${err.message}</p></div>`;
  }
}
