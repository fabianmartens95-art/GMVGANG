# TikTok Shop Infrastructure

Infrastructure-only implementation for authenticated TikTok Shop API calls.

## Boundary

- Resolves seller connections and secret references only inside infrastructure.
- Signs requests with the TikTok Shop HMAC-SHA256 algorithm.
- Resolves `shop_cipher` through the authorized-shops endpoint.
- Performs bounded retry/backoff only for read-only transient failures.
- Exposes provider response data to domain adapters, never raw app secrets, access tokens, refresh tokens or secret references.
- Does not persist credentials.
- Does not activate any production TikTok connection by itself.

The current Seller Analytics client supports the authorized Product Performance page boundary. Production activation still requires separately provisioned seller OAuth credentials/secrets and explicit runtime configuration.
