# Editra CDN Migration

Editra's first-party CDN hostname is `cdn.editra.in`. Keep the existing npm and
GitHub-backed jsDelivr URLs available until the first-party endpoint passes the
checks below.

## DNS and provider setup

1. Create `cdn.editra.in` as a CNAME to the hostname assigned by the selected
   CDN provider (Cloudflare, AWS CloudFront, Vercel, or an equivalent service).
2. Attach and validate a TLS certificate for `cdn.editra.in`, force HTTPS, and
   restrict the origin so releases cannot be modified through the public CDN.
3. Configure the release pipeline for `https://github.com/editra-js/Editra` to
   upload only tagged, tested builds.

## URL layout

Publish assets below an immutable semantic-version directory:

```text
https://cdn.editra.in/v1.1.1/dist/editra.min.js
https://cdn.editra.in/v1.1.1/themes/word.min.css
```

Applications should pin a full version. A mutable alias such as `/latest/` may
be offered for demos, but it should not be recommended for production.

## Caching and integrity

- Versioned assets: `Cache-Control: public, max-age=31536000, immutable`.
- Mutable aliases: short cache lifetime with revalidation.
- Publish source maps and Subresource Integrity hashes with each tagged build.
- Enable compression and preserve correct JavaScript, CSS, JSON, font, and
  image content types.
- Purge only mutable aliases during a release; versioned paths remain immutable.

## Rollout verification

Before changing documentation examples to the first-party CDN:

1. Confirm DNS and TLS from more than one region.
2. Compare CDN asset checksums with the corresponding GitHub release artifacts.
3. Load the Word and Classic examples with CDN-only assets in supported browsers.
4. Verify CORS, compression, content types, cache headers, and 404 behavior.
5. Update examples to `cdn.editra.in`, retain a documented jsDelivr fallback,
   and monitor error rates during the rollout.
