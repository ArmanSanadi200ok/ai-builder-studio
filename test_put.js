const http = require('http');
const req = http.request('http://localhost:3000/api/inngest', { method: 'PUT' }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, '\nBody:', data));
});
req.end();
