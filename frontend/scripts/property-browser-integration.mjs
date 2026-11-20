import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
const api='http://localhost:8081', app='http://localhost:5189'
const password=randomBytes(20).toString('hex')+'A1!'
const suffix=randomBytes(6).toString('hex')
const users=[0,1].map(i=>({email:`f335-${suffix}-${i}@example.test`,password,firstName:'Test',lastName:'User',organizationName:`F335 ${suffix} ${i}`,organizationSlug:`f335-${suffix}-${i}`}))
for (const user of users) { const response=await fetch(api+'/api/v1/users/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(user)}); if(response.status!==201) throw Error('test-user registration failed: '+response.status) }
const profile = mkdtempSync('/tmp/f335-chrome-')
const chrome=spawn('google-chrome',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--remote-debugging-pipe','--user-data-dir='+profile],{stdio:['ignore','ignore','ignore','pipe','pipe']})
let serial=0,buf='';const pending=new Map();chrome.stdio[4].setEncoding('utf8').on('data',chunk=>{buf+=chunk;let e;while((e=buf.indexOf('\0'))>=0){const m=JSON.parse(buf.slice(0,e));buf=buf.slice(e+1);if(!pending.has(m.id))continue;const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}})
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0')})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ev=async(s,expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value}
const wait=async(s,expression)=>{for(let i=0;i<150;i++){try{if(await ev(s,expression))return}catch{} await sleep(80)}throw Error('timed out: '+expression)}
const navigate=async(s,path)=>{await send('Page.navigate',{url:app+path},s);await wait(s,"document.readyState==='complete' && !!document.querySelector('main')")}
const tab=async()=>{const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},sessionId);return sessionId}
const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label)}
const fill=async(s,user)=>{await ev(s,`(()=>{for(const [id,value] of ${JSON.stringify([['login-email',user.email],['login-password',user.password]])}){const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('form').requestSubmit()})()`)}
const login=async(s,user)=>{await navigate(s,'/login');await fill(s,user);await wait(s,"location.pathname==='/dashboard' && !!document.querySelector('header')")}
try {
 const a=await tab()
 await login(a,users[0]);check(await ev(a,"!!document.querySelector('[aria-label=Organization]')"),'authenticated organization selected')
 await ev(a,"[...document.querySelectorAll('a')].find(x=>x.textContent.trim()==='Properties').click()");await wait(a,"location.pathname==='/properties' && !!document.querySelector('a[href=\"/properties/new\"]')")
 await ev(a,"document.querySelector('a[href=\"/properties/new\"]').click()");await wait(a,"!!document.querySelector('#property-name')")
 await ev(a,`(()=>{for(const [id,value] of ${JSON.stringify([['property-name','Integration property'],['property-address','12 Test Street'],['property-city','Test City'],['property-country','US']])}){const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('form').requestSubmit()})()`)
 await wait(a,"location.pathname.startsWith('/properties/') && !![...document.querySelectorAll('h3')].find(x=>x.textContent==='Integration property')");check(true,'create and view property')
 await ev(a,"[...document.querySelectorAll('a')].find(x=>x.textContent.includes('Edit property')).click()");await wait(a,"!!document.querySelector('#property-name')")
 await ev(a,`(()=>{const el=document.getElementById('property-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Edited integration property');el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit()})()`)
 await wait(a,"!![...document.querySelectorAll('h3')].find(x=>x.textContent==='Edited integration property')");check(true,'edit property')
 await ev(a,"[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Archive property')).click()");await wait(a,"!!document.querySelector('[role=dialog]')");await ev(a,"[...document.querySelector('[role=dialog]').querySelectorAll('button')].find(x=>x.textContent.trim()==='Archive').click()");await wait(a,"document.body.textContent.includes('Status: ARCHIVED')");check(true,'archive property')
}finally{if(chrome.exitCode===null){await Promise.race([send('Browser.close').catch(()=>{}),sleep(2000)]);if(chrome.exitCode===null){chrome.kill();await new Promise(resolve=>chrome.once('exit',resolve))}}await sleep(500);rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:200})}
