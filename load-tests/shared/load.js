import { check } from 'k6';
import { Rate } from 'k6/metrics';
import {
  hasRateLimitHeaders,
  hasRetryAfter,
  sendRequest
} from './request.js';

export function createLoadSuite(profile) {
  const requestsPerSecond = positiveInteger('LOAD_RPS', 20);
  const maxRequests = positiveInteger('RATE_LIMIT_MAX_REQUESTS', profile.maxRequests || 5);
  const windowSeconds = positiveInteger('RATE_LIMIT_WINDOW_SECONDS', profile.windowSeconds || 10);
  const successStatus = positiveInteger('RATE_LIMIT_SUCCESS_STATUS', profile.successStatus);
  const duration = __ENV.LOAD_DURATION || '30s';
  const preAllocatedVUs = positiveInteger('LOAD_PRE_ALLOCATED_VUS', 10);
  const maxVUs = positiveInteger('LOAD_MAX_VUS', 100);
  const maxP95Milliseconds = positiveInteger('LOAD_MAX_P95_MS', 1000);
  const unexpectedResponses = new Rate(`${profile.feature}_rate_limit_unexpected_responses`);
  const validResponses = new Rate(`${profile.feature}_rate_limit_valid_responses`);
  const limitedResponses = new Rate(`${profile.feature}_rate_limit_limited_responses`);

  if (maxVUs < preAllocatedVUs) {
    throw new Error('LOAD_MAX_VUS must be greater than or equal to LOAD_PRE_ALLOCATED_VUS');
  }
  if (requestsPerSecond <= maxRequests / windowSeconds) {
    throw new Error('LOAD_RPS must exceed RATE_LIMIT_MAX_REQUESTS / RATE_LIMIT_WINDOW_SECONDS');
  }

  const options = {
    scenarios: {
      above_limit: {
        executor: 'constant-arrival-rate',
        rate: requestsPerSecond,
        timeUnit: '1s',
        duration,
        preAllocatedVUs,
        maxVUs
      }
    },
    thresholds: {
      [`${profile.feature}_rate_limit_unexpected_responses`]: ['rate==0'],
      [`${profile.feature}_rate_limit_valid_responses`]: ['rate>0.99'],
      [`${profile.feature}_rate_limit_limited_responses`]: ['rate>0'],
      http_req_duration: [`p(95)<${maxP95Milliseconds}`]
    }
  };

  function run() {
    const response = sendRequest(profile);
    const isAllowed = response.status === successStatus;
    const isLimited = response.status === 429;
    const hasExpectedStatus = isAllowed || isLimited;
    const hasExpectedHeaders = !isLimited ||
      (hasRateLimitHeaders(response) && hasRetryAfter(response));

    unexpectedResponses.add(!hasExpectedStatus || !hasExpectedHeaders);
    validResponses.add(hasExpectedStatus && hasExpectedHeaders);
    limitedResponses.add(isLimited);

    check(response, {
      [`${profile.feature}: response is allowed or rate limited`]: () => hasExpectedStatus,
      [`${profile.feature}: 429 includes rate-limit headers and Retry-After`]: () => hasExpectedHeaders
    });
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
