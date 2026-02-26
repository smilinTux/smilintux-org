/**
 * CapAuth Admin Settings — JS for the Nextcloud admin panel.
 */
(function () {
    'use strict';

    const appBase = OC.generateUrl('/apps/capauth');

    // Save settings form
    document.getElementById('capauth-settings-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const form = e.target;
        const serviceUrl = form.querySelector('[name=service_url]').value.trim();
        const requireApproval = form.querySelector('[name=require_approval]').checked;

        try {
            const resp = await fetch(appBase + '/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service_url: serviceUrl, require_approval: requireApproval }),
            });
            if (resp.ok) {
                OC.msg.finishedSaved('#capauth-status-msg');
            } else {
                OC.msg.finishedError('#capauth-status-msg', await resp.text());
            }
        } catch (e) {
            OC.msg.finishedError('#capauth-status-msg', e.message);
        }
    });

    // Test connection button
    document.getElementById('btn-test-connection').addEventListener('click', async function () {
        const serviceUrl = document.getElementById('capauth-service-url').value.trim();
        const statusEl = document.getElementById('capauth-status-msg');
        statusEl.textContent = 'Testing...';

        try {
            // Fetch OIDC discovery doc to verify service is running
            const resp = await fetch(serviceUrl + '/.well-known/openid-configuration', {
                signal: AbortSignal.timeout(5000),
            });
            if (resp.ok) {
                const data = await resp.json();
                statusEl.textContent = '✓ Connected: ' + (data.issuer || serviceUrl);
                statusEl.className = 'msg success';
            } else {
                statusEl.textContent = '✗ Service returned HTTP ' + resp.status;
                statusEl.className = 'msg error';
            }
        } catch (e) {
            statusEl.textContent = '✗ Connection failed: ' + e.message;
            statusEl.className = 'msg error';
        }
    });
})();
