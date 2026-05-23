# Deploying Obol on a free persistent VM (Oracle Always Free)

Obol runs a long-lived web process that spawns the agent as a child process and
keeps a local SQLite ledger, so it needs a real VM rather than a serverless
host. Oracle Cloud's Always Free tier gives you one for free, indefinitely.

These steps also work on any Ubuntu VM (Google Cloud `e2-micro` Always Free, a
self-hosted box, etc.).

## 1. Provision the VM (one time)

1. In the Oracle Cloud console, create a Compute instance:
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM, Always Free eligible), 1-2
     OCPU / 6-12 GB is plenty.
   - Image: **Ubuntu 22.04**.
   - Add your SSH public key.
2. Open the web ports. Oracle blocks them in **two** places:
   - **VCN Security List:** add Ingress rules for TCP **80** and **443** from
     `0.0.0.0/0`.
   - **The instance firewall** (Oracle Ubuntu images ship with iptables rules
     that drop traffic). SSH in and run:
     ```bash
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```
   Do **not** open 3000 or 4020; they stay internal behind Caddy.

## 2. Install runtime deps (one time)

```bash
# Node 20 (arm64-compatible)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PM2 process manager
sudo npm i -g pm2

# Caddy (automatic HTTPS)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 3. Clone + configure

```bash
git clone https://github.com/ajanaku1/obol.git
cd obol
cp .env.example .env
nano .env   # fill in ANTHROPIC_API_KEY, ARC_RPC_URL, ARC_USDC_ADDRESS,
            # OBOL_WALLET_PRIVATE_KEY, VENDOR_PAYOUT_ADDRESS, TAVILY_API_KEY
```

If you don't already have a wallet, run `npm run wallet:create`, fund the
printed address at https://faucet.circle.com, then
`npm run gateway:deposit --workspace=@obol/payments -- 3.00`.

> The `.env` holds Obol's testnet wallet key. It's low value, but treat the VM
> as semi-trusted: restrict SSH, don't reuse this key elsewhere.

## 4. Start the app

```bash
./deploy/deploy.sh          # installs, builds, starts PM2
pm2 startup                 # run the command it prints, so PM2 survives reboot
pm2 save
```

## 5. Front it with HTTPS

The browser wallet flow needs HTTPS. With no domain, use `sslip.io`, which
resolves any `<ip>.sslip.io` to that IP:

```bash
export PUBLIC_HOST=$(curl -s ifconfig.me).sslip.io
sudo PUBLIC_HOST="$PUBLIC_HOST" caddy run --config Caddyfile --adapter caddyfile
# or install as a service: sudo PUBLIC_HOST=$PUBLIC_HOST caddy start --config Caddyfile
echo "Live at https://$PUBLIC_HOST"
```

Caddy fetches a Let's Encrypt cert for that host automatically.

## 6. Publish the URL

```bash
gh repo edit ajanaku1/obol --homepage "https://<your-ip>.sslip.io"
```

## Updating later

```bash
git pull && ./deploy/deploy.sh
```
