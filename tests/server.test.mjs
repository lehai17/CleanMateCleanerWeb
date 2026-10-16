import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {once} from 'node:events';import {createServer} from '../server.mjs';
test('proxy allows cleaner APIs only and never exposes repository or server files',async()=>{
  const upstream=http.createServer((req,res)=>{assert.equal(req.headers.authorization,'Bearer test');res.writeHead(403,{'Content-Type':'application/json'}).end('{"message":"denied"}');});upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const server=createServer({apiUrl:`http://127.0.0.1:${upstream.address().port}`});server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(url)).status,200);
    for(const path of ['/.git/config','/.env','/server.mjs','/api/management/staff','/api/bookings','/src/../package.json'])assert.equal((await fetch(url+path)).status,404);
    for(const path of ['/api/cleaner/jobs/mine','/api/profile/','/api/notifications']){const result=await fetch(url+path,{headers:{Authorization:'Bearer test'}});assert.equal(result.status,403);assert.equal((await result.json()).message,'denied');}
  }finally{server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>upstream.close(done))]);}
});
