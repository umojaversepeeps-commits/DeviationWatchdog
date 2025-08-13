# Oracle Deviation Watchdog

Cross‑check Comet oracle vs UniswapV2 USDC pair. Flag deviations.

## How to use

```bash
cp .env.example .env
RPC_URL=http://127.0.0.1:8545
COMET_ADDRESS=0xc3d688B66703497DAA19211EEdff47f25384cdc3

npm install
npm run build
node dist/index.js          # scan all assets
node dist/index.js -a 0x... # scan one asset
```

Output fields: `token`, `oracle`, `dex`, `deviation` (fraction). Wire to alerts as you like. 