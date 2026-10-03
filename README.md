# QR Generator

A static QR code generator, live at **[qr.kakkoi.dev](https://qr.kakkoi.dev)**. It has no build step and no backend. Everything is generated in the browser.

- **`/`**: type text and the QR code updates as you type. You can choose the size (256 / 512 / 1024 px) and the ink colour (presets or any custom colour), download the SVG, copy the share link or iframe code, or use the native share sheet on mobile. The state is mirrored in the page URL (`/?t=…&s=…&c=…`), so a reload or a shared link keeps it.
- **`/svg/?t=…`**: a page that shows only the QR code, centred and sized to the viewport. It's meant to be opened directly or embedded in an iframe. With no text, it shows an empty state.

## `/svg` parameters

| Param | Meaning | Default |
|-------|---------|---------|
| `t`   | Text to encode (UTF-8) | (empty state) |
| `s`   | Intended size in px (used for iframes and image responses) | `512` |
| `c`   | Ink hex, without `#` (`fg` is still accepted) | `0B0B0C` |
| `bg`  | Background hex, or `transparent` | `FFFFFF` |
| `ecc` | Error correction: `L`, `M`, `Q`, `H` | `M` |
| `m`   | Quiet zone, in modules | `4` |

Example: `/svg/?s=512&t=hello&c=1E3BC8`

## Embedding

- **Iframe**: paste the `/svg` link into an iframe on any page, and set `s=` to match its size. The generator has a ready-to-copy snippet.
- **`<img>`, Markdown, email, link previews**: use **Download SVG** and host the file yourself. Those places don't run JavaScript, so the link won't render there.

## Service worker

`sw.js` caches the app so it works offline. On this site it also answers non-page requests to `/svg/?…`, such as `<img src>` or `fetch()`, with a real `image/svg+xml` response, and caches each one per URL.

## Files

| File | Role |
|------|------|
| `index.html`, `app.js`, `style.css` | Generator page |
| `tokens.css` | Design tokens (colours, type, spacing) |
| `qr.js` | Shared encoding, URL params and SVG output (page, `/svg`, service worker) |
| `svg/index.html` | `/svg` route |
| `sw.js` | Service worker |
| `vendor/qrcode.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT) |

## Deploy

GitHub Pages: Settings → Pages → Deploy from branch → `master`, `/ (root)`. The custom domain is `qr.kakkoi.dev` (see `CNAME`).

## Local dev

```sh
python3 -m http.server 8000
```

Service workers need `localhost` or HTTPS.
