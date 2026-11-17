# Orders rate-limit tests

Tests `GET /api/orders` using the shared contract and load-test logic. The
backend limit is 60 requests per minute per IP, separately for each route
group and HTTP method. For example, `GET /api/orders` and
`GET /api/orders/track` have separate quotas.

The contract test sends 60 allowed requests, verifies that the next request is
limited, then waits for the window to expire. Its default run therefore takes
about one minute.

```powershell
k6 run .\load-tests\orders\rate-limit-contract.js
k6 run .\load-tests\orders\rate-limit-load.js
```

Requires the application's database configuration to be available.

The test defaults match the backend. Override `RATE_LIMIT_MAX_REQUESTS` and
`RATE_LIMIT_WINDOW_SECONDS` only when intentionally testing another policy.
