/**
 * The page served at the apex root (hopgo.co/). Every other path is a slug
 * lookup. Kept as a single inline HTML string so the worker stays a single
 * bundle with no asset pipeline.
 */
export const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hopgo - edge-served short links</title>
    <meta
      name="description"
      content="Self-hosted URL shortener whose redirects live on Cloudflare's edge. Your host is disposable; your links survive."
    />
    <style>
      :root { color-scheme: light dark; }
      body {
        font: 16px/1.6 system-ui, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
      }
      main { max-width: 36rem; }
      h1 { font-size: 2.5rem; margin: 0 0 0.5rem; }
      p.lead { font-size: 1.15rem; opacity: 0.85; margin: 0 0 1.5rem; }
      ul { padding-left: 1.1rem; margin: 0 0 1.5rem; }
      li { margin: 0.25rem 0; }
      a.btn {
        display: inline-block;
        padding: 0.6rem 1rem;
        border-radius: 8px;
        background: #2563eb;
        color: #fff;
        text-decoration: none;
        font-weight: 600;
      }
      footer { margin-top: 2rem; opacity: 0.6; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Hopgo</h1>
      <p class="lead">Self-hosted, branded short links whose redirects live on Cloudflare's edge.</p>
      <ul>
        <li>Your host is disposable: wipe the container, redeploy, lose zero links.</li>
        <li>No inbound ports: redirects are served by Cloudflare, not your box.</li>
        <li>You own everything: your domain, your Cloudflare account, your data.</li>
      </ul>
      <a class="btn" href="https://github.com/iamclements/hopgo">Get it on GitHub</a>
      <footer>Powered by Hopgo. This domain serves short links; an unknown slug returns a 404.</footer>
    </main>
  </body>
</html>`;
