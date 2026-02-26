<?php
/**
 * CapAuth Login Page — rendered as a Nextcloud guest page.
 *
 * This page presents the "Login with CapAuth" interface.
 * The actual PGP signing happens client-side via:
 *   1. Browser extension (auto-detected)
 *   2. QR code scan (mobile)
 *   3. Manual paste (CLI users)
 */
style('capauth', 'login');
script('capauth', 'login');
?>

<div id="capauth-login" class="capauth-container">
    <div class="capauth-card">
        <div class="capauth-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2"/>
                <path d="M24 12 L24 36 M16 24 L32 24 M18 16 L30 32 M30 16 L18 32"
                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
                <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.3"/>
            </svg>
        </div>

        <h2>Login with CapAuth</h2>
        <p class="capauth-subtitle">Passwordless PGP authentication</p>

        <!-- Step 1: Enter fingerprint -->
        <div id="step-fingerprint" class="capauth-step">
            <label for="fingerprint">PGP Fingerprint</label>
            <input type="text" id="fingerprint" name="fingerprint"
                   placeholder="Enter your 40-character PGP fingerprint"
                   maxlength="40" autocomplete="off"/>
            <button id="btn-challenge" class="primary">
                Request Challenge
            </button>
        </div>

        <!-- Step 2: Sign the nonce -->
        <div id="step-sign" class="capauth-step" style="display:none">
            <p>Sign this challenge nonce with your PGP key:</p>
            <div id="nonce-display" class="capauth-nonce"></div>
            <label for="nonce-signature">Paste your PGP signature</label>
            <textarea id="nonce-signature" rows="6"
                      placeholder="-----BEGIN PGP SIGNATURE-----"></textarea>
            <button id="btn-verify" class="primary">
                Verify & Login
            </button>
        </div>

        <!-- Step 3: Success -->
        <div id="step-success" class="capauth-step" style="display:none">
            <p class="capauth-success">Authenticated! Redirecting...</p>
        </div>

        <!-- Error display -->
        <div id="capauth-error" class="capauth-error" style="display:none"></div>

        <p class="capauth-footer">
            No account? Your PGP key <em>is</em> your account.<br/>
            <a href="https://capauth.io" target="_blank">Learn about CapAuth</a>
        </p>
    </div>
</div>
