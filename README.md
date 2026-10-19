# @fleekdash/devkit — dev canvas

Build and iterate on a FleekDash extension **without a WordPress install**. `fd-dev` serves a mock FleekDash host that embeds your extension's built page in an iframe and answers the real postMessage protocol with fixture data.

Your extension exercises the **real SDK** — `sdk/fleekdash-sdk.js` is vendored verbatim from the plugin. Only the parent side is mocked.

## Usage

```bash
# from your extension checkout (expects dist/pages/*.html or pages/*.html)
npx github:fleekdash/devkit --ext .

# or point anywhere
node bin/fd-dev.mjs --ext ../my-extension --port 4400
```

Opens `http://localhost:4400/` — a canvas page with:

- your extension iframe (same `fleekdash_sdk_url` injection the real PHP does)
- a live log of every `FLEEKDASH_MESSAGE` the extension sends
- theme toggle (broadcasts `themeChange` exactly like the real host)
- mock surfaces for notifications (toast), modals, navigation and badges

## What the mock answers

| SDK call | Mock behavior |
|---|---|
| `INTEGRATION_READY` | `{theme, site, integration}` — palette vars applied by the real SDK |
| `WP_DATA_REQUEST` | `/wp/v2/{posts,pages,users,categories}` → fixtures (`per_page` honored); extension `mockRoutes` exact paths win; other endpoints → `{items:[]}` |
| `WP_DATA_MUTATION` | `/wp/v2/*` → core REST shapes (bare entity on write, `{deleted:true, previous}` on DELETE); other namespaces → `{success, <singular-resource>: {...template, ...body, id}}`; DELETE → `{success, deleted:<id>}` |
| `GET_INTEGRATION_SETTINGS` | `mock-data/settings.json[<integration_id>]` |
| `GET_THEME_ASSETS` | current theme payload + empty asset lists |
| `SHOW_NOTIFICATION` | toast in the canvas chrome |
| `OPEN_MODAL` / `NAVIGATE` / `UPDATE_MENU_BADGE` / `LOG_MESSAGE` | rendered/logged in the canvas |

Fixtures live in `mock-data/*.json` — edit freely; the canvas refetches on reload. An extension can ship its own `<ext>/mock-data/*.json` (advertised via `/mock/manifest.json`) — hoist custom routes with `"mockRoutes": {"/x/v1/path": {...}}` and mutation templates with `"mockMutations": {"task": {...}}`; see `mock-data/todo-system.json`.

## Scope — what this is / is not

**Is:** a fast loop for iframe-side UI work — SDK calls, theme handling, settings reads, notifications.

**Is not:** a WordPress. No REST API, no PHP, no auth, no persistence. For real-WP testing, install the extension on a dev site (see [extension-starter](https://github.com/fleekdash/extension-starter)).

## Structure

```
bin/fd-dev.mjs        zero-dep Node server (canvas + ext static + mock fixtures)
canvas/index.html     mock host chrome (header, theme toggle, SDK call log)
canvas/mock-host.js   parent-side protocol router (also node-requireable for tests)
sdk/                  vendored real fleekdash-sdk.js — see sdk/SYNC.md
mock-data/*.json      fixtures: site, posts, pages, users, categories, settings, palette
test/smoke.mjs        server surface + protocol router assertions
```

## License

MIT — dev tooling, not WP-distributed code.
