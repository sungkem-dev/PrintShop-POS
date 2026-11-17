import { createLoadSuite } from '../shared/load.js';

const suite = createLoadSuite({
  feature: 'auth',
  endpoint: '/api/auth/login',
  method: 'POST',
  body: JSON.stringify({
    email: 'rate-limit-test-invalid@example.test',
    pin: '000000'
  }),
  successStatus: 401,
  maxRequests: 60,
  windowSeconds: 60
});

export const options = suite.options;
export default suite.run;
