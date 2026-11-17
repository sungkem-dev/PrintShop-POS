# Payment rate-limit tests

Tests the read-only status endpoint with a deliberately missing order ID:
`GET /api/payment/status/load-test-missing-order`. It expects the normal
`404` response until rate limited, and does not create or settle payments.

```powershell
k6 run .\load-tests\payment\rate-limit-contract.js
k6 run .\load-tests\payment\rate-limit-load.js
```

Requires the application's database configuration to be available.
