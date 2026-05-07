# Grocery Tracker (NAS / Portainer ready)

This is a self-hosted grocery and pantry tracking app built with:
- FastAPI + SQLAlchemy + PostgreSQL
- Next.js + React + TypeScript
- Docker Compose for deployment

## Ports and paths
- App URL on NAS: `http://YOUR_NAS_IP:3011`
- PostgreSQL data path on NAS: `/volume1/Docker/groceryTracker/database`

## Deploy with Portainer

Use **Stacks** → **Add stack** → **Repository**.

Repo structure must look like this:

```text
backend/
frontend/
docker-compose.yml
.env.example
README.md
```

### Environment variables in Portainer
Set these in the stack UI:

```text
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-this
POSTGRES_DB=grocery_tracker
CORS_ORIGINS=http://YOUR_NAS_IP:3011
```

### Notes
- The frontend is exposed on host port **3011**.
- The backend is internal only and is reached through the frontend proxy at `/api`.
- PostgreSQL data is stored directly on the NAS bind mount at `/volume1/Docker/groceryTracker/database`.

## Local dev (optional)

### Run only the database with Docker
```bash
docker compose up -d db
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://postgres:change-this@127.0.0.1:5432/grocery_tracker"
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- -p 3011
```

Open `http://localhost:3011`

## Important deployment behavior
- Updating the frontend/backend containers should **not** delete your data.
- Deleting `/volume1/Docker/groceryTracker/database` **will** delete your DB.
