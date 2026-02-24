# CLAUDE.md - Gestionaulashispa

## Project Overview

**Hispanidad Reservas** is a Progressive Web App (PWA) for managing classroom and resource bookings at Colegio La Hispanidad, a Spanish educational cooperative. Teachers and administrators book computer labs, language labs, and laptop carts for Primary (Primaria) and Secondary (Secundaria) education stages.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.2 (TypeScript) |
| Backend | Express.js (Node.js, CommonJS) |
| Real-time | Socket.IO (server + client) |
| Build (prod) | esbuild (`node build.js`) |
| Build (dev) | Vite (port 3000) |
| Styling | Tailwind CSS (loaded via CDN in `index.html`) |
| Icons | lucide-react |
| Email | Nodemailer (Gmail SMTP) |
| PDF | jsPDF + jspdf-autotable |
| Scheduling | node-cron (weekly incident reports) |
| Process manager | PM2 (production) |
| Data storage | File-based JSON (no database) |

## Project Structure

```
/
├── server.js                  # Express backend (all API routes, Socket.IO, external sync)
├── index.tsx                  # React entry point
├── App.tsx                    # Main app component (client-side routing via state)
├── index.html                 # HTML template (loads Tailwind CDN, Google Sign-In)
├── build.js                   # esbuild production build script
├── vite.config.ts             # Vite dev server configuration
├── types.ts                   # Shared TypeScript type definitions
├── tsconfig.json              # TypeScript config (ES2022, react-jsx)
├── package.json               # Dependencies and scripts
├── install.sh                 # Automated deployment script (PM2 + systemd)
├── .env.template              # Environment variable template
├── metadata.json              # PWA metadata
├── incidents.json             # Incident data (committed)
│
├── components/                # Reusable React components
│   ├── Navbar.tsx             # Navigation bar
│   ├── StudentOrganizer.tsx   # Seat assignment tool
│   ├── HistoryModal.tsx       # Audit log viewer
│   ├── IncidentModal.tsx      # Incident reporting modal
│   └── Modal.tsx              # Generic modal wrapper
│
├── pages/                     # Page-level components
│   ├── Login.tsx              # Authentication page
│   ├── Dashboard.tsx          # Home / upcoming bookings
│   ├── CalendarView.tsx       # Weekly booking calendar (per stage)
│   └── IncidentsPage.tsx      # Incident management
│
├── services/                  # Service layer
│   ├── storageService.ts      # API client (all fetch calls to backend)
│   └── reportService.js       # Email sending & weekly report cron
│
├── utils/                     # Utility functions
│   ├── dashboardUtils.ts      # Dashboard data helpers
│   ├── dateUtils.ts           # Date formatting, holiday calendar, school year logic
│   └── resourceUtils.ts       # Resource labels, capacities, stage filtering
│
└── dist/                      # Build output (gitignored)
    └── bundle.js              # esbuild output
```

## Commands

```bash
# Install dependencies
npm install

# Build for production (compiles TSX -> dist/bundle.js via esbuild)
npm run build

# Start the server (Express on PORT from .env, default 3001)
npm start

# Production deployment (full install + PM2 setup)
bash install.sh
```

There is **no test suite** and **no linter/formatter** configured in this project.

## Data Storage

All data is persisted as JSON files on disk (no database):

| File | Content | Gitignored |
|------|---------|------------|
| `bookings.json` | All reservations | Yes |
| `history.json` | Audit log (max 1000 entries) | Yes |
| `incidents.json` | TIC incident reports | No |
| `users_cache.json` | Teacher data (synced from Prisma Edu) | Yes |
| `students_cache.json` | Student data (synced from Prisma Edu) | Yes |
| `classes_cache.json` | Class/course data (synced from Prisma Edu) | Yes |

Data is loaded into memory caches on startup and written back to disk on changes. The server connects to an external Prisma Edu system (`https://prisma.bibliohispa.es`) via WebSocket for real-time sync of users, students, and classes.

## Architecture Notes

### Frontend

- **No router library** - navigation is managed via React state in `App.tsx` (a `currentPage` state variable).
- **No state management library** - state is passed down via props from `App.tsx`.
- **Styling** uses Tailwind CSS classes loaded from CDN (no local Tailwind config/build).
- The `@/*` path alias maps to the project root (configured in `tsconfig.json`).

### Backend

- `server.js` is a single-file Express server (~700 lines) using **CommonJS** (`require`).
- All API routes are defined inline (no route splitting).
- Socket.IO broadcasts booking and incident updates to all connected clients.
- Memory caches (`usersMemoryCache`, `bookingsMemoryCache`, etc.) serve as the primary data source; JSON files are the persistence layer.

### Authentication

Three authentication methods:

1. **External login** via Prisma Edu API (`/api/proxy/login`) - validates credentials against the external system.
2. **Google OAuth** (`/api/auth/google`) - validates Google tokens and matches against the local user cache.
3. **SSO silent login** (`GET /api/proxy/me`) - reads `BIBLIO_SSO_TOKEN` cookie, verifies JWT, auto-logs in.

Both `/api/proxy/login` and `/api/auth/google` create the `BIBLIO_SSO_TOKEN` cookie directly (when `ENABLE_GLOBAL_SSO=true`) using `jwt.sign()` with `JWT_SSO_SECRET`. The cookie enables cross-app SSO across all `*.bibliohispa.es` subdomains.

Sessions are stored client-side in `localStorage` as `hispanidad_user`. There is no backend session store (stateless). On page load, `App.tsx` calls `/api/proxy/me` for SSO auto-login before falling back to localStorage.

### Roles

| Role | Capabilities |
|------|-------------|
| `ADMIN` | Full access: block slots, manage users, force sync |
| `TEACHER` | Create/delete own bookings, request swaps, report incidents |
| `STUDENT` | Read-only access |

Roles are mapped from the external system via `ROLE_MAP` in `server.js`.

## Key Domain Concepts

- **Stage**: `PRIMARIA` (Primary, 4 time slots) or `SECUNDARIA` (Secondary, 6 time slots)
- **Resource**: `ROOM` (computer/language lab) or `CART` (portable laptop cart, Secondary only)
- **Slot IDs**: Primary slots are `p1`-`p4`, Secondary slots are `s1`-`s6`
- **Booking swap**: Email-based transfer mechanism with confirmation links
- **Seating plan**: Per-booking seat assignments mapping computer numbers to students
- **School calendar**: Holidays and vacation periods are hardcoded in `utils/dateUtils.ts` for 2024-2026

## API Routes (server.js)

### Authentication
- `POST /api/proxy/login` - External credential validation (creates SSO cookie)
- `POST /api/auth/google` - Google OAuth token validation (creates SSO cookie)
- `GET /api/proxy/me` - SSO silent check (reads `BIBLIO_SSO_TOKEN` cookie)

### Data
- `GET /api/teachers` - List teachers
- `GET /api/students` - List students
- `GET /api/classes` - List classes
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create booking(s) (supports recurring)
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking (supports series deletion via query param)
- `GET /api/incidents` - Get incidents
- `POST /api/incidents` - Create incident
- `PATCH /api/incidents/:id` - Update incident status
- `GET /api/history` - Get audit log

### Admin
- `GET /api/admin/force-sync` - Reconnect to Prisma socket
- `POST /api/admin/sync` - Trigger manual data sync
- `GET /api/admin/test-email` - Test email configuration

### Booking Swap
- `POST /api/bookings/request-swap` - Request booking transfer
- `GET /api/bookings/swap/confirm` - Email confirmation handler

### Static
- `GET *` - SPA fallback (serves `index.html`)

## Environment Variables

Copy `.env.template` to `.env` and fill in values:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | `3001` |
| `API_SECRET` | Prisma Edu API authentication | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | - |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `465` |
| `EMAIL_SECURE` | Use TLS | `true` |
| `EMAIL_USER` | SMTP sender email | - |
| `EMAIL_PASS` | SMTP password/app password | - |
| `EMAIL_TO` | Weekly report recipient | - |

`GOOGLE_CLIENT_ID` is injected into the frontend bundle at build time via `build.js`.

## Unified Header

`components/Navbar.tsx` implements the unified header design shared across apps. Uses the `.glass-header` class (defined in `src/styles/theme.css`) with:
- **Logo**: `h-10` with `dark:brightness-0 dark:invert` for theme adaptation (no background box)
- **3-button theme toggle**: Sun / Monitor / Moon (Light / System / Dark), uses `useTheme()` from `src/context/ThemeContext.tsx`, active state styled with `text-[#234B6E]`
- **Prisma link**: SVG icon (4 squares, top-right filled `#3b82f6`), links to `https://prisma.bibliohispa.es`
- App-specific: incidents badge (admin), user badge with role, logout button

The `.glass-header` class uses `rgba(255,255,255,0.45)` background with `backdrop-filter: blur(24px) saturate(1.6)`, with a dark variant. Theme is managed via `ThemeContext` with `useTheme()` hook supporting `'light' | 'dark' | 'system'`, toggling `.dark` class on `<html>`.

## Conventions for AI Assistants

- **Language**: The application UI and most comments are in **Spanish**. Keep user-facing strings in Spanish. Code identifiers (variables, functions) use English.
- **Backend is CommonJS**: `server.js` and `services/reportService.js` use `require()`/`module.exports`. Do not use ES module syntax (`import`/`export`) in these files.
- **Frontend is TypeScript + ESM**: All `.ts`/`.tsx` files use ES module imports. Type definitions live in `types.ts`.
- **No test framework**: There are no automated tests. Manual testing is required after changes.
- **No linter**: There is no ESLint or Prettier config. Follow the existing code style (2-space indentation, single quotes in JS, template literals for string interpolation).
- **Single-file server**: All backend logic is in `server.js`. When adding routes, add them inline following the existing pattern.
- **Data files are JSON**: When modifying data handling, always write valid JSON and handle file I/O errors gracefully.
- **Socket.IO events**: After modifying bookings or incidents, emit the corresponding `server:bookings_updated` or `server:incidents_updated` event.
- **Build after frontend changes**: Run `npm run build` after modifying any `.tsx`/`.ts` file to regenerate `dist/bundle.js`.
- **Never commit `.env`**: It is gitignored. Use `.env.template` for documenting new environment variables.
- **Dates use `YYYY-MM-DD`** format. Time slots use `HH:mm` format.
