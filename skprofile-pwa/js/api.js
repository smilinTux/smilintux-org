/**
 * SKProfile API client — fetch wrapper with CapAuth headers.
 */

const SKApi = (() => {
  const TOKEN_KEY = 'skprofile_token';
  const URL_KEY = 'skprofile_api_url';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function getBaseUrl() {
    return localStorage.getItem(URL_KEY) || '';
  }

  function setBaseUrl(url) {
    if (url) {
      localStorage.setItem(URL_KEY, url.replace(/\/+$/, ''));
    } else {
      localStorage.removeItem(URL_KEY);
    }
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(URL_KEY);
  }

  function isAuthenticated() {
    return !!getToken();
  }

  async function request(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');

    const base = getBaseUrl();
    const url = `${base}${path}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const resp = await fetch(url, { ...options, headers });

    if (resp.status === 401) {
      clearAuth();
      location.reload();
      throw new Error('Authentication expired');
    }

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`${resp.status}: ${body}`);
    }

    if (resp.status === 204) return null;
    return resp.json();
  }

  function get(path) {
    return request(path);
  }

  function post(path, body) {
    return request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  return {
    getToken, setToken, getBaseUrl, setBaseUrl,
    clearAuth, isAuthenticated, get, post,
  };
})();
