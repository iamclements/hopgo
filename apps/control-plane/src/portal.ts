/**
 * The Hopgo control-plane portal: a single self-contained HTML page served by
 * the same Hono process. No build step, no framework, on purpose. It talks to
 * the REST API on this origin (/api/links) and builds copyable short links from
 * /api/config. Keep it LAN-bound; for remote admin use a Cloudflare Tunnel +
 * Access rather than exposing this port.
 *
 * The client script below deliberately avoids template literals so the whole
 * document can live in one outer template literal.
 */
export const PORTAL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hopgo</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 960px; margin-inline: auto; }
      h1 { margin: 0 0 0.25rem; }
      .sub { opacity: 0.7; margin: 0 0 1.5rem; }
      form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
      input { padding: 0.5rem 0.6rem; border: 1px solid #8884; border-radius: 6px; font: inherit; }
      input[name="url"] { flex: 3 1 320px; }
      input[name="slug"] { flex: 1 1 140px; }
      button { padding: 0.5rem 0.8rem; border: 0; border-radius: 6px; background: #2563eb; color: #fff; font: inherit; cursor: pointer; }
      button.secondary { background: #8883; color: inherit; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 0.5rem 0.4rem; border-bottom: 1px solid #8882; vertical-align: top; }
      th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; }
      td.target { word-break: break-all; max-width: 360px; }
      td.clicks { text-align: right; font-variant-numeric: tabular-nums; }
      a { color: #2563eb; text-decoration: none; }
      .msg { min-height: 1.4rem; margin-bottom: 1rem; }
      .msg.error { color: #dc2626; }
      .empty { opacity: 0.6; padding: 1rem 0; }
    </style>
  </head>
  <body>
    <h1>Hopgo</h1>
    <p class="sub">Edge-served short links. This control plane is disposable; the links live on Cloudflare.</p>

    <form id="create">
      <input name="url" type="url" placeholder="https://example.com/long/url" required />
      <input name="slug" type="text" placeholder="custom-slug (optional)" pattern="[A-Za-z0-9_-]+" />
      <button type="submit">Shorten</button>
    </form>

    <div class="msg" id="msg"></div>

    <table>
      <thead>
        <tr><th>Short link</th><th>Target</th><th>Clicks</th><th>Created</th><th></th></tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>

    <script>
      var base = '';
      var msg = document.getElementById('msg');
      var rows = document.getElementById('rows');

      function setMsg(text, isError) {
        msg.textContent = text || '';
        msg.className = 'msg' + (isError ? ' error' : '');
      }

      function esc(s) {
        return String(s).replace(/[&<>"']/g, function (ch) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
      }

      function shortUrl(slug) {
        return base + '/' + slug;
      }

      function render(links) {
        rows.innerHTML = '';
        if (!links.length) {
          rows.innerHTML = '<tr><td colspan="5" class="empty">No links yet. Create one above.</td></tr>';
          return;
        }
        links.forEach(function (link) {
          var url = shortUrl(link.slug);
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td><a href="' + esc(url) + '" target="_blank" rel="noreferrer">' + esc(link.slug) + '</a></td>' +
            '<td class="target">' + esc(link.url) + '</td>' +
            '<td class="clicks">' + (link.clicks || 0) + '</td>' +
            '<td>' + esc((link.createdAt || '').slice(0, 10)) + '</td>' +
            '<td><button class="secondary copy">Copy</button> <button class="secondary del">Delete</button></td>';
          tr.querySelector('.copy').addEventListener('click', function () {
            navigator.clipboard.writeText(url).then(function () { setMsg('Copied ' + url); });
          });
          tr.querySelector('.del').addEventListener('click', function () {
            if (!confirm('Delete ' + url + '?')) return;
            del(link.slug);
          });
          rows.appendChild(tr);
        });
      }

      function load() {
        fetch('/api/links?withClicks=1')
          .then(function (r) { return r.json(); })
          .then(function (data) { render(data.links || []); })
          .catch(function () { setMsg('Failed to load links', true); });
      }

      function del(slug) {
        fetch('/api/links/' + encodeURIComponent(slug), { method: 'DELETE' })
          .then(function (r) {
            if (!r.ok) throw new Error();
            setMsg('Deleted ' + slug);
            load();
          })
          .catch(function () { setMsg('Failed to delete ' + slug, true); });
      }

      document.getElementById('create').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        var payload = { url: form.url.value };
        if (form.slug.value) payload.slug = form.slug.value;
        fetch('/api/links', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
          .then(function (res) {
            if (!res.ok) { setMsg(res.body.error || 'Failed to create link', true); return; }
            form.reset();
            setMsg('Created ' + shortUrl(res.body.slug));
            load();
          })
          .catch(function () { setMsg('Failed to create link', true); });
      });

      fetch('/api/config')
        .then(function (r) { return r.json(); })
        .then(function (cfg) { base = cfg.publicBaseUrl || ''; load(); })
        .catch(function () { load(); });
    </script>
  </body>
</html>`;
