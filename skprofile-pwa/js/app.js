/**
 * SKProfile SPA router and auth manager.
 */

(() => {
  const routes = {
    '/': ProfileView,
    '/memories': MemoriesView,
    '/trust': TrustView,
    '/journal': JournalView,
    '/storage': StorageView,
  };

  const content = document.getElementById('content');
  const loginScreen = document.getElementById('login-screen');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginError = document.getElementById('login-error');
  const tokenInput = document.getElementById('token-input');
  const apiUrlInput = document.getElementById('api-url-input');

  function showLogin() {
    loginScreen.style.display = '';
    content.style.display = 'none';
    logoutBtn.style.display = 'none';
    apiUrlInput.value = SKApi.getBaseUrl();
  }

  function showApp() {
    loginScreen.style.display = 'none';
    content.style.display = '';
    logoutBtn.style.display = '';
    navigate();
  }

  loginBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) return;

    SKApi.setToken(token);
    SKApi.setBaseUrl(apiUrlInput.value.trim());

    try {
      await SKApi.get('/api/v1/profile');
      loginError.style.display = 'none';
      showApp();
    } catch (err) {
      loginError.textContent = `Auth failed: ${err.message}`;
      loginError.style.display = '';
      SKApi.clearAuth();
    }
  });

  logoutBtn.addEventListener('click', () => {
    SKApi.clearAuth();
    showLogin();
  });

  function navigate() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const viewFn = routes[hash] || routes['/'];

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.route === hash);
    });

    content.innerHTML = '<div class="loading">Loading</div>';
    viewFn(content);
  }

  window.addEventListener('hashchange', navigate);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Boot
  if (SKApi.isAuthenticated()) {
    showApp();
  } else {
    showLogin();
  }
})();
