const fetch = require('node-fetch');
async function test() {
  const res = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: 'test-thread-' + Date.now(), message: 'Schedule a discovery call' })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
