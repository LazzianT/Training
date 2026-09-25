# Training App Runbook

## Repository

- Source: `https://github.com/LazzianT/Training`
- Deployment: Portainer pada host `10.19.25.29`
- Portainer menggunakan Git repository, branch/tag, dan Stack Environment Variables.
- Jangan commit `.env`, password, token, atau credential database.

## Local Baseline

- Workspace source: repository root
- Node.js: `24.x`
- Package manager: `pnpm@12.6.0` via Corepack
- Client local: `http://localhost:5173`
- API local: `http://localhost:3000`
- Root `.env` hanya untuk local development.

## Commands

```powershell
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm audit --prod
```

## Local Docker

```powershell
docker compose --env-file .env config
docker compose --env-file .env build
docker compose --env-file .env up -d
```

## Portainer Deployment

1. Create Stack dari Git repository `LazzianT/Training`.
2. Set Compose path `training-app/docker-compose.yml`.
3. Set branch `main` setelah initial push, atau tag immutable yang disetujui.
4. Tambahkan Stack Environment Variables dari secret manager/Portainer UI.
5. Jangan menaruh credential di Git atau Stack definition.
6. Deploy stack.
7. Verifikasi `GET /health/live` dan halaman client.
8. Verifikasi upload volume persists setelah restart.

Required variables:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
CORS_ORIGIN
JWT_ACCESS_SECRET
REFRESH_TOKEN_PEPPER
```

`NODE_ENV`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`, `MAX_UPLOAD_BYTES`, `WHATSAPP_PROVIDER`, dan `WHATSAPP_API_KEY` memiliki baseline values atau tetap kosong sampai provider disetujui.

## Health

- `GET /health/live`: process hidup.
- `GET /health/ready`: `503` sampai database adapter dan storage readiness selesai.

## Data Safety

- Existing SQL Server tables are read-only.
- Tabel baru hanya namespace `training_` atau prefix approved DBA.
- Jangan menjalankan DDL/DML pada existing table tanpa approval DBA tertulis.
- Migration hanya menulis ke tabel baru atau staging table.
- Jangan jalankan migration dari Portainer sebelum DBA sign-off.

## Production Access

- Jangan memakai account `sa` untuk runtime aplikasi.
- Gunakan account least privilege dan secret manager.
- Rotate credential discovery setelah environment selesai.
- Backup volume upload dan database restoration harus diuji terpisah.
