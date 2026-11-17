import { createLoadSuite } from '../shared/load.js';

const suite = createLoadSuite({
  feature: 'orders',
  endpoint: '/api/orders',
  method: 'GET',
  successStatus: 200,
  maxRequests: 60,
  windowSeconds: 60
});

export const options = suite.options;
export default suite.run;
