# Native Creator Earnings Adapter

This package is an account-bound translation layer between native Campaign assignment rows and `@gmvgang/creator-earnings`.

Authority rules:
- the authenticated server boundary supplies the Creator profile id;
- browser-supplied Creator ids are never authoritative;
- recorded commission is reporting data, not a settled, paid, or withdrawable balance;
- payout, wallet, banking, and production mutation logic stay outside this package.
