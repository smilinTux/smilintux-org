# Nextcloud CapAuth App — Installation & Admin Guide

## Overview

The Nextcloud CapAuth app integrates the CapAuth Verification Service into Nextcloud.
It provides a **passwordless, PGP-based login page** that replaces (or supplements) the
standard username/password login.

**Zero PII stored server-side.** The Nextcloud server stores only the user's PGP fingerprint.
Name, email, and group claims are supplied by the client at login time and not persisted.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Nextcloud | 28–31 |
| PHP | 8.1+ |
| CapAuth Verification Service | 1.0+ (Python/FastAPI) |

---

## 1. Start the CapAuth Verification Service

On the same host (or a reachable host), start the Python service:

```bash
# Install
pip install -e "capauth/.[service]"

# Run on default port 8420
capauth-service --port 8420

# Or with a persistent JWT secret
CAPAUTH_JWT_SECRET=my-long-random-secret capauth-service --port 8420
```

Verify it is running:

```bash
curl http://localhost:8420/capauth/v1/status
# → {"healthy": true, "enrolled_keys": 0, "service_id": "...", "version": "1.0.0"}
```

---

## 2. Copy the App into Nextcloud

```bash
# From your Nextcloud root:
cp -r /path/to/nextcloud-capauth   /var/www/nextcloud/apps/capauth
chown -R www-data:www-data /var/www/nextcloud/apps/capauth
```

---

## 3. Enable the App

```bash
# CLI (recommended)
sudo -u www-data php /var/www/nextcloud/occ app:enable capauth

# Or: Admin UI → Apps → Security → "CapAuth Passwordless Login" → Enable
```

---

## 4. Admin Configuration

Navigate to: **Settings → Administration → Security → CapAuth Settings**

| Setting | Default | Description |
|---|---|---|
| CapAuth Service URL | `http://localhost:8420` | Full URL to your `capauth-service` |
| Require admin approval | Off | If enabled, new PGP keys must be manually approved |

Click **Test Connection** to verify the service is reachable, then **Save**.

Alternatively, configure via `occ`:

```bash
sudo -u www-data php occ config:app:set capauth service_url \
    --value="http://localhost:8420"

sudo -u www-data php occ config:app:set capauth require_approval \
    --value="false"
```

---

## 5. Verify the Login Page Renders

Open in your browser:

```
https://your-nextcloud.example.com/apps/capauth/login
```

You should see a three-step form:
1. **Enter PGP fingerprint** (40 hex characters)
2. **Sign the nonce** (copy/paste the nonce into GPG, paste the detached signature back)
3. **Authenticated** → redirect to Nextcloud home

---

## 6. First Login (Key Enrollment)

On first login, the user's public key is auto-enrolled if they include it in the verify request.

### Manual flow (CLI):

```bash
# On the user's machine, with capauth CLI installed:
capauth login https://your-nextcloud.example.com/apps/capauth \
    --with-claims

# Or without claims (anonymous fingerprint-only):
capauth login https://your-nextcloud.example.com/apps/capauth
```

### Browser flow:

1. Navigate to `/apps/capauth/login`
2. Enter your 40-character PGP fingerprint
3. A nonce will appear — copy it
4. Sign it: `echo -n "<nonce>" | gpg --detach-sign --armor`
5. Paste the armored signature into the signature box
6. Click **Verify** — you'll be logged in

---

## 7. Nextcloud User Provisioning

On first successful authentication, a Nextcloud user is automatically created with:

| Field | Value |
|---|---|
| Username | `capauth-<first 16 chars of fingerprint>` |
| Display Name | From OIDC `name` claim (or `CapAuth <fp[0:8]>`) |
| Email | From OIDC `email` claim |
| Password | Random (never usable; login is PGP-only) |

Display name and email are updated on each login from the client's `profile.yml` claims.

---

## 8. Challenge/Verify Proxy — How It Works

```
Browser/CLI                Nextcloud               CapAuth Service
    |                          |                         |
    |-- POST /api/v1/challenge→|                         |
    |                          |-- POST /capauth/v1/challenge→|
    |                          |← {nonce, ...} ----------|
    |← {nonce, ...} -----------|                         |
    |                          |                         |
    |  (user signs nonce)      |                         |
    |                          |                         |
    |-- POST /api/v1/verify --→|                         |
    |                          |-- POST /capauth/v1/verify→|
    |                          |← {authenticated, ...} --|
    |                          |                         |
    |                          | create/find NC user     |
    |                          | set session             |
    |← {redirect: "/"} --------| ← done                  |
```

---

## 9. Testing the Proxy

Run the automated test suite:

```bash
cd capauth
source .venv/bin/activate
python -m pytest tests/test_nextcloud_app.py -v

# With live service running on :8420:
CAPAUTH_SERVICE_URL=http://localhost:8420 python -m pytest tests/test_nextcloud_app.py -v
```

The test suite verifies:
- All required PHP/JS/template/config files exist
- Controller logic (fingerprint validation, user auto-provisioning, session, claims mapping)
- PHP service proxy (correct endpoint URLs, error handling, capauth_version field)
- Admin settings (ISettings implementation, URL validation)
- JS login flow (nonce generation, challenge/verify calls, extension hookpoint, redirect)
- Live proxy behavior (challenge issues nonce, bad signatures are rejected)

---

## 10. Troubleshooting

### Login page returns 404
```
# Confirm the app is enabled:
sudo -u www-data php occ app:list | grep capauth
```

### "CapAuth service unavailable" error
```
# Check service is running:
curl http://localhost:8420/capauth/v1/status

# Check Nextcloud can reach it (same host or firewall allows it):
sudo -u www-data curl http://localhost:8420/capauth/v1/status
```

### "Could not create Nextcloud user" error
Check Nextcloud logs:
```bash
sudo -u www-data php occ log:tail
```

### Session not persisting after login
Ensure Nextcloud's session middleware is active and that the `@NoCSRFRequired`
annotations are present on the challenge/verify endpoints.

---

## 11. Security Notes

- The CapAuth service **stores only PGP public key fingerprints** — no passwords, no PII.
- All PII (name, email, groups) is **client-asserted** and signed with the user's PGP key.
- The nonce is **single-use with a 60-second TTL**, preventing replay attacks.
- Access tokens are **HS256 JWTs** with a 1-hour expiry.
- The random password set on user creation is **never exposed or usable for login**.
