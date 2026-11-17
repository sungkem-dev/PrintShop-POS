import { createContractSuite } from '../shared/contract.js';

const suite = createContractSuite({
  feature: 'orders',
  endpoint: '/api/orders',
  method: 'GET',
  successStatus: 200,
  maxRequests: 60,
  windowSeconds: 60
});

export const options = suite.options;
export default suite.run;
