# DungeonAndDragons

Web tool for running and organizing a D&D campaign. The project combines a Next.js frontend with a Spring Boot API to manage landmarks, buildings, characters, organizations, DM notes, battles, and presentation maps.

## What It Includes

- **World map (`/mapa`)**: interactive map viewer with landmarks, pan/zoom, and marker editing.
- **Entities (`/entidades`)**: management for characters, players, states, buildings, organizations, and landmarks.
- **Information (`/informacion`)**: catalog of monsters, conditions, spells, items, feats, rules, books, and pages.
- **DM (`/dm`)**: DM notes, open loops, events, relationships, and party inventory.
- **Battle (`/batalla`)**: tactical board with initiative, tokens, fog of war, props, and presentation sync.
- **Presentation (`/presentacion`)**: player-facing view with maps, fog, tokens, and blackout mode.
- **Landmark detail (`/landmarks/[nombreLandmark]`)**: control center for each location, with map, grid, related entities, and timeline.
- **JSON dungeons**: landmarks of type `mazmorra` can use versioned JSON maps with a dedicated generator, editor, and renderer.
- **Authentication**: cookie/JWT login with registration limited to the first user.

## Structure

```text
.
|- Frontend/   # Next.js 16 + React 19
|- Backend/    # Spring Boot + PostgreSQL
|- package.json
```

## Stack

- Frontend: `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS 4`, `Radix UI`
- Backend: `Spring Boot`, `Java 21`, `PostgreSQL`, `Flyway`, `cookie-based JWT auth`

## Requirements

- Node.js 20+
- npm
- Java 21
- PostgreSQL 15+

## Getting Started

### 1. Backend

Create `Backend/.env` from `Backend/.env.example` and also add the database credentials required by the backend:

```env
APP_MODE=development
JWT_SECRET_KEY=your_long_jwt_secret
DB_NAME=database_name
DB_USERNAME=postgres_user
DB_PASSWORD=postgres_password

# Optional
# FRONTEND_PUBLIC_ORIGIN=http://localhost:3000
```

Start the backend:

```bash
cd Backend
./mvnw spring-boot:run
```

Local base URL:

- `http://localhost:8086/api`

### 2. Frontend

Create `Frontend/.env` from `Frontend/.env.example`:

```env
NEXT_PUBLIC_APP_MODE=development

# Optional
# NEXT_PUBLIC_SITE_ORIGIN=http://localhost:3000
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8086/api
```

Install dependencies and start the frontend:

```bash
cd Frontend
npm install
npm run dev
```

Local app:

- `http://localhost:3000`

### 3. Root Scripts

The repository root exposes shortcuts to the frontend scripts:

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

## Environment Variables

### Frontend

- `NEXT_PUBLIC_APP_MODE`: `development` or `production`
- `NEXT_PUBLIC_SITE_ORIGIN`: public site origin
- `NEXT_PUBLIC_API_BASE_URL`: explicit API override
- `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`: enables analytics when needed
- `BACKEND_API_BASE_URL`: used by the server-side monster route

### Backend

- `APP_MODE`: `development` or `production`
- `FRONTEND_PUBLIC_ORIGIN`: override for CORS/CSP
- `JWT_SECRET_KEY`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`

## Main Endpoints

The authenticated API lives under `/api/v1` and exposes CRUD for:

- `landmarks`
- `buildings`
- `characters`
- `organizations`

It also includes authentication under `/api/auth/*`.

## Development And Tests

Frontend:

```bash
cd Frontend
npm run lint
npm run test:dungeons
```

Backend:

```bash
cd Backend
./mvnw test
```

## Useful Internal Documentation

- `Backend/README.md`: backend setup, security, endpoints, and payloads
- `Frontend/components/map/README.md`: world map viewer
- `Frontend/components/battle/README.md`: battle overlays and UX
- `Frontend/components/dungeons/README.md`: JSON dungeon architecture
- `Frontend/lib/dungeons/README.md`: dungeon JSON contract
- `Frontend/app/landmarks/[nombreLandmark]/README.md`: landmark detail page and map modes

## Architecture Notes

- The frontend redirects `/` to `/mapa`.
- In development, the frontend points to the backend on `localhost:8086` by default.
- The battle and presentation views share scene state and overlays through browser storage/sync.
- Landmarks of type `mazmorra` only accept JSON asset-based maps compatible with the `type: "mazmorra"` contract.
- Monster loading goes through `Frontend/app/api/monsters/route.ts`, which acts as a server-side layer for lists, exact detail lookup, and token prefetching.

## Current Repo Notes

- The frontend includes static deployment scripts (`build:assets`, `deploy-static.bat`).
- The backend already includes Flyway migrations and schema validation.
- The repo contains feature-level technical documentation; this README is the main entry point.
