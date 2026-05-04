# SRE Deployment Manager

Aplikasi full-stack untuk SRE team — end-to-end deployment monitoring:

- **Change Management** (data CAB-approved Change Request)
- **Checkpoint Board** (koordinasi dengan team lain sebelum deploy)
- **Deployment Monitor** (runbook step-by-step, real-time via Socket.io)
- **PDF Report** generator per Change Request

---

## Stack

| Layer    | Tech                                                      |
| -------- | --------------------------------------------------------- |
| Backend  | Node.js · Express · PostgreSQL · Socket.io · PDFKit · JWT |
| Frontend | React · Vite · Tailwind CSS v3 · React Router             |

---

## Setup & Running

### 1. PostgreSQL

Pastikan PostgreSQL sudah running di localhost:5432.

```bash
psql -U postgres -c "CREATE DATABASE sre_deploy_manager;"
```

### 2. Backend

```bash
cd backend

# Edit konfigurasi DB & JWT
cp .env .env.local   # atau edit langsung .env

# Install deps
npm install

# Jalankan migrasi (buat semua tabel)
npm run migrate

# Start server (development)
npm run dev

# Server berjalan di: http://localhost:4000
```

### 3. Buat user pertama (lewat API)

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "full_name": "Admin SRE",
    "email": "admin@company.com",
    "password": "password123",
    "role": "lead",
    "team": "SRE"
  }'
```

Role tersedia: `sre` · `cab` · `lead` · `viewer`

### 4. Frontend

```bash
cd frontend

# Install deps
npm install

# Start dev server
npm run dev

# Buka: http://localhost:5173
```

---

## API Endpoints

| Method | Path                       | Deskripsi                          |
| ------ | -------------------------- | ---------------------------------- |
| POST   | /api/auth/register         | Daftar user baru                   |
| POST   | /api/auth/login            | Login → JWT token                  |
| GET    | /api/auth/me               | Info user login                    |
| GET    | /api/auth/users            | Daftar semua user                  |
| GET    | /api/changes               | List semua CR                      |
| POST   | /api/changes               | Buat CR baru (+ checkpoints+steps) |
| GET    | /api/changes/:id           | Detail CR                          |
| PATCH  | /api/changes/:id           | Update status/field CR             |
| GET    | /api/checkpoints?cr_id=X   | List checkpoint                    |
| PATCH  | /api/checkpoints/:id       | Update status checkpoint           |
| GET    | /api/steps?cr_id=X         | List runbook steps                 |
| PATCH  | /api/steps/:id             | Update status step                 |
| POST   | /api/steps/cr/:cr_id/event | Tambah log/komentar                |
| GET    | /api/pdf/:cr_id            | Download PDF report                |

---

## WebSocket Events (Socket.io)

Client join room: `socket.emit('join:cr', crId)`

| Event                | Deskripsi                      |
| -------------------- | ------------------------------ |
| `step:updated`       | Saat status step berubah       |
| `checkpoint:updated` | Saat status checkpoint berubah |
| `event:new`          | Saat ada log/comment baru      |

---

## Struktur Folder

```
sre-deploy-manager/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.js          # PostgreSQL connection pool
│   │   │   └── migrate.js       # Schema migration
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── changes.js
│   │   │   ├── checkpoints.js
│   │   │   ├── steps.js
│   │   │   └── pdf.js
│   │   └── server.js
│   ├── .env                     # Konfigurasi (DB, JWT, dll)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/client.js        # Axios instance
    │   ├── context/AuthContext.jsx
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   └── StatusBadge.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── ChangesPage.jsx
    │   │   ├── NewChangePage.jsx
    │   │   ├── ChangeDetailPage.jsx
    │   │   ├── CheckpointsPage.jsx
    │   │   └── DeployMonitorPage.jsx
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
```

---

## Migrasi ke Docker / HWC (nanti)

Cukup update `.env` backend:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=sre_deploy_manager
DB_USER=your-user
DB_PASSWORD=your-password
```

Untuk production, build frontend:

```bash
cd frontend && npm run build
# Serve dist/ via nginx atau serve dari Express static
```
