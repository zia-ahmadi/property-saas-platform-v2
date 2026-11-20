import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
const api = process.env.F5_API_URL || 'http://localhost:8085',
  app = process.env.F5_APP_URL || 'http://localhost:5190'
const password = randomBytes(20).toString('hex') + 'A1!'
const suffix = randomBytes(6).toString('hex')
const users = [0, 1].map((i) => ({
  email: `f5-${suffix}-${i}@example.test`,
  password,
  firstName: 'Test',
  lastName: 'User',
  organizationName: `F5 ${suffix} ${i}`,
  organizationSlug: `f5-${suffix}-${i}`,
}))
for (const user of users) {
  const response = await fetch(api + '/api/v1/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  })
  if (response.status !== 201) throw Error('test-user registration failed: ' + response.status)
}
const profile = mkdtempSync('/tmp/f5-chrome-')
const chrome = spawn(
  'google-chrome',
  [
    '--headless',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--no-first-run',
    '--remote-debugging-pipe',
    '--user-data-dir=' + profile,
  ],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
)
let serial = 0,
  buf = ''
const pending = new Map()
chrome.stdio[4].setEncoding('utf8').on('data', (chunk) => {
  buf += chunk
  let e
  while ((e = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, e))
    buf = buf.slice(e + 1)
    if (!pending.has(m.id)) continue
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result)
  }
})
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++serial
    pending.set(id, { resolve, reject })
    chrome.stdio[3].write(
      JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0',
    )
  })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (s, expression) => {
  const r = await send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    s,
  )
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text)
  return r.result.value
}
const wait = async (s, expression) => {
  for (let i = 0; i < 150; i++) {
    try {
      if (await ev(s, expression)) return
    } catch {}
    await sleep(80)
  }
  throw Error(
    'timed out: ' +
      expression +
      '; page=' +
      (await ev(s, "location.pathname+' '+document.querySelector('main')?.textContent")),
  )
}
const navigate = async (s, path) => {
  await send('Page.navigate', { url: app + path }, s)
  await wait(s, "document.readyState==='complete' && !!document.querySelector('main')")
}
const visit = async (s, path) =>
  ev(
    s,
    `(()=>{history.pushState(null,'',${JSON.stringify(path)});window.dispatchEvent(new PopStateEvent('popstate'))})()`,
  )
const tab = async () => {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  return sessionId
}
const check = (ok, label) => {
  if (!ok) throw Error('FAIL ' + label)
  console.log('PASS ' + label)
}
const fill = async (s, user) => {
  await ev(
    s,
    `(()=>{for(const [id,value] of ${JSON.stringify([
      ['login-email', user.email],
      ['login-password', user.password],
    ])}){const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('form').requestSubmit()})()`,
  )
}
const login = async (s, user) => {
  await navigate(s, '/login')
  await fill(s, user)
  await wait(s, "location.pathname==='/dashboard' && !!document.querySelector('header')")
}
try {
  const a = await tab()
  await login(a, users[0])
  check(
    await ev(a, "!!document.querySelector('[aria-label=Organization]')"),
    'authenticated organization selected',
  )
  await ev(
    a,
    "[...document.querySelectorAll('a')].find(x=>x.textContent.trim()==='Properties').click()",
  )
  await wait(
    a,
    "location.pathname==='/properties' && !!document.querySelector('a[href=\"/properties/new\"]')",
  )
  await ev(a, 'document.querySelector(\'a[href="/properties/new"]\').click()')
  await wait(a, "!!document.querySelector('#property-name')")
  await ev(
    a,
    `(()=>{for(const [id,value] of ${JSON.stringify([
      ['property-name', 'Integration property'],
      ['property-address', '12 Test Street'],
      ['property-city', 'Test City'],
      ['property-country', 'US'],
    ])}){const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('form').requestSubmit()})()`,
  )
  await wait(
    a,
    "location.pathname.startsWith('/properties/') && !![...document.querySelectorAll('h3')].find(x=>x.textContent==='Integration property')",
  )
  check(true, 'create and view property')
  await ev(
    a,
    "[...document.querySelectorAll('a')].find(x=>x.textContent.includes('Edit property')).click()",
  )
  await wait(a, "!!document.querySelector('#property-name')")
  await ev(
    a,
    `(()=>{const el=document.getElementById('property-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Edited integration property');el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit()})()`,
  )
  await wait(
    a,
    "!![...document.querySelectorAll('h3')].find(x=>x.textContent==='Edited integration property')",
  )
  check(true, 'edit property')
  const propertyPath = await ev(a, 'location.pathname')
  await ev(a, "[...document.querySelectorAll('a')].find(x=>x.textContent==='Manage Units').click()")
  await wait(a, "!![...document.querySelectorAll('a')].find(x=>x.textContent==='Create unit')")
  await ev(a, "[...document.querySelectorAll('a')].find(x=>x.textContent==='Create unit').click()")
  await wait(a, "!!document.querySelector('#unit-number')")
  const setUnit = async (value) =>
    ev(
      a,
      `(()=>{const el=document.getElementById('unit-number');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit()})()`,
    )
  await setUnit('F5-101')
  await wait(a, "!![...document.querySelectorAll('h3')].find(x=>x.textContent==='F5-101')")
  check(
    await ev(a, "document.body.textContent.includes('Availability: AVAILABLE')"),
    'create unit and view backend availability',
  )
  const unitPath = await ev(a, 'location.pathname')
  await ev(a, "[...document.querySelectorAll('a')].find(x=>x.textContent==='Edit unit').click()")
  await wait(a, "document.querySelector('#unit-number')?.value==='F5-101'")
  await setUnit('F5-102')
  await wait(a, "!![...document.querySelectorAll('h3')].find(x=>x.textContent==='F5-102')")
  check(true, 'edit unit')
  for (const status of ['UNAVAILABLE', 'AVAILABLE']) {
    await ev(
      a,
      `[...document.querySelectorAll('button')].find(x=>x.textContent==='Mark ${status}').click()`,
    )
    await wait(a, "!!document.querySelector('[role=dialog]')")
    await ev(
      a,
      "[...document.querySelector('[role=dialog]').querySelectorAll('button')].find(x=>x.textContent==='Change availability').click()",
    )
    await wait(
      a,
      `document.body.textContent.includes('Availability: ${status}') && !document.querySelector('[role=dialog]')`,
    )
    check(true, 'availability transition to ' + status)
  }
  check(
    await ev(
      a,
      "![...document.querySelectorAll('button,option')].some(x=>x.textContent==='Mark OCCUPIED'||x.value==='OCCUPIED')",
    ),
    'no manual OCCUPIED action',
  )
  await ev(
    a,
    "[...document.querySelectorAll('a')].find(x=>x.textContent==='Back to units').click()",
  )
  await wait(a, "!![...document.querySelectorAll('a')].find(x=>x.textContent==='F5-102')")
  check(
    await ev(a, "document.body.textContent.includes('Availability: AVAILABLE')"),
    'updated list availability',
  )
  await ev(
    a,
    "[...document.querySelectorAll('a')].find(x=>x.textContent==='Back to property').click()",
  )
  await wait(
    a,
    "!![...document.querySelectorAll('button')].find(x=>x.textContent==='Archive property')",
  )
  await ev(
    a,
    "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Archive property')).click()",
  )
  await wait(a, "!!document.querySelector('[role=dialog]')")
  await ev(
    a,
    "[...document.querySelector('[role=dialog]').querySelectorAll('button')].find(x=>x.textContent.trim()==='Archive').click()",
  )
  await wait(a, "document.body.textContent.includes('Status: ARCHIVED')")
  check(true, 'archive property')
  await visit(a, unitPath)
  await wait(
    a,
    "document.body.textContent.includes('This property is archived') && document.body.textContent.includes('F5-102')",
  )
  check(
    await ev(
      a,
      "![...document.querySelectorAll('a,button')].some(x=>x.textContent==='Edit unit'||x.textContent.startsWith('Mark '))",
    ),
    'archived unit readable without mutation controls',
  )
  await visit(a, propertyPath + '/units/new')
  await wait(a, "document.body.textContent.includes('This property is archived')")
  check(await ev(a, "!document.querySelector('#unit-number')"), 'archived unit creation blocked')
  await login(a, users[1])
  await visit(a, unitPath)
  await wait(a, "document.body.textContent.includes('not found')")
  check(
    await ev(a, "!document.body.textContent.includes('F5-102')"),
    'cross-tenant unit URL does not expose unit data',
  )
} finally {
  if (chrome.exitCode === null) {
    await Promise.race([send('Browser.close').catch(() => {}), sleep(2000)])
    if (chrome.exitCode === null) {
      chrome.kill()
      await new Promise((resolve) => chrome.once('exit', resolve))
    }
  }
  await sleep(500)
  rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
}
