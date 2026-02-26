<?php
/**
 * CapAuth Nextcloud App — Route definitions.
 *
 * Maps URL paths to controller actions for the CapAuth login flow.
 */

return [
    'routes' => [
        // Login page with "Login with CapAuth" button
        ['name' => 'login#showLogin', 'url' => '/login', 'verb' => 'GET'],

        // Proxied challenge endpoint (browser calls this, we relay to capauth-service)
        ['name' => 'login#challenge', 'url' => '/api/v1/challenge', 'verb' => 'POST'],

        // Proxied verify endpoint
        ['name' => 'login#verify', 'url' => '/api/v1/verify', 'verb' => 'POST'],

        // Admin settings
        ['name' => 'settings#getSettings', 'url' => '/settings', 'verb' => 'GET'],
        ['name' => 'settings#saveSettings', 'url' => '/settings', 'verb' => 'POST'],
    ],
];
