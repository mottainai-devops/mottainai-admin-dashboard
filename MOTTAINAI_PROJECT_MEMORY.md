# Mottainai Admin Dashboard — Project Memory

**Last Updated:** April 9, 2026
**Status:** ✅ Production Active
**GitHub Repo:** https://github.com/mottainai-devops/mottainai-admin-dashboard
**Latest Commit:** `ffc1b88` — fix: invalid date display, restore company/lot/binType filters

> **Consolidation Note (April 9, 2026):** The `mottainaisurvey` organisation previously held active repos. As of April 9, 2026, all active Mottainai repositories have been consolidated under `mottainai-devops`. The `mottainaisurvey/old-survey-web-app` repo has been archived. All development targets `mottainai-devops` exclusively.

---

## Project Overview

The Mottainai Admin Dashboard is the management interface for the Mottainai waste management and property enumeration platform. It provides role-based access to pickup records, company management, lot filtering, property enumeration data, and system analytics.

**Production URL:** https://admin.kowope.xyz
**Production Server:** 172.232.24.180
**Internal Port:** 3003 (PM2: `mottainai-dashboard`)

---

## Consolidated Project Ecosystem

| Repository | Role | Live URL |
|------------|------|----------|
| `mottainai-devops/mottainai-platform-backend` | Primary API server | https://upwork.kowope.xyz |
| `mottainai-devops/mottainai-admin-dashboard` | Admin UI + tRPC API (this repo) | https://admin.kowope.xyz |
| `mottainai-devops/mottainai-survey-app` | Flutter pickup app (v3.3.3) | APK via GitHub Actions |
| `mottainai-devops/propertyenumeration` | Flutter enumeration app (v1.64.4) | APK via GitHub Actions |

**Archived:**
- `mottainaisurvey/old-survey-web-app` — Archived April 9, 2026

---

## Technology Stack

### Backend (Admin Dashboard API)

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22.13.0 |
| Package Manager | pnpm |
| Framework | Express 4 + tRPC 11 |
| Database | MongoDB (shared `arcgis` database) |
| Process Manager | PM2 |
| Authentication | JWT tokens + Manus OAuth |

### Frontend (Admin UI)

| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Data Fetching | tRPC client |

---

## Project Structure

### Local Development (Manus Sandbox)
```
/home/ubuntu/mottainai-admin-dashboard/     # This repo
/home/ubuntu/mottainai-platform-backend/    # Platform backend
/home/ubuntu/mottainai-survey-app/          # Flutter survey app
/home/ubuntu/propertyenumeration/           # Flutter enumeration app
```

### Production Server
```
/root/mottainai-dashboard/      # Admin dashboard (running via PM2)
/var/www/upwork.kowope.xyz/     # Platform backend (running via PM2)
```

---

## Recent Changes (April 9, 2026)

| Commit | Change |
|--------|--------|
| `ffc1b88` | fix: invalid date display, restore company/lot/binType filters, fix getFilterOptions to use companyName field |
| `7d71633` | fix: add multer and csv-parse dependencies for propertyEnumerationRest |
| `36a9b2d` | fix: add missing jwtAuth middleware and lotValidation helper for propertyEnumerationRest |

---

## Key Features

- Role-based access control (admin, supervisor, user roles)
- Pickup record management with date, company, lot, and bin type filters
- Property enumeration data view (buildings, sessions)
- Company and lot management
- CSV export
- Mobile app API (authentication, company list)

---

## Deployment

```bash
ssh root@172.232.24.180
cd /root/mottainai-dashboard
git pull origin main
pm2 restart mottainai-dashboard
pm2 save
```

---

## Ecosystem Reference

For the full project ecosystem overview, see:
`mottainai-platform-backend/docs/MOTTAINAI_ECOSYSTEM_OVERVIEW.md`

For GIS layer migration details, see:
`mottainai-platform-backend/docs/GIS_LAYER_MIGRATION_NOTICE.md`
