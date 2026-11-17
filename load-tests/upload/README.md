# Upload rate-limit tests

Tests `POST /api/upload` against the limit of 10 requests per minute per IP.
The test sends an empty multipart form, so an allowed request returns `400`
without uploading a file or writing to storage. Requests over the limit should
return `429`.

```powershell
k6 run .\load-tests\upload\rate-limit-contract.js
k6 run .\load-tests\upload\rate-limit-load.js
```

The contract test waits for the full rate-limit window to verify recovery.
