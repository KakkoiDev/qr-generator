# QR Generator

A static QR code generator for GitHub Pages. It has no build step and no backend.

- **`/`**: type text and the QR code updates on every keystroke. The text is stored in the URL (`?t=...`), so the page can be shared. **Download SVG** saves the current code.
- **`/svg/?t=...`**: shows only the QR code as an SVG image.

## How `/svg` works without a server

GitHub Pages can only serve static files. So a service worker (`sw.js`) catches requests to `svg` and `svg/`. It builds the SVG in the browser and returns a real `image/svg+xml` response. It also saves the result in Cache Storage, so the same URL loads instantly and works offline. You can then use the URL directly, for example `<img src=".../svg/?t=hello">`.

On a first visit, before the service worker is installed, `svg/index.html` draws the same SVG as a page. It then installs the worker and reloads once. After that, the URL returns the raw SVG.

> Because the service worker runs in the browser, the raw-SVG response only happens in a browser that has already visited the site. Tools like `curl` or link-preview bots will get the HTML fallback.

### `/svg` parameters

| Param | Meaning | Default |
|-------|---------|---------|
| `t`   | Text to encode (UTF-8) | `""` |
| `ecc` | Error correction level: `L`, `M`, `Q`, `H` | `M` |
| `fg`  | Foreground hex color, without `#` | `000000` |
| `bg`  | Background hex color, or `transparent` | `ffffff` |
| `m`   | Quiet-zone margin, in modules | `4` |
| `s`   | Width/height in px | `512` |

Example: `svg/?t=hello&fg=1a237e&bg=transparent&ecc=H`

## Deploy

Settings → Pages → Deploy from branch → choose the branch and `/ (root)`.

## Local dev

```sh
python3 -m http.server 8000
```

Service workers need `localhost` or HTTPS.

## Credits

QR encoding: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT), vendored in `vendor/qrcode.js`.
