const { GET } = require('./.next/server/app/api/inngest/route.js');

async function test() {
  const req = new Request('http://localhost:3000/api/inngest', { method: 'GET' });
  const res = await GET(req);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test().catch(console.error);
