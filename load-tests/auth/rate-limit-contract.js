import { createContractSuite } from '../shared/contract.js';

const suite = createContractSuite({
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
