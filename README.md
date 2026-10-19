# FleekDash Devkit

**Build and iterate on a FleekDash extension without installing WordPress.**

`fd-dev` is a zero dependency dev server that plays the role of the FleekDash
host: it embeds your extension's built page in an iframe and answers the real
postMessage protocol with fixture data. You write code, refresh, and watch
every SDK call happen live.

The trick that makes it honest: your extension talks to the **real SDK**. The
`sdk/fleekdash-sdk.js` file served to the iframe is vendored verbatim from the
FleekDash plugin. Only the parent side of the conversation is mocked.

## Quickstart

```bash
# from your extension checkout (serves dist/pages/*.html or pages/*.html)
npx github:fleekdash/devkit --ext .

# or point anywhere, on any port
node bin/fd-dev.mjs --ext ../my-extension --port 4400
```

Open `http://localhost:4400/` and you get a canvas page with:

- your extension running in an iframe, wired with the same
  `fleekdash_sdk_url` injection the real PHP host performs
- a live log of every `FLEEKDASH_MESSAGE` your extension sends
- a theme toggle that broadcasts `themeChange` exactly like the real host
- mock surfaces for notifications (toasts), modals, navigation and menu badges

This is the fastest possible loop for extension UI work: no database, no PHP,
no auth, instant reload.

## What the mock answers

| SDK call | Mock behavior |
|---|---|
| `INTEGRATION_READY` | `{theme, site, integration}` with palette variables the real SDK applies |
| `WP_DATA_REQUEST` | `/wp/v2/{posts,pages,users,categories}` served from fixtures (`per_page` honored); your extension's `mockRoutes` exact paths win; other endpoints return `{items:[]}` |
| `WP_DATA_MUTATION` | `/wp/v2/*` gets core REST shapes (bare entity on write; DELETE returns the trashed entity, or `{deleted:true, previous:<entity>}` with `force=true`); other namespaces get `{success, <singular-resource>: {...template, ...body, id}}`; DELETE gets `{success, deleted:<id>}` |
| `GET_INTEGRATION_SETTINGS` | served from `mock-data/settings.json[<integration_id>]` |
| `GET_THEME_ASSETS` | current theme payload plus empty asset lists |
| `SHOW_NOTIFICATION` | rendered as a toast in the canvas chrome |
| `OPEN_MODAL` / `NAVIGATE` / `UPDATE_MENU_BADGE` / `LOG_MESSAGE` | rendered or logged in the canvas |

## Your own fixture data

Fixtures live in `mock-data/*.json`: posts, pages, users, categories, site
info, theme palette, per-integration settings. Edit freely; the canvas
refetches on reload.

An extension can also ship its own `<ext>/mock-data/*.json`, advertised via
`/mock/manifest.json`. Custom request routes go in
`"mockRoutes": {"/x/v1/path": {...}}` and mutation response templates in
`"mockMutations": {"task": {...}}`. See `mock-data/todo-system.json` for a
worked example matching the Task System extension.

## What this is, and what it is not

**Is:** a fast loop for iframe side work. SDK calls, theme handling, settings
reads, notifications, navigation requests, error surfaces.

**Is not:** a WordPress. There is no REST API, no PHP runtime, no auth, no
persistence. When you want the genuine host, install the extension on a dev
site; the [extension-starter](https://github.com/fleekdash/extension-starter)
README covers that path.

## Structure

```
bin/fd-dev.mjs        zero-dep Node server (canvas + ext statics + fixtures)
canvas/index.html     mock host chrome: header, theme toggle, SDK call log
canvas/mock-host.js   parent side protocol router (also requireable in tests)
sdk/                  vendored real fleekdash-sdk.js (see sdk/SYNC.md)
mock-data/*.json      fixtures: site, posts, pages, users, categories, settings, palette
test/smoke.mjs        server surface + protocol router assertions
```

## License

MIT. This is dev tooling, not WordPress distributed code.
