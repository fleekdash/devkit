# Vendored SDK: do not edit here

`fleekdash-sdk.js` is copied verbatim from the FleekDash monorepo:

`fleekdash/fleekdash` → `public/sdk/fleekdash-sdk.js`

The dev canvas serves this exact file so extensions exercise the **real**
iframe-side SDK. The mock lives only in `canvas/mock-host.js` (the parent
side). When the runtime SDK changes, re-copy this file and bump the version
note below.

Current copy: SDK v1.1.0 (FleekDash 2.6.7.x) + standalone `restNonce`
(`_fleekdash_rest_nonce` URL param / `data-rest-nonce` attribute), from
fleekdash/fleekdash#483, plus nonce-provenance re-init from
fleekdash/fleekdash#510 (issue #488): each `init()` resolves
`nonce`/`restNonce` by source — an explicit `userConfig` value wins and
persists until the caller replaces it; otherwise the iframe
`data-nonce`/`data-rest-nonce` attr (the live, host-rotatable
credential) is re-read on every call; otherwise the URL param seeds the
value and can go stale after an attribute rotation; a last-good store
restores the most recent resolved value when the live source
disappears or a spread wipes the field.
