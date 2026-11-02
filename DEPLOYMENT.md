# Deploying Career Code to a VPS

A step-by-step guide for a fresh **Ubuntu 24.04** server (22.04 works the same).
Everything runs on one machine:

```
Internet ──HTTPS──▶ Nginx (80/443) ──▶ Node app (127.0.0.1:3000) ──▶ PostgreSQL (local)
                                          └── uploads on disk (/var/lib/careercode/uploads)
```

Replace these placeholders throughout:

| Placeholder | Example |
|---|---|
| `YOUR_SERVER_IP` | `203.0.113.10` |
| `careercode.example.com` | your domain |
| `you@example.com` | your email (for SSL notices) |
| `STRONG_DB_PASSWORD` | output of `openssl rand -hex 24` |
| `YOUR_REPO_URL` | `https://github.com/<owner>/Career-Code-by-Prep.git` |

**Minimum server:** 1 vCPU, 2 GB RAM, 25 GB disk. Uploads (attachments, voice
notes, images) grow over time, so leave room.

---

## 1. Point your domain at the server

In your domain's DNS settings, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `careercode` (or `@` for the root domain) | `YOUR_SERVER_IP` |

DNS can take a few minutes to an hour. Check it from your own computer:

```bash
ping careercode.example.com
```

It should answer from `YOUR_SERVER_IP` before you do step 9 (SSL).

---

## 2. First login and basic security

Log in as root:

```bash
ssh root@YOUR_SERVER_IP
```

Update the system and create a normal admin user (don't run everything as root):

```bash
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
```

Copy your SSH key to the new user, then log in as them from a **new terminal**
(keep the root session open until this works):

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

```bash
ssh deploy@YOUR_SERVER_IP
```

Turn on the firewall (SSH, HTTP, HTTPS only):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full' 2>/dev/null || sudo ufw allow 80,443/tcp
sudo ufw enable
sudo ufw status
```

Optional but recommended — automatic security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 3. Install Node.js 22, Git and build tools

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
node -v    # should print v22.x
npm -v
```

---

## 4. Install PostgreSQL and create the database

```bash
sudo apt install -y postgresql
sudo systemctl enable --now postgresql
```

Create a database user and database (use your own strong password):

```bash
sudo -u postgres psql <<'SQL'
CREATE USER careercode WITH PASSWORD 'STRONG_DB_PASSWORD';
CREATE DATABASE careercode OWNER careercode;
SQL
```

Test the login:

```bash
psql "postgres://careercode:STRONG_DB_PASSWORD@localhost:5432/careercode" -c "select 1;"
```

PostgreSQL only listens on `localhost` by default — keep it that way. The app
creates all tables itself on first start.

> If your password contains `@`, `:`, `/`, `#` or `?`, URL-encode it in
> `DATABASE_URL` (for example `@` → `%40`), or generate one with
> `openssl rand -hex 24` which has none of these.

---

## 5. Create the app user and folders

The app runs as its own unprivileged system user:

```bash
sudo useradd --system --create-home --home-dir /opt/careercode --shell /usr/sbin/nologin careercode
sudo mkdir -p /var/lib/careercode/uploads
sudo chown -R careercode:careercode /var/lib/careercode
```

---

## 6. Get the code and build it

```bash
sudo -u careercode -H git clone YOUR_REPO_URL /opt/careercode/app
cd /opt/careercode/app
sudo -u careercode -H git checkout main      # or the branch you deploy, e.g. feat/postgres-migration
sudo -u careercode -H npm ci
sudo -u careercode -H npm run build
```

> **Private repository?** Create a read-only deploy key: run
> `sudo -u careercode -H ssh-keygen -t ed25519` (no passphrase), add
> `/opt/careercode/.ssh/id_ed25519.pub` in GitHub → repo → Settings → Deploy keys,
> then clone with the `git@github.com:…` URL instead.

---

## 7. Configure the environment

Create `/opt/careercode/app/.env`:

```bash
sudo -u careercode -H nano /opt/careercode/app/.env
```

Paste and fill in:

```ini
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://careercode:STRONG_DB_PASSWORD@localhost:5432/careercode

UPLOAD_DIR=/var/lib/careercode/uploads
MAX_UPLOAD_MB=10

# Google Drive tab (Google Cloud Console → enable "Google Drive API" → Credentials → API key).
# Restrict the key to the Drive API. The Drive folder must be shared "Anyone with the link".
GOOGLE_DRIVE_API_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# Coffee treat payment details shown to students
COFFEE_AMOUNT_PKR=250
COFFEE_PAYMENT_METHOD=
COFFEE_ACCOUNT_NUMBER=
COFFEE_ACCOUNT_TITLE=
```

Lock it down (it contains the database password):

```bash
sudo chmod 600 /opt/careercode/app/.env
sudo chown careercode:careercode /opt/careercode/app/.env
```

> `NODE_ENV=production` is required: it serves the built site, marks the login
> cookie `Secure` (so **the site only works over HTTPS** — finish step 9), and makes
> the app refuse to start without `DATABASE_URL`.

---

## 8. Run the app as a service (systemd)

Create `/etc/systemd/system/careercode.service`:

```bash
sudo nano /etc/systemd/system/careercode.service
```

```ini
[Unit]
Description=Career Code web app
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=careercode
Group=careercode
WorkingDirectory=/opt/careercode/app
EnvironmentFile=/opt/careercode/app/.env
ExecStart=/opt/careercode/app/node_modules/.bin/tsx server.ts
Restart=always
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/lib/careercode /opt/careercode

[Install]
WantedBy=multi-user.target
```

Start it and enable it on boot:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now careercode
sudo systemctl status careercode        # should say "active (running)"
curl http://127.0.0.1:3000/api/health   # {"status":"ok"}
```

Database tables are created automatically on this first start.

The app reads `.env` from its folder, so commands run from `/opt/careercode/app` pick it up.

Create your first super admin (prints a temporary password; you'll choose your own
at first sign-in):

```bash
cd /opt/careercode/app
sudo -u careercode -H npm run create-admin -- --email you@example.com --name "Your Name"
```

---

## 9. Nginx reverse proxy and HTTPS

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/careercode
```

```nginx
server {
    listen 80;
    server_name careercode.example.com;

    # Uploads are up to 10 MB each, up to 10 per request.
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSockets (live chat and notifications)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;   # keep idle sockets open
    }
}
```

Add the WebSocket helper (once per server):

```bash
echo 'map $http_upgrade $connection_upgrade { default upgrade; "" close; }' | sudo tee /etc/nginx/conf.d/websocket-upgrade.conf
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/careercode /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Get a free SSL certificate (auto-renews):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d careercode.example.com -m you@example.com --agree-tos --redirect
sudo certbot renew --dry-run
```

Open **https://careercode.example.com**, sign in with the super admin, set your
new password. 🎉

---

## 10. Load data

Pick **one**:

**A. Bring over the existing Firestore data** (recommended for the live platform):

1. Firebase console → Project settings → Service accounts → **Generate new private key**.
2. Copy it to the server (from your computer):
   ```bash
   scp key.json deploy@YOUR_SERVER_IP:/tmp/key.json
   ```
3. On the server:
   ```bash
   sudo chown careercode /tmp/key.json && sudo chmod 600 /tmp/key.json
   cd /opt/careercode/app
   sudo -u careercode -H npm run import-firestore -- --service-account /tmp/key.json --database ai-studio-careerguidebypre-f57db027-f698-4527-9c06-b5d6f9eeabe2 --dry-run
   ```
4. If the dry run's counts look right, run it for real. The import refuses to run
   when the database already has users; because step 8 created your super admin,
   add `--force` (this **wipes** the new database first, then imports):
   ```bash
   sudo -u careercode -H npm run import-firestore -- --service-account /tmp/key.json --database ai-studio-careerguidebypre-f57db027-f698-4527-9c06-b5d6f9eeabe2 --force
   sudo rm /tmp/key.json
   sudo systemctl restart careercode
   ```
5. Existing users sign in with their old passwords. Re-run `create-admin` (step 8)
   if you need an admin login that didn't exist in Firestore. Accounts the import
   reports as "without a password" need a reset from Admin Management.
6. Because the old seed scripts published the admin passwords, reset every admin's
   password from Admin Management (they'll be asked to choose a new one).

**B. Start empty** with the official categories and starter articles:

```bash
cd /opt/careercode/app
sudo -u careercode -H npm run seed
```

---

## 11. Backups

Two things hold all data: the **database** and the **uploads folder**. Back up both.

Create `/usr/local/bin/careercode-backup`:

```bash
sudo nano /usr/local/bin/careercode-backup
```

```bash
#!/bin/bash
set -euo pipefail
DEST=/var/backups/careercode
STAMP=$(date +%F-%H%M)
mkdir -p "$DEST"
sudo -u postgres pg_dump -Fc careercode > "$DEST/db-$STAMP.dump"
tar -czf "$DEST/uploads-$STAMP.tar.gz" -C /var/lib/careercode uploads
# keep 14 days
find "$DEST" -type f -mtime +14 -delete
```

```bash
sudo chmod +x /usr/local/bin/careercode-backup
sudo /usr/local/bin/careercode-backup && ls -lh /var/backups/careercode
echo '30 2 * * * root /usr/local/bin/careercode-backup' | sudo tee /etc/cron.d/careercode-backup
```

Backups on the same server don't survive losing the server — copy
`/var/backups/careercode` elsewhere regularly (another machine, S3/Backblaze via
`rclone`, or your provider's snapshot feature).

**Restore:**

```bash
sudo systemctl stop careercode
sudo -u postgres pg_restore --clean --if-exists -d careercode /var/backups/careercode/db-YYYY-MM-DD-HHMM.dump
sudo tar -xzf /var/backups/careercode/uploads-YYYY-MM-DD-HHMM.tar.gz -C /var/lib/careercode
sudo chown -R careercode:careercode /var/lib/careercode
sudo systemctl start careercode
```

---

## 12. Deploying updates

```bash
cd /opt/careercode/app
sudo /usr/local/bin/careercode-backup          # safety first
sudo -u careercode -H git pull
sudo -u careercode -H npm ci
sudo -u careercode -H npm run build
sudo systemctl restart careercode
sudo systemctl status careercode
```

Database migrations run automatically when the app starts. (Developers: after
changing `server/db/schema.ts`, run `npm run db:generate` and commit the new file
in `server/db/migrations/`.)

---

## 13. Everyday commands

| Task | Command |
|---|---|
| App status | `sudo systemctl status careercode` |
| Live app logs | `sudo journalctl -u careercode -f` |
| Restart app | `sudo systemctl restart careercode` |
| Nginx errors | `sudo tail -f /var/log/nginx/error.log` |
| Health check | `curl http://127.0.0.1:3000/api/health` |
| Database shell | `sudo -u postgres psql careercode` |
| Disk usage | `df -h` and `sudo du -sh /var/lib/careercode/uploads` |

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `502 Bad Gateway` | App isn't running: `sudo journalctl -u careercode -n 50` |
| App exits with "DATABASE_URL must be set in production" | `.env` missing or not readable; check step 7 and `EnvironmentFile` in the service |
| `password authentication failed` | Wrong password in `DATABASE_URL`, or special characters not URL-encoded |
| Can sign in but get logged out immediately / login does nothing | Site opened over `http://` — the cookie is HTTPS-only. Use `https://` (step 9) |
| Chats don't update live | Nginx WebSocket headers missing — check the `Upgrade`/`Connection` lines and `websocket-upgrade.conf` |
| "Request is too large" / uploads fail | Raise `client_max_body_size` in Nginx and/or `MAX_UPLOAD_MB` |
| Drive tab says "not set up" | Set `GOOGLE_DRIVE_API_KEY` (and optionally `GOOGLE_DRIVE_ROOT_FOLDER_ID`), restart, or configure the folder in the app as a super admin |
| Drive says folder not found | The folder isn't shared "Anyone with the link can view", or the API key isn't enabled for the Drive API |
| `EACCES` writing uploads | `sudo chown -R careercode:careercode /var/lib/careercode` |
| Forgot the super admin password | Re-run the `create-admin` command from step 8 with the same email — it resets the password |

---

## Security checklist

- [ ] HTTPS working, HTTP redirects to HTTPS
- [ ] `ufw status` shows only OpenSSH, 80, 443
- [ ] PostgreSQL not exposed publicly (`sudo ss -tlnp | grep 5432` shows `127.0.0.1` only)
- [ ] `.env` is `chmod 600`
- [ ] Every admin password reset after migration (the old ones were published in the repo history)
- [ ] Google Drive API key restricted to the Drive API in Google Cloud Console
- [ ] Nightly backups running and copied off the server
- [ ] Firebase service-account key deleted after the import
