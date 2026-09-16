# TikTok Shop Infrastructure Client

## Status

This package implements the infrastructure boundary required by the Seller Analytics domain adapter. It does not enable a live TikTok connection by itself.

Implemented:

- official TikTok Shop HMAC-SHA256 request signing primitive
- seller connection lookup through the platform connection contract
- secret resolution behind an injected infrastructure port
- `shop_cipher` resolution through authorized shops
- signed Product Performance GET requests
- bounded retry/backoff for transport failures, HTTP 429/5xx and documented transient TikTok error codes
- non-retry behavior for terminal HTTP/API failures
- Node `fetch` transport with request timeout
- shop-cipher caching per connection + shop
- tests for signing, secret boundaries, retries, caching and transport timeout

Still required before production activation:

- provision seller OAuth/app credentials in an approved secret store
- implement/attach production connection and secret resolvers
- verify required app scopes/authorization with a real seller account
- run a read-only sandbox/production smoke test
- add Video Performance mapping and identifier reconciliation
- persist normalized performance measurements with idempotent upsert/reconciliation

No raw access token, refresh token, app secret, secret reference or request signature is written into canonical performance records or UI payloads.
