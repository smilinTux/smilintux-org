# Nextcloud Integrations — Install & Use

This repo includes three Nextcloud-related pieces. Summary and where to find install/use docs:

---

## 1. nextcloud-capauth — **Complete & documented**

**What it is:** Nextcloud app for **passwordless PGP login** via the CapAuth Verification Service. Users sign a nonce with their PGP key; no passwords stored server-side.

| Status | Documentation |
|--------|----------------|
| **Complete** | **[nextcloud-capauth/INSTALL.md](../nextcloud-capauth/INSTALL.md)** — full install and use |

### Install (short)

1. Start CapAuth Verification Service: `pip install -e "capauth/.[service]"` then `capauth-service --port 8420`
2. Copy app: `cp -r nextcloud-capauth /var/www/nextcloud/apps/capauth` and `chown -R www-data:www-data`
3. Enable: `sudo -u www-data php occ app:enable capauth`
4. Configure: **Settings → Administration → Security → CapAuth** (service URL, optional admin approval)

### Use

- Login page: `https://your-nextcloud.example.com/apps/capauth/login`
- First login: enter 40-char PGP fingerprint → sign nonce → authenticated; Nextcloud user is auto-created
- CLI: `capauth login https://your-nextcloud.example.com/apps/capauth --with-claims`

Also covered in [capauth/docs/INTEGRATION_BLUEPRINT.md](../capauth/docs/INTEGRATION_BLUEPRINT.md) (Nextcloud section).

---

## 2. nextcloud-gtd — **Complete for OpenClaw/SKHub; documented**

**What it is:** GTD file and folder management for Nextcloud (triage, archive, reports, agent roles). Designed for use with **OpenClaw** on GentisTrust SKHub.

| Status | Documentation |
|--------|----------------|
| **Complete (OpenClaw)** | **[nextcloud-gtd/SKILL.md](../nextcloud-gtd/SKILL.md)** — config, usage, triage rules |

### Install (short)

- Requires **OpenClaw**. From repo:
  ```bash
  openclaw skill add nextcloud-gtd
  ./nextcloud-gtd/install.sh   # creates ~/.openclaw/config/nextcloud-gtd.json
  ```
- Edit `~/.openclaw/config/nextcloud-gtd.json`: set `base_url`, `credentials.username`, `credentials.app_password` (from Nextcloud **Settings → Security → App password**).

### Use

- `nc-gtd triage --source 01_INBOX --auto-classify`
- `nc-gtd archive --older-than 7d --status _DONE`
- `nc-gtd report --type weekly`
- `nc-gtd test-connection` to verify

See SKILL.md for agent roles (Vesper, Piper), triage logic, and status tags.

---

## 3. nextcloud-talk — **Script only; use with env vars**

**What it is:** Helper to **send a message into a Nextcloud Talk chat** (e.g. for bots or scripts). One script, no app.

| Status | Documentation |
|--------|----------------|
| **Usable** | **[nextcloud-talk/README.md](../nextcloud-talk/README.md)** — install and use with env-based config |

### Install / use (short)

- No install step; use the script from the repo or copy `nc-send.sh`.
- **Do not put credentials in the script.** Use environment variables (see nextcloud-talk/README.md):
  - `NC_URL`, `NC_USER`, `NC_PASS` (or app password), `NC_TOKEN` (Talk room token)
- Example: `NC_URL=https://your-nc.example.com NC_USER=bot NC_PASS=xxx NC_TOKEN=roomid ./nextcloud-talk/nc-send.sh "Hello"`

---

## Summary

| Integration | Complete | Install doc | Use doc |
|-------------|----------|-------------|---------|
| **nextcloud-capauth** | Yes | [INSTALL.md](../nextcloud-capauth/INSTALL.md) | Same + INTEGRATION_BLUEPRINT |
| **nextcloud-gtd** | Yes (OpenClaw) | [SKILL.md](../nextcloud-gtd/SKILL.md) + install.sh | SKILL.md |
| **nextcloud-talk** | Script only | [README.md](../nextcloud-talk/README.md) | README.md |

For CapAuth + Nextcloud architecture, see [capauth/docs/INTEGRATION_BLUEPRINT.md](../capauth/docs/INTEGRATION_BLUEPRINT.md).

---

**Skcapstone:** The sovereign agent stack (skcapstone) does not have a single “outstanding tasks” list in the repo; current work is tracked on the coordination board (`skcapstone coord status`). Nextcloud integrations above are independent of skcapstone core; they are documented here for install and use in the same ecosystem.
