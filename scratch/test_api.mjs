async function runTests() {
  console.log('--- Testing /api/auth/login ---');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@printshop.com', pin: '123456' })
  });
  console.log('Login:', await loginRes.json());

  console.log('--- Testing /api/orders/track?code=ORD-042 ---');
  const trackRes = await fetch('http://localhost:3000/api/orders/track?code=ORD-042');
  console.log('Track ORD-042:', await trackRes.json());

  console.log('--- Testing /api/payment/status/a1b2c3d4-0003-4000-8000-000000000003 (Settle payment) ---');
  const settleRes = await fetch('http://localhost:3000/api/payment/status/a1b2c3d4-0003-4000-8000-000000000003', {
    method: 'POST'
  });
  console.log('Settle:', await settleRes.json());
}

runTests().catch(console.error);
