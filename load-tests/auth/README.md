# Auth rate-limit tests

Tests `POST /api/auth/login` using intentionally invalid test credentials. An
ordinary failed login (`401`) is expected until the rate limit is reached.

```powershell
k6 run .\load-tests\auth\rate-limit-contract.js
k6 run .\load-tests\auth\rate-limit-load.js
```

Requires the application's database configuration to be available. The tests
create no accounts.
