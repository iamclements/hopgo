/**
 * The page served at the apex root. Every other path is a slug lookup.
 * Kept as a single inline HTML string so the worker stays a single bundle
 * with no asset pipeline. Intentionally unbranded: this runs on the user's
 * own domain.
 */
export const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Short links</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        font: 16px/1.6 system-ui, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        color: #374151;
      }
      @media (prefers-color-scheme: dark) { body { color: #d1d5db; } }
      main { max-width: 28rem; text-align: center; }
      p { margin: 0; opacity: 0.7; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <p>This domain serves short links. Follow a short link to be redirected.</p>
    </main>
  </body>
</html>`;
