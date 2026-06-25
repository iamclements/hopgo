// Binding types for the Hopgo Worker. Equivalent to `wrangler types` output, kept
// in sync by hand because the binding set is tiny. Add new bindings here and in
// wrangler.jsonc together.
declare namespace Cloudflare {
  interface Env {
    /** KV namespace mapping `slug -> StoredLink` and `clicks:<slug> -> count`. */
    LINKS: KVNamespace;
  }
}

type Env = Cloudflare.Env;
