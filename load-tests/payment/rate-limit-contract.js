import { createContractSuite } from '../shared/contract.js';

const suite = createContractSuite({
  feature: 'payment',
  endpoint: '/api/payment/status/load-test-missing-order',
  method: 'GET',
  successStatus: 404,
  maxRequests: 60,
  windowSeconds: 60
});

export const options = suite.options;
export default suite.run;
