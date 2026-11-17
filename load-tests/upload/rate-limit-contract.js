import { createContractSuite } from '../shared/contract.js';

const suite = createContractSuite({
  feature: 'upload',
  endpoint: '/api/upload',
  method: 'POST',
  body: '--RateLimitTestBoundary--\r\n',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=RateLimitTestBoundary'
  },
  successStatus: 400,
  maxRequests: 10,
  windowSeconds: 60
});

export const options = suite.options;
export default suite.run;
