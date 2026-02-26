/**
 * CapAuth Nextcloud Login — client-side flow.
 *
 * Handles the challenge-response flow entirely in the browser:
 *   1. User enters fingerprint → request challenge nonce
 *   2. User signs nonce with PGP key (extension or manual paste)
 *   3. Submit signed response → server verifies and logs in
 */
(function () {
    'use strict';

    const appBase = OC.generateUrl('/apps/capauth');

    function showError(msg) {
        const el = document.getElementById('capauth-error');
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 8000);
    }

    function showStep(stepId) {
        document.querySelectorAll('.capauth-step').forEach(el => {
            el.style.display = 'none';
        });
        document.getElementById(stepId).style.display = 'block';
    }

    // Step 1: Request challenge
    document.getElementById('btn-challenge').addEventListener('click', async function () {
        const fingerprint = document.getElementById('fingerprint').value.trim();
        if (fingerprint.length !== 40) {
            showError('Fingerprint must be exactly 40 characters.');
            return;
        }

        // Generate a random client nonce
        const nonceBytes = new Uint8Array(16);
        crypto.getRandomValues(nonceBytes);
        const clientNonce = btoa(String.fromCharCode(...nonceBytes));

        try {
            const resp = await fetch(appBase + '/api/v1/challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fingerprint: fingerprint,
                    client_nonce: clientNonce,
                }),
            });

            const data = await resp.json();
            if (!resp.ok) {
                showError(data.error_description || data.error || 'Challenge failed');
                return;
            }

            // Store challenge data for verify step
            window._capauth = {
                fingerprint: fingerprint,
                nonce: data.nonce,
                challenge: data,
                clientNonce: clientNonce,
            };

            // Display nonce for signing
            document.getElementById('nonce-display').textContent = data.nonce;

            // Check for browser extension
            if (window.capAuthExtension) {
                // Auto-sign via extension
                try {
                    const sig = await window.capAuthExtension.signChallenge(data);
                    document.getElementById('nonce-signature').value = sig;
                    document.getElementById('btn-verify').click();
                    return;
                } catch (e) {
                    // Fall through to manual signing
                }
            }

            showStep('step-sign');
        } catch (e) {
            showError('Network error: ' + e.message);
        }
    });

    // Step 2: Verify signed response
    document.getElementById('btn-verify').addEventListener('click', async function () {
        const signature = document.getElementById('nonce-signature').value.trim();
        if (!signature) {
            showError('Please paste your PGP signature.');
            return;
        }

        const ca = window._capauth;
        if (!ca) {
            showError('No challenge in progress. Start over.');
            showStep('step-fingerprint');
            return;
        }

        try {
            const resp = await fetch(appBase + '/api/v1/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    capauth_version: '1.0',
                    fingerprint: ca.fingerprint,
                    nonce: ca.nonce,
                    nonce_signature: signature,
                    claims: {},
                    claims_signature: '',
                    public_key: '',
                }),
            });

            const data = await resp.json();
            if (!resp.ok) {
                showError(data.error_description || data.error || 'Verification failed');
                return;
            }

            showStep('step-success');

            // Redirect to Nextcloud home
            setTimeout(() => {
                window.location.href = data.redirect || '/';
            }, 1000);
        } catch (e) {
            showError('Network error: ' + e.message);
        }
    });

    // Allow Enter key on fingerprint input
    document.getElementById('fingerprint').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            document.getElementById('btn-challenge').click();
        }
    });
})();
