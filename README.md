# OPTICOR EPMS

Static Vanilla JavaScript dashboard for the OPTICOR Power Management System assessment.

## Run

Open [`project/index.html`](project/index.html) directly in Chrome or Edge. No build step, package installation, server, or module loader is required. The application uses classic scripts so it can run from `file://`.

The Google Fonts and Chart.js resources are loaded from their CDNs. An internet connection is needed for the Inter/JetBrains Mono fonts and the live Trends chart; the Trends screen shows a clear fallback message if Chart.js cannot be loaded.

## Project structure

- `project/index.html` - semantic application shell, sidebar, script and stylesheet loading
- `project/css/variables.css` - shared design tokens
- `project/css/styles.css` - layout, responsive rules, component styling, and screen-specific styles
- `project/js/store.js` - centralized state, alarm actions, 2-second simulation, and pub/sub
- `project/js/app.js` - client-side navigation and sidebar badge synchronization
- `project/js/views/` - Dashboard, TRCC Layout, Trends & Analysis, and Alarms & Notifications view modules

## Core features

- Fixed OPTICOR EPMS sidebar with active navigation and live unacknowledged alarm count
- Dashboard KPIs, six-field 12-unit plant grid, system status, and recent alarms
- TRCC Layout with live status filters, metric selector, six field grids, electrical inspector, and fault indicators
- Trends & Analysis with searchable unit selection, Trend/VI Curve modes, Chart.js live updates, parameter and time-range controls
- Alarms & Notifications with KPI summaries, severity/device/status/search filters, sortable rows, row tinting, individual acknowledgement, and bulk acknowledgement
- 72 simulated units, realistic electrical values, rolling 60-point histories, and seeded alarms
- Responsive layout for smaller screens and direct `file://` execution without frameworks or build tooling

## Optional enhancements

No optional enhancements were enabled beyond the requested core screens. The existing Trends `Thresholds` and CSV controls remain presentation placeholders, while the simulator, alarm acknowledgement, and live chart updates are fully functional.
