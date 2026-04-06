# Grocery Tracker MVP

A self-hostable grocery tracking app built with:

- **Frontend:** Next.js + React + TypeScript
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL
- **Deployment:** Docker Compose

## Quick start

From the project root:

```bash
cp .env.example .env
docker compose up -d --build
```

Open it on the host machine:

```text
http://localhost:3000
```

Open it from another device on your local network:

```text
http://YOUR-SERVER-IP:3000
```

Example:

```text
http://192.168.1.50:3000
```

## What is exposed

- `frontend` is exposed on port `3000`
- `backend` stays internal to Docker Compose
- the frontend proxies `/api/*` to the backend service
- PostgreSQL data is persisted in the `postgres_data` volume

Users on your local network only need one URL: the frontend URL.

## Useful commands

Start or rebuild everything:

```bash
docker compose up -d --build
```

See logs:

```bash
docker compose logs -f
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f db
```

Stop everything:

```bash
docker compose down
```

Remove all data too:

```bash
docker compose down -v
```

See running containers:

```bash
docker compose ps
```

## Find your server IP on Linux

```bash
hostname -I
```

Use one of the LAN IPs it shows, usually something like `192.168.x.x` or `10.x.x.x`.

## If other devices cannot reach it

Check:

1. The host firewall allows inbound TCP on port `3000`
2. The devices are on the same network
3. The containers are healthy:

```bash
docker compose ps
docker compose logs -f frontend
```

## Environment variables

Edit the root `.env` file if you want:

```env
APP_PORT=3000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=grocery_tracker
CORS_ORIGINS=http://localhost:3000
```

Usually only `APP_PORT` and `POSTGRES_PASSWORD` matter.

## Notes

- This is a single-user MVP right now.
- There is no authentication yet, so keep it on your trusted local network.
- A good next step after beta testing would be adding auth and HTTPS behind a reverse proxy.
