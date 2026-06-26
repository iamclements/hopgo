# Hopgo marketing site

The public site at [hopgo.co](https://hopgo.co). Plain static HTML/CSS, no build step, no
framework. Everything served as-is from `public/`.

## Structure

```
public/
  index.html        Landing page
  styles.css        All styles (design tokens + components)
  privacy/          /privacy
  security/         /security
  404.html          Custom not-found page
  assets/           Logos, favicons, Web Store icon
  assets/og-image.html   Source for the 1200x630 Open Graph image
  CNAME             Custom domain (hopgo.co)
  robots.txt, sitemap.xml
```

## Preview locally

No tooling required, just serve the folder:

```sh
python3 -m http.server -d apps/site/public 8080
# then open http://localhost:8080
```

## Open Graph image

`og:image` points at `/assets/og-image.png`. That PNG is rendered from
`assets/og-image.html` automatically in the Pages deploy workflow
(`.github/workflows/pages.yml`) using headless Chrome, so it always stays in sync with the design.

To regenerate it by hand (requires Chrome):

```sh
"/path/to/chrome" --headless --screenshot=apps/site/public/assets/og-image.png \
  --window-size=1200,630 --force-device-scale-factor=1 --virtual-time-budget=4000 \
  "file://$PWD/apps/site/public/assets/og-image.html"
```

## Deploy

Pushing to `main` with changes under `apps/site/**` triggers
`.github/workflows/pages.yml`, which renders the OG image and publishes `public/` to GitHub Pages.
GitHub Pages must be set to "GitHub Actions" as its source, and the `hopgo.co` custom domain
configured in the repo's Pages settings (DNS: a `CNAME`/`ALIAS` from `hopgo.co` to the Pages host).
