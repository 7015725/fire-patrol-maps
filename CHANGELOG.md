# Changelog

All notable changes to **Facility Safety Maps** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers live in the root `package.json` (source of truth). Workspace
packages (`apps/api`, `apps/web`) must match — run `npm run version:sync`.

Container images: `ghcr.io/ajthom90/facility-maps:<version>` (see README).

## [Unreleased]

## [0.10.0] — 2026-09-25

### Added
- 月检模式（个人使用）：后台地图编辑器新增“月检模式”开关，点位按本月状态着色 —— 未检灰色虚线圈、正常绿色、异常红色置顶；点选弹窗可一键标记正常 / 异常（异常需填备注），可撤销。
- 本月进度条（已检 x / 总数），月份切换自动归零；后台新增“巡检记录”页，可按月份查异常清单。
- 新增 `inspection_records` 表（feature + month 唯一），随设施级联删除；老库启动自动建表。

## [0.9.0] — 2026-09-25

### Added
- 预设自定义（方案 A）：后台可新建自定义预设（中文名必填、英文名可选、设施名单自选），可改名、可删除；系统预设可改名（`all` 锁定），设施名单由版本管理。自定义名为空时回退语言包。
- 公开/管理预设接口返回 `nameZh` / `nameEn`；前台图层筛选显示自定义名，预设按钮自动换行。

### Fixed
- 启动迁移补齐旧 `__drizzle_migrations` 空时间戳，避免已部署数据库重复执行 0000 初始化而启动失败。

## [0.8.1] — 2026-09-25

### Fixed
- 七氟丙烷灭火控制器配色改为深紫（`#7e22ce`），与屋顶通道的青色拉开区分。

## [0.8.0] — 2026-09-25

### Added
- 5 种新标记类型：电气火灾控制器（`electrical_fire_controller`）、七氟丙烷灭火控制器（`gas_suppression_controller`）、水力警铃（`water_gong`），纳入 `fire_response` 预设；电梯厅（`elevator_lobby`）、货梯（`freight_elevator`），纳入 `rooms` 预设 — 通过启动预设刷新自动应用到已有部署。

## [0.7.0] — 2026-08-13

### Added
- Delete or Backspace removes the selected feature in the floor editor (ignored while typing in a field).

### Changed
- Pins, vertex handles, labels, and stroke widths stay a constant screen size when zooming. Only the floor plan enlarges; shapes still stay locked to the walls.

## [0.6.0] — 2026-08-13

### Added
- **Room label** feature type for non-safety room outlines, plus a **Rooms** layer preset.
- **Circle** drawing tool with a drag handle to resize.
- Drag pins, move polygons/circles, and pull polygon vertices in the editor (Select tool).
- **Layer order** controls (front / forward / back / bottom) so overlapping shapes can be stacked.

### Changed
- Features now have a `sortOrder` field (existing rows default to 0). Higher values paint on top.

## [0.5.0] — 2026-08-13

### Added
- **`hvac` feature type** (HVAC unit), included in the `utilities` layer preset — applied to existing deployments by the startup preset seed refresh.

### Changed
- Relabeled operator-facing names: `assembly_point` → **Code Red meeting** (evacuate), `safe_haven` → **Code White meeting** (shelter in place). Stored type keys are unchanged.
- **Plan overlay alignment:** the public map and editor now size the floor-plan box to the plan's real aspect ratio (contained in the viewport) instead of stretching a 4:3 box. SVG/PNG/JPEG dimensions are stored on upload. Fixes polygons/pins that lined up while editing but sat off the walls on the public site.

## [0.4.0] — 2026-07-30

### Added
- **Photo/video media on map features:** attach images (PNG/JPEG/WebP) and videos (MP4/WebM/MOV) to any feature in the floor editor; the public feature popup shows them inline. New `feature_media` table is created automatically on upgrade (startup schema compat), stored under the uploads volume.
- **Rectangle tool** in the floor editor: click two opposite corners to draw an axis-aligned rectangle (stored as ordinary polygon geometry, so rendering and editing are unchanged).
- **`smoke_detector` feature type** (with map color and label), included in the `fire_response` layer preset — applied to existing deployments by the startup preset seed refresh.

### Fixed
- Floor editor: switching tools no longer discards an in-progress draft when re-clicking the already-active tool, and media uploads no longer clobber concurrent label/notes edits in the edit panel.

## [0.3.1] — 2026-07-29

### Fixed
- **TrueNAS / upgrade crash:** `GET /api/campuses` 500 when the SQLite DB was created before hierarchy modes (missing `hierarchy_mode` column). Startup now runs an idempotent schema compatibility step after migrations.
- Log API 500s with method and path for easier ops debugging.

## [0.3.0] — 2026-07-29

### Added
- **Per-campus hierarchy modes:** `full` (Campus→Building→Floor), `no_buildings` (Campus→Floor), `single_map` (one site map). Configurable in admin Structure; public routes and APIs adapt.
- `docker-compose.truenas.yml` — TrueNAS SCALE sample with all settings inlined (no `.env`)

### Changed
- Floors always store `campus_id`; `building_id` is optional (null when campus has no buildings layer).
- Init SQLite schema includes `hierarchy_mode` and flexible floor parents. **Fresh volumes recommended** if upgrading from 0.2.0 (init migration was reshaped; empty DBs only).

## [0.2.0] — 2026-07-29

### Changed
- **BREAKING:** Replace PostgreSQL with **SQLite** (`better-sqlite3`). Existing Postgres volumes are not auto-migrated.
- Docker Compose is a **single `app` service** with two named volumes:
  - `facility-maps-data` → `/data` (DB + uploads)
  - `facility-maps-config` → `/config` (`app.env` secrets/settings)
- CI no longer starts a Postgres service; tests use temp SQLite files.
- Base image uses `node:22-bookworm-slim` for native module prebuilds.

### Added
- `scripts/backup.sh` / `scripts/restore.sh` for portable host migration archives
- Auto-write `/config/app.env` on first boot; load config file on startup (fills empty env)

### Removed
- `postgres` npm dependency and Compose `db` service
- `DATABASE_URL` environment variable (use `SQLITE_PATH`)

## [0.1.0] — 2026-07-29

### Added
- Initial public versioned release baseline
- AWAIR-oriented feature type catalog and scenario presets (evacuation, fire, medical, spill/chemical, utilities, hazards)
- Docker Compose stack (app + Postgres), multi-stage production image
- Public floor maps, admin editor, layer presets, English i18n
- GitHub Actions CI (tests + build) and GHCR container publish workflow
- `APP_VERSION` baked into the image; exposed on `GET /api/health`
- Version sync script (`npm run version:sync` / `version:check`)
- Startup always re-runs system preset seed after migrations (image updates pick up new feature types)

### Fixed
- `npm ci` / Docker build esbuild binary mismatch (`tsx` vs `vite`); pin `tsx@4.19.4` and override `esbuild@0.25.12`
