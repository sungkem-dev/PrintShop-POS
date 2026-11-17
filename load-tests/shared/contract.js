import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import {
  hasRateLimitHeaders,
  hasRetryAfter,
  rateLimitLimit,
  responseHeader,
  sendRequest
} from './request.js';

export function createContractSuite(profile) {
  const maxRequests = positiveInteger('RATE_LIMIT_MAX_REQUESTS', profile.maxRequests || 5);
  const windowSeconds = positiveInteger('RATE_LIMIT_WINDOW_SECONDS', profile.windowSeconds || 10);
  const overLimitRequests = positiveInteger('RATE_LIMIT_OVERAGE', 2);
  const successStatus = positiveInteger('RATE_LIMIT_SUCCESS_STATUS', profile.successStatus);
  const assertions = new Rate(`${profile.feature}_rate_limit_contract_assertions`);

  const options = {
    scenarios: {
      contract: {
        executor: 'per-vu-iterations',
        vus: 1,
        iterations: 1,
        maxDuration: `${windowSeconds * 2 + 30}s`
      }
    },
    thresholds: {
      [`${profile.feature}_rate_limit_contract_assertions`]: ['rate==1']
    }
  };

  function run() {
    let lastAllowedResponse;

    for (let requestNumber = 1; requestNumber <= maxRequests; requestNumber += 1) {
      lastAllowedResponse = sendRequest(profile);
      assert(
        `request ${requestNumber} is allowed`,
        lastAllowedResponse,
        (response) => response.status === successStatus
      );
    }

    assert(
      'allowed responses include standard rate-limit headers',
      lastAllowedResponse,
      hasRateLimitHeaders
    );
    assert(
      'reported limit matches the configured quota',
      lastAllowedResponse,
      (response) => rateLimitLimit(response) === maxRequests
    );
    assert(
      'remaining quota is zero at the configured limit',
      lastAllowedResponse,
      (response) => Number(responseHeader(response, 'RateLimit-Remaining')) === 0
    );

    for (let requestNumber = 1; requestNumber <= overLimitRequests; requestNumber += 1) {
      const response = sendRequest(profile);
      assert(
        `over-limit request ${requestNumber} returns 429`,
        response,
        (result) => result.status === 429
      );
      assert(
        `429 response ${requestNumber} includes rate-limit headers`,
        response,
        hasRateLimitHeaders
      );
      assert(
        `429 response ${requestNumber} has no remaining quota`,
        response,
        (result) => Number(responseHeader(result, 'RateLimit-Remaining')) === 0
      );
      assert(
        `429 response ${requestNumber} includes Retry-After`,
        response,
        hasRetryAfter
      );
    }

    sleep(windowSeconds + 1);
    const recoveredResponse = sendRequest(profile);
    assert(
      'request is allowed after the rate-limit window resets',
      recoveredResponse,
      (response) => response.status === successStatus
    );
    assert(
      'quota is replenished after the window resets',
      recoveredResponse,
      (response) => Number(responseHeader(response, 'RateLimit-Remaining')) > 0
    );
  }

  function assert(name, response, predicate) {
    assertions.add(check(response, { [`${profile.feature}: ${name}`]: predicate }));
  }

  return { options, run };
}

function positiveInteger(name, defaultValue) {
  const value = Number(__ENV[name] || defaultValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}
