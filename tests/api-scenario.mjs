// Comprehensive API + socket scenario test for Career Code server.
// API scenario test (653 checks). See tests/README.md for how to run it.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');

const ORIGIN = process.env.QA_ORIGIN || 'http://localhost:3302';
const BASE = `${ORIGIN}/api`;
const SA_EMAIL = process.env.SA_EMAIL || 'sa@qa.test';
const SA_PASSWORD = process.env.SA_PASSWORD || '';
const RUN = Date.now().toString(36);
const PW = 'Passw0rd!qa';
// fresh client IP per run (server trusts one proxy hop) so the in-memory 3/day review limit starts clean
const RIP = { headers: { 'x-forwarded-for': `10.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` } };

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];
let section = '';
function sec(name) { section = name; console.log(`\n=== ${name} ===`); }
function check(name, cond, detail) {
  if (cond) { passed++; }
  else {
    failures.push({ section, name, detail });
    console.log(`  FAIL: ${name}${detail !== undefined ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) : ''}`);
  }
  return cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = () => sleep(350);

class Client {
  constructor(name) { this.name = name; this.cookie = ''; this.events = []; this.socket = null; this.profile = null; }
  async req(method, path, body, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (this.cookie) headers.cookie = this.cookie;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = typeof body === 'string' ? body : JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload });
    const sc = res.headers.getSetCookie?.() || [];
    for (const c of sc) {
      const m = c.match(/^cc_session=([^;]*)/);
      if (m) this.cookie = m[1] ? `cc_session=${m[1]}` : '';
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (opts.raw) data = Buffer.from(await res.arrayBuffer());
    else if (ct.includes('json')) data = await res.json();
    else data = await res.text();
    return { status: res.status, body: data, headers: res.headers };
  }
  get(p, o) { return this.req('GET', p, undefined, o); }
  post(p, b, o) { return this.req('POST', p, b ?? {}, o); }
  put(p, b, o) { return this.req('PUT', p, b ?? {}, o); }
  patch(p, b, o) { return this.req('PATCH', p, b ?? {}, o); }
  del(p, o) { return this.req('DELETE', p, undefined, o); }
  get uid() { return this.profile?.uid; }
  connect() {
    return new Promise((resolve) => {
      this.events = [];
      const s = io(ORIGIN, { path: '/socket.io', transports: ['websocket'], extraHeaders: { cookie: this.cookie }, reconnection: false, forceNew: true });
      this.socket = s;
      s.onAny((ev, payload) => this.events.push({ ev, payload }));
      s.on('connect', () => resolve(true));
      s.on('connect_error', (e) => { this.connectError = e.message; resolve(false); });
      s.on('disconnect', (reason) => this.events.push({ ev: '__disconnect', payload: reason }));
    });
  }
  join(queryId) {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve('not-connected');
      this.socket.emit('query:join', queryId, (ok) => resolve(ok));
      setTimeout(() => resolve('timeout'), 2000);
    });
  }
  mark() { return this.events.length; }
}

const anon = new Client('anon');
async function login(c, email, password = PW) {
  const r = await c.post('/auth/login', { email, password });
  if (r.status === 200) c.profile = r.body.profile;
  return r;
}

// Socket snapshot helpers
let clients = [];
async function snapS() { await settle(); return snap(); }
function snap() { return new Map(clients.map((c) => [c, c.mark()])); }
function got(s, c, ev, pred = () => true) {
  return c.events.slice(s.get(c) ?? 0).some((e) => e.ev === ev && pred(e.payload));
}
function expectSock(s, label, ev, pred, yes, no) {
  for (const c of yes) check(`${label}: ${c.name} receives ${ev}`, got(s, c, ev, pred));
  for (const c of no) check(`${label}: ${c.name} does NOT receive ${ev}`, !got(s, c, ev, pred));
}
const forQ = (id) => (p) => p && (p.id === id || p.queryId === id);

async function notifs(c, queryId, type) {
  const r = await c.get('/notifications?limit=500');
  return (r.body || []).filter((n) => (!queryId || n.queryId === queryId) && (!type || n.type === type));
}
function expectStatus(r, code, name) {
  return check(`${name} -> ${code}`, r.status === code, { got: r.status, body: r.body });
}

// tiny 1x1 png
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function upload(c, files) {
  const fd = new FormData();
  for (const f of files) fd.append(f.field || 'files', new Blob([f.data], { type: f.type }), f.name);
  return c.req('POST', '/uploads', fd);
}

// ---------------------------------------------------------------------------
async function main() {
  // ===================================================================== 0
  sec('0. Health, 404, logged-out access');
  expectStatus(await anon.get('/health'), 200, 'GET /health');
  const nf = await anon.get('/nope');
  check('unknown /api route is JSON 404', nf.status === 404 && nf.body?.error, nf);
  const loggedOutProtected = [
    ['GET', '/users/x'], ['PATCH', '/users/me'], ['GET', '/admins'], ['GET', '/admin/students'], ['GET', '/admin/users'],
    ['GET', '/admin/stats/replies-24h'], ['PATCH', '/admin/users/x/status'], ['POST', '/admin/admins'], ['PATCH', '/admin/admins/x'],
    ['PUT', '/admin/users/x/password'], ['DELETE', '/admin/admins/x'], ['POST', '/admin/categories'], ['PUT', '/admin/categories/x'],
    ['DELETE', '/admin/categories/x'], ['GET', '/queries'], ['GET', '/queries/x'], ['GET', '/queries-meta/experts'],
    ['GET', '/queries-meta/unassigned'], ['POST', '/queries'], ['GET', '/queries/x/messages'], ['POST', '/queries/x/messages'],
    ['POST', '/queries/x/follow-up'], ['PATCH', '/queries/x/status'], ['POST', '/queries/x/reopen'], ['POST', '/queries/x/rating'],
    ['POST', '/queries/x/read'], ['POST', '/queries/x/hide'], ['POST', '/queries/x/reassign'], ['GET', '/queries/x/coffee-treat'],
    ['POST', '/uploads'], ['GET', '/notifications'], ['PATCH', '/notifications/x/read'], ['POST', '/notifications/read-all'],
    ['POST', '/notifications/read-by-query'], ['GET', '/saved-answers'], ['POST', '/saved-answers'], ['DELETE', '/saved-answers/x'],
    ['POST', '/articles'], ['PATCH', '/articles/x'], ['DELETE', '/articles/x'], ['POST', '/articles/x/like'], ['GET', '/saved-articles'],
    ['PUT', '/saved-articles/x'], ['DELETE', '/saved-articles/x'], ['GET', '/admin/platform-reviews'], ['PATCH', '/admin/platform-reviews/x'],
    ['GET', '/coffee-treats/config'], ['POST', '/coffee-treats'], ['GET', '/admin/coffee-treats'], ['GET', '/admin/audit-logs'],
    ['GET', '/drive/config'], ['POST', '/drive/config'], ['GET', '/drive/folder-contents'], ['GET', '/drive/file-stream'],
    ['POST', '/auth/change-password'],
  ];
  for (const [m, p] of loggedOutProtected) {
    const r = await anon.req(m, p, m === 'GET' || m === 'DELETE' ? undefined : {});
    check(`logged-out ${m} ${p} -> 401`, r.status === 401, { got: r.status, body: r.body });
  }
  const me0 = await anon.get('/auth/me');
  check('GET /auth/me logged out -> profile null', me0.status === 200 && me0.body.profile === null, me0);
  expectStatus(await anon.post('/auth/logout'), 200, 'logout while logged out');

  // ===================================================================== 1
  sec('1. Auth: register / login / logout / change-password');
  const S1 = new Client('S1'), S2 = new Client('S2');
  const regBase = { phone: '03001234567', qualification: 'FSc', board: 'Lahore' };
  expectStatus(await anon.post('/auth/register', { ...regBase, fullName: 'X', email: `x${RUN}@qa.test`, password: PW }), 400, 'register name too short');
  expectStatus(await anon.post('/auth/register', { ...regBase, fullName: 'Valid Name', email: 'not-an-email', password: PW }), 400, 'register bad email');
  expectStatus(await anon.post('/auth/register', { ...regBase, fullName: 'Valid Name', email: `y${RUN}@qa.test`, password: 'short7!' }), 400, 'register 7-char password');
  expectStatus(await anon.post('/auth/register', { fullName: 'Valid Name', email: `z${RUN}@qa.test`, password: PW, qualification: 'FSc' }), 400, 'register missing phone');
  expectStatus(await anon.post('/auth/register', { ...regBase, fullName: 'Valid Name', email: `z${RUN}@qa.test`, password: 'p'.repeat(201) }), 400, 'register 201-char password');
  const r1 = await S1.post('/auth/register', { ...regBase, fullName: 'Student One Ünïcødé 学生', email: `s1_${RUN}@QA.test`, password: PW, role: 'super_admin' });
  expectStatus(r1, 201, 'register S1');
  S1.profile = r1.body.profile;
  check('register ignores role -> student', S1.profile?.role === 'student', S1.profile);
  check('register lowercases email', S1.profile?.email === `s1_${RUN}@qa.test`, S1.profile?.email);
  check('register keeps unicode name', S1.profile?.displayName === 'Student One Ünïcødé 学生');
  check('register sets cookie', Boolean(S1.cookie));
  expectStatus(await anon.post('/auth/register', { ...regBase, fullName: 'Dup', email: `S1_${RUN}@qa.TEST`, password: PW }), 409, 'register duplicate email (case-insensitive)');
  const r2 = await S2.post('/auth/register', { ...regBase, fullName: 'Student Two', email: `s2_${RUN}@qa.test`, password: PW });
  expectStatus(r2, 201, 'register S2'); S2.profile = r2.body.profile;
  const meS1 = await S1.get('/auth/me');
  check('GET /auth/me returns own profile with mustChangePassword', meS1.body.profile?.uid === S1.uid && meS1.body.profile.mustChangePassword === false, meS1.body);
  expectStatus(await anon.post('/auth/login', { email: `s1_${RUN}@qa.test`, password: 'wrongpass1' }), 401, 'login wrong password');
  expectStatus(await anon.post('/auth/login', { email: 'nobody@qa.test', password: 'wrongpass1' }), 401, 'login unknown email');
  expectStatus(await anon.post('/auth/login', { email: 'bad' }), 400, 'login validation');
  // Second session for S1, change password in session A, B should be signed out
  const S1b = new Client('S1b');
  expectStatus(await login(S1b, `S1_${RUN}@qa.test`), 200, 'login S1 (case-insensitive email), second session');
  expectStatus(await S1.post('/auth/change-password', { currentPassword: 'wrong', newPassword: 'NewPassw0rd!' }), 400, 'change-password wrong current');
  expectStatus(await S1.post('/auth/change-password', { currentPassword: PW, newPassword: 'short' }), 400, 'change-password new too short');
  expectStatus(await S1.post('/auth/change-password', { currentPassword: PW, newPassword: 'NewPassw0rd!' }), 200, 'change-password ok');
  check('change-password keeps current session', (await S1.get('/auth/me')).body.profile?.uid === S1.uid);
  check('change-password signs out other sessions', (await S1b.get('/auth/me')).body.profile === null);
  expectStatus(await S1.post('/auth/change-password', { currentPassword: 'NewPassw0rd!', newPassword: PW }), 200, 'change-password back');
  const lo = await S1b.post('/auth/logout');
  // logout & re-login
  const S1c = new Client('S1c'); await login(S1c, `s1_${RUN}@qa.test`);
  expectStatus(await S1c.post('/auth/logout'), 200, 'logout');
  check('after logout session invalid', (await S1c.get('/auth/me')).body.profile === null);

  // ===================================================================== 2
  sec('2. Admin accounts');
  const SA = new Client('SA');
  expectStatus(await login(SA, SA_EMAIL, SA_PASSWORD), 200, 'login SA');
  check('SA mustChangePassword true after create-admin', SA.profile?.mustChangePassword === true);
  async function mkAdmin(actor, key, role, extra = {}) {
    return actor.post('/admin/admins', { email: `${key}_${RUN}@qa.test`, password: PW, displayName: `QA ${key.toUpperCase()}`, role, ...extra });
  }
  const EA = new Client('EA'), NA1 = new Client('NA1'), NA2 = new Client('NA2'), NA3 = new Client('NA3');
  const cEA = await mkAdmin(SA, 'ea', 'expert_admin');
  expectStatus(cEA, 201, 'SA creates expert_admin');
  check('created admin mustChangePassword (via staff profile no flag) ', cEA.body.profile?.role === 'expert_admin');
  expectStatus(await mkAdmin(SA, 'na1', 'normal_admin'), 201, 'SA creates NA1');
  expectStatus(await mkAdmin(SA, 'na2', 'normal_admin'), 201, 'SA creates NA2');
  await login(EA, `ea_${RUN}@qa.test`);
  check('new admin login mustChangePassword', EA.profile?.mustChangePassword === true, EA.profile);
  const cNA3 = await mkAdmin(EA, 'na3', 'normal_admin', { assignedCategories: ['does-not-exist'] });
  expectStatus(cNA3, 201, 'EA creates normal_admin');
  check('create admin with unknown category id: response matches stored assignments', JSON.stringify(cNA3.body.profile?.assignedCategories) === JSON.stringify([]), cNA3.body.profile?.assignedCategories);
  expectStatus(await mkAdmin(EA, 'ea2', 'expert_admin'), 403, 'EA cannot create expert_admin');
  expectStatus(await mkAdmin(EA, 'sa2', 'super_admin'), 403, 'EA cannot create super_admin');
  await login(NA1, `na1_${RUN}@qa.test`); await login(NA2, `na2_${RUN}@qa.test`); await login(NA3, `na3_${RUN}@qa.test`);
  expectStatus(await mkAdmin(NA1, 'nax', 'normal_admin'), 403, 'normal admin cannot create admins');
  expectStatus(await mkAdmin(S1, 'nay', 'normal_admin'), 403, 'student cannot create admins');
  expectStatus(await mkAdmin(SA, 'na1', 'normal_admin'), 409, 'duplicate admin email');
  expectStatus(await SA.post('/admin/admins', { email: `bad_${RUN}@qa.test`, password: 'short', displayName: 'Bad', role: 'normal_admin' }), 400, 'admin short password');
  expectStatus(await SA.post('/admin/admins', { email: `bad_${RUN}@qa.test`, password: PW, displayName: 'Bad', role: 'student' }), 400, 'admin role student rejected');
  expectStatus(await SA.post('/admin/admins', { password: PW, displayName: 'Bad', role: 'normal_admin' }), 400, 'admin missing email');

  // ===================================================================== 3
  sec('3. Categories');
  const catsAnon = await anon.get('/categories');
  check('GET /categories logged out: only active', catsAnon.status === 200 && catsAnon.body.every((c) => c.status === 'active') && catsAnon.body.length >= 23, catsAnon.body?.length);
  const cA = await SA.post('/admin/categories', { name: `QA Alpha ${RUN}`, description: 'alpha' });
  expectStatus(cA, 201, 'create catA (no admins)');
  const catA = cA.body.id;
  check('catA has no primary admin', !cA.body.primaryAdminId && cA.body.assignedAdminIds.length === 0, cA.body);
  const cB = await SA.post('/admin/categories', { name: `QA Beta ${RUN}`, assignedAdminIds: [NA2.uid, S1.uid, 'ghost'], backupAdminId: S1.uid });
  expectStatus(cB, 201, 'create catB with NA2 (+student +ghost filtered)');
  const catB = cB.body.id;
  check('catB assignedAdminIds filtered to admins', JSON.stringify(cB.body.assignedAdminIds) === JSON.stringify([NA2.uid]), cB.body.assignedAdminIds);
  check('catB primary defaults to first admin', cB.body.primaryAdminId === NA2.uid, cB.body);
  check('catB backup student rejected', !cB.body.backupAdminId, cB.body);
  const cI = await EA.post('/admin/categories', { name: `QA Inactive ${RUN}`, status: 'inactive' });
  expectStatus(cI, 201, 'EA creates inactive category');
  const catI = cI.body.id;
  const cE = await SA.post('/admin/categories', { name: `QA Empty ${RUN}` });
  const catE = cE.body.id;
  const cU = await SA.post('/admin/categories', { name: '数学 ✨' });
  expectStatus(cU, 201, 'create category with unicode-only name');
  check('unicode-only name gets a usable id', typeof cU.body.id === 'string' && cU.body.id.length > 5, cU.body.id);
  expectStatus(await SA.post('/admin/categories', { name: '' }), 400, 'category empty name');
  expectStatus(await SA.post('/admin/categories', { name: 'x'.repeat(101) }), 400, 'category name too long');
  expectStatus(await SA.post('/admin/categories', { name: 'ok', status: 'archived' }), 400, 'category bad status');
  expectStatus(await NA1.post('/admin/categories', { name: 'nope' }), 403, 'normal admin cannot create category');
  expectStatus(await S1.post('/admin/categories', { name: 'nope' }), 403, 'student cannot create category');
  expectStatus(await SA.put('/admin/categories/nope', { name: 'x' }), 404, 'PUT unknown category');
  expectStatus(await NA1.put(`/admin/categories/${catA}`, { name: 'x' }), 403, 'normal admin cannot PUT category');
  const catsAnon2 = await anon.get('/categories');
  check('logged out does not see inactive category', !catsAnon2.body.some((c) => c.id === catI));
  const catsS = await S1.get('/categories');
  check('signed-in (student) sees inactive category without ?status', catsS.body.some((c) => c.id === catI));
  const catsS2 = await S1.get('/categories?status=active');
  check('?status=active hides inactive', !catsS2.body.some((c) => c.id === catI));
  // Assign NA1+NA3 to catA from the admin side (primary stays empty)
  expectStatus(await NA1.patch(`/admin/admins/${NA1.uid}`, { assignedCategories: [catA] }), 403, 'normal admin cannot self-assign categories');
  const aNA1 = await SA.patch(`/admin/admins/${NA1.uid}`, { assignedCategories: [catA] });
  expectStatus(aNA1, 200, 'SA assigns NA1 to catA');
  expectStatus(await EA.patch(`/admin/admins/${NA3.uid}`, { assignedCategories: [catA, 'ghost-cat'] }), 200, 'EA assigns NA3 to catA');
  const catAfetched = (await SA.get('/categories')).body.find((c) => c.id === catA);
  check('category view reflects admin-side assignment', catAfetched?.assignedAdminIds.includes(NA1.uid) && catAfetched.assignedAdminIds.includes(NA3.uid), catAfetched);
  check('catA still has no primary admin', !catAfetched?.primaryAdminId, catAfetched);
  const na3Prof = (await NA3.get('/auth/me')).body.profile;
  check('unknown category ids dropped from assignments', JSON.stringify(na3Prof.assignedCategories) === JSON.stringify([catA]), na3Prof.assignedCategories);
  // PUT full replacement semantics
  const putE = await SA.put(`/admin/categories/${catE}`, { name: `QA Empty ${RUN} renamed`, description: 'd', subcategories: ['a', '', 'b'] });
  expectStatus(putE, 200, 'PUT category');
  check('PUT drops empty subcategories', JSON.stringify(putE.body.subcategories) === '["a","b"]', putE.body.subcategories);

  // ===================================================================== sockets
  sec('Sockets: connect');
  clients = [S1, S2, NA1, NA2, NA3, EA, SA];
  for (const c of clients) check(`socket connect ${c.name}`, await c.connect(), c.connectError);
  const ghost = new Client('anonSock');
  check('logged-out socket is rejected', !(await ghost.connect()) && ghost.connectError === 'unauthorized', ghost.connectError);
  const bogus = new Client('bogusSock'); bogus.cookie = 'cc_session=bogus';
  check('bogus-cookie socket is rejected', !(await bogus.connect()));
  await settle();

  // ===================================================================== 4
  sec('4. Users');
  let s = await snapS();
  const pm = await S1.patch('/users/me', { qualification: 'BSc', board: 'Federal', professionalTitle: 'Hacker', phoneNumber: '+92 300 0000000' });
  expectStatus(pm, 200, 'student PATCH /users/me');
  check('student qualification updated', pm.body.qualification === 'BSc' && pm.body.board === 'Federal', pm.body);
  check('student cannot set professionalTitle', pm.body.professionalTitle !== 'Hacker', pm.body);
  await settle();
  check('profile:update to self', got(s, S1, 'profile:update', (p) => p.uid === S1.uid));
  check('profile:update not to others', !got(s, S2, 'profile:update'));
  check('data:changed users broadcast', got(s, S2, 'data:changed', (p) => p.resource === 'users'));
  const pa = await NA1.patch('/users/me', { professionalTitle: 'Career Guide 🎓', qualification: 'PhD', shortDescription: 'Ich helfe.' });
  check('admin sets professionalTitle, not qualification', pa.body.professionalTitle === 'Career Guide 🎓' && pa.body.qualification !== 'PhD', pa.body);
  expectStatus(await S1.patch('/users/me', { displayName: 'A' }), 400, 'displayName too short');
  expectStatus(await S1.patch('/users/me', { displayName: 'x'.repeat(121) }), 400, 'displayName too long');
  expectStatus(await S1.patch('/users/me', { photoURL: 'http://evil/x.png' }), 400, 'photoURL http rejected');
  expectStatus(await S1.patch('/users/me', { photoURL: 'javascript:alert(1)' }), 400, 'photoURL javascript rejected');
  const ph = await S1.patch('/users/me', { photoURL: 'https://example.com/a.png' });
  check('photoURL https accepted', ph.body.photoURL === 'https://example.com/a.png', ph.body);
  const ph2 = await S1.patch('/users/me', { photoURL: '' });
  check('photoURL "" clears', ph2.body.photoURL === undefined, ph2.body);
  expectStatus(await S1.patch('/users/me', {}), 200, 'empty PATCH /users/me');
  // lookups
  const luS = await S1.get(`/users/${NA1.uid}`);
  check('student looks up counselor: public fields, no email/phone', luS.status === 200 && !('email' in luS.body) && !('phoneNumber' in luS.body), luS.body);
  expectStatus(await S1.get(`/users/${S2.uid}`), 404, 'student cannot look up another student');
  const luSelf = await S1.get(`/users/${S1.uid}`);
  check('self lookup returns self profile with email', luSelf.body.email === S1.profile.email);
  const luA = await NA1.get(`/users/${S1.uid}`);
  check('admin looks up student with contact details', luA.status === 200 && luA.body.email === S1.profile.email, luA.body);
  expectStatus(await SA.get('/users/nobody'), 404, 'unknown user');
  const adminsS = await S1.get('/admins');
  check('GET /admins student: only admins, active, no email', adminsS.status === 200 && adminsS.body.every((u) => u.role !== 'student' && u.status === 'active' && !('email' in u)), adminsS.body?.[0]);
  const adminsEA = await EA.get('/admins');
  check('GET /admins manager: includes email', adminsEA.body.every((u) => 'email' in u));
  for (const [c, code] of [[S1, 403], [NA1, 403], [EA, 200], [SA, 200]]) {
    expectStatus(await c.get('/admin/students'), code, `GET /admin/students as ${c.name}`);
    expectStatus(await c.get('/admin/users'), code, `GET /admin/users as ${c.name}`);
    expectStatus(await c.get('/admin/stats/replies-24h'), code, `GET replies-24h as ${c.name}`);
  }
  const stu = await EA.get('/admin/students');
  check('admin/students only students', stu.body.every((u) => u.role === 'student') && stu.body.some((u) => u.uid === S1.uid));
  const mentors = await anon.get('/public/mentors');
  check('public mentors: no emails', mentors.status === 200 && mentors.body.success && mentors.body.mentors.every((m) => !('email' in m)), mentors.body);
  // PATCH /admin/admins
  expectStatus(await NA1.patch(`/admin/admins/${NA1.uid}`, { displayName: 'QA NA1 Self' }), 200, 'admin edits own profile');
  expectStatus(await NA1.patch(`/admin/admins/${NA2.uid}`, { displayName: 'hijack' }), 403, 'normal admin cannot edit another admin');
  expectStatus(await NA1.patch(`/admin/admins/${NA1.uid}`, { role: 'super_admin' }), 403, 'normal admin cannot change own role');
  expectStatus(await EA.patch(`/admin/admins/${NA1.uid}`, { role: 'expert_admin' }), 403, 'expert admin cannot change roles');
  expectStatus(await EA.patch(`/admin/admins/${SA.uid}`, { displayName: 'x y' }), 403, 'expert admin cannot edit super admin');
  expectStatus(await SA.patch(`/admin/admins/${S1.uid}`, { displayName: 'x y' }), 400, 'PATCH admin on a student -> 400');
  expectStatus(await SA.patch(`/admin/admins/nobody`, { displayName: 'x y' }), 404, 'PATCH unknown admin');
  expectStatus(await SA.patch(`/admin/admins/${SA.uid}`, { role: 'expert_admin' }), 400, 'last super admin cannot demote self');
  expectStatus(await SA.patch(`/admin/users/${SA.uid}/status`, { status: 'deactivated' }), 400, 'cannot deactivate self');

  // ===================================================================== 5
  sec('5a. Create query (assigned via primary)');
  const qBody = (o = {}) => ({ categoryId: catB, title: 'How do I prepare for MDCAT? 🩺', detail: 'Details here — ünïcødé', ...o });
  s = await snapS();
  const q1r = await S1.post('/queries', qBody());
  expectStatus(q1r, 201, 'S1 creates Q1 in catB');
  const Q1 = q1r.body.ticket;
  check('Q1 assigned to primary NA2, not merged', Q1?.expertId === NA2.uid && q1r.body.merged === false && Q1.assignmentStatus === 'assigned', q1r.body);
  check('Q1 ticket number PT-n', /^PT-\d+$/.test(Q1?.ticketNumber || ''), Q1?.ticketNumber);
  check('Q1 status open, hasUnreadAdminReply', Q1.status === 'open' && Q1.hasUnreadAdminReply === true);
  await settle();
  expectSock(s, 'create Q1', 'query:upsert', forQ(Q1.id), [S1, NA2, EA, SA], [S2, NA1, NA3]);
  expectSock(s, 'create Q1', 'notification:new', forQ(Q1.id), [NA2], [S1, S2, NA1, NA3, EA, SA]);
  const q1msgs = await S1.get(`/queries/${Q1.id}/messages`);
  check('[doc] new ticket stores no header message (initial query is rendered from the ticket; API.md wording is loose)', q1msgs.body.length === 0, q1msgs.body);
  const nNA2 = await notifs(NA2, Q1.id, 'new_query');
  check('NA2 has new_query notification', nNA2.length === 1, nNA2);

  sec('5a. Create query validation');
  expectStatus(await NA1.post('/queries', qBody()), 403, 'admin cannot create query');
  expectStatus(await S1.post('/queries', qBody({ title: '' })), 400, 'empty title');
  expectStatus(await S1.post('/queries', qBody({ title: '   ' })), 400, 'whitespace title');
  expectStatus(await S1.post('/queries', { categoryId: catB, detail: 'x' }), 400, 'missing title');
  expectStatus(await S1.post('/queries', qBody({ title: 'x'.repeat(201) })), 400, 'title 201 chars');
  expectStatus(await S1.post('/queries', qBody({ detail: 'x'.repeat(4001) })), 400, 'detail 4001 chars');
  expectStatus(await S1.post('/queries', qBody({ detail: '' })), 400, 'no detail and no audio');
  expectStatus(await S1.post('/queries', qBody({ categoryId: 'nope' })), 400, 'unknown category');
  expectStatus(await S1.post('/queries', qBody({ categoryId: catI })), 400, 'inactive category');
  expectStatus(await S1.post('/queries', qBody({ expertId: S2.uid })), 400, 'expertId is a student');
  expectStatus(await S1.post('/queries', qBody({ expertId: 'ghost' })), 400, 'expertId unknown');
  expectStatus(await S1.post('/queries', qBody({ attachments: [{ id: 'a', name: 'a', size: 1, type: 'image/png', url: 'data:image/png;base64,AAAA' }] })), 400, 'data URL attachment rejected');
  expectStatus(await S1.post('/queries', qBody({ audioUrl: 'https://evil/x.mp3' })), 400, 'external audioUrl rejected');
  expectStatus(await S1.post('/queries', '{bad json'), 400, 'malformed JSON');
  expectStatus(await S1.post('/queries', JSON.stringify({ ...qBody(), detail: 'x'.repeat(1_100_000) })), 413, 'body > 1mb');
  check('no extra tickets created by invalid requests', (await S1.get('/queries')).body.length === 1);

  sec('5b. Access to Q1');
  expectStatus(await S2.get(`/queries/${Q1.id}`), 404, 'other student GET Q1');
  expectStatus(await NA1.get(`/queries/${Q1.id}`), 404, 'other-category normal admin GET Q1');
  expectStatus(await NA2.get(`/queries/${Q1.id}`), 200, 'assigned admin GET Q1');
  expectStatus(await EA.get(`/queries/${Q1.id}`), 200, 'expert admin GET Q1');
  expectStatus(await SA.get(`/queries/${Q1.id}/messages`), 200, 'super admin GET Q1 messages');
  expectStatus(await S2.get(`/queries/${Q1.id}/messages`), 404, 'other student GET Q1 messages');
  expectStatus(await S1.get('/queries/nope'), 404, 'unknown query');
  check('S2 /queries empty', (await S2.get('/queries')).body.length === 0);
  check('NA2 /queries has Q1', (await NA2.get('/queries')).body.some((q) => q.id === Q1.id));
  check('NA1 /queries lacks Q1', !(await NA1.get('/queries')).body.some((q) => q.id === Q1.id));
  check('EA default scope lacks Q1 (not assigned)', !(await EA.get('/queries')).body.some((q) => q.id === Q1.id));
  check('EA scope=all has Q1', (await EA.get('/queries?scope=all')).body.some((q) => q.id === Q1.id));
  check('NA1 scope=all ignored', !(await NA1.get('/queries?scope=all')).body.some((q) => q.id === Q1.id));
  const ex = await S1.get(`/queries-meta/experts?categoryId=${catB}`);
  check('experts for catB = [NA2] with public fields', ex.status === 200 && ex.body.length === 1 && ex.body[0].uid === NA2.uid && !('email' in ex.body[0]), ex.body);
  const exAll = await S1.get('/queries-meta/experts');
  check('experts (all) only admins', exAll.body.length >= 5 && exAll.body.every((e) => e.role !== 'student'));
  expectStatus(await S1.get('/queries-meta/unassigned'), 403, 'student GET unassigned');

  sec('5c. Messages, socket rooms, read receipts');
  check('S1 can join Q1 room', (await S1.join(Q1.id)) === true);
  check('NA2 can join Q1 room', (await NA2.join(Q1.id)) === true);
  check('EA can join Q1 room', (await EA.join(Q1.id)) === true);
  check('S2 cannot join Q1 room', (await S2.join(Q1.id)) === false);
  check('NA1 cannot join Q1 room', (await NA1.join(Q1.id)) === false);
  check('join with non-string id fails', (await S1.join(123)) === false);
  s = await snapS();
  const m1 = await NA2.post(`/queries/${Q1.id}/messages`, { content: 'Hello from NA2 👋' });
  expectStatus(m1, 201, 'NA2 replies');
  check('ticket replied + hasUnreadStudentReply', m1.body.ticket.status === 'replied' && m1.body.ticket.hasUnreadStudentReply === true, m1.body.ticket);
  await settle();
  expectSock(s, 'NA2 reply', 'message:new', (p) => p.id === m1.body.message.id, [S1, NA2, EA], [S2, NA1, NA3, SA]);
  expectSock(s, 'NA2 reply', 'query:upsert', forQ(Q1.id), [S1, NA2, EA, SA], [S2, NA1, NA3]);
  expectSock(s, 'NA2 reply', 'notification:new', forQ(Q1.id), [S1], [NA2, S2, NA1, NA3, EA, SA]);
  expectStatus(await S2.post(`/queries/${Q1.id}/messages`, { content: 'intrude' }), 404, 'other student posts to Q1');
  expectStatus(await NA1.post(`/queries/${Q1.id}/messages`, { content: 'intrude' }), 404, 'other-category admin posts to Q1');
  expectStatus(await S1.post(`/queries/${Q1.id}/messages`, { content: '' }), 400, 'empty message');
  expectStatus(await S1.post(`/queries/${Q1.id}/messages`, { content: '   \n ' }), 400, 'whitespace message');
  expectStatus(await S1.post(`/queries/${Q1.id}/messages`, { content: 'x'.repeat(8001) }), 400, '8001-char message');
  expectStatus(await S1.post(`/queries/${Q1.id}/messages`, {}), 400, 'missing content');
  expectStatus(await S1.post(`/queries/nope/messages`, { content: 'x' }), 404, 'message to unknown query');
  expectStatus(await S1.post(`/queries/${Q1.id}/messages`, { content: 'x', attachments: [{ id: 'a', name: 'a', size: 1, type: 'x', url: '/api/files/../../etc/passwd' }] }), 400, 'bad attachment url');
  s = await snapS();
  const m2 = await S1.post(`/queries/${Q1.id}/messages`, { content: 'Thanks! 🙏 ' + 'ü'.repeat(7990) });
  expectStatus(m2, 201, 'S1 replies (unicode, ~8000 chars)');
  check('student reply -> in_progress + hasUnreadAdminReply', m2.body.ticket.status === 'in_progress' && m2.body.ticket.hasUnreadAdminReply === true, m2.body.ticket.status);
  check('preview truncated to 120', (m2.body.ticket.lastReplyPreview || '').length <= 120);
  await settle();
  expectSock(s, 'S1 reply', 'notification:new', forQ(Q1.id), [NA2], [S1, S2, NA1, NA3, EA, SA]);
  const m3 = await EA.post(`/queries/${Q1.id}/messages`, { content: 'Manager chiming in' });
  expectStatus(m3, 201, 'manager replies on another admin ticket');
  check('manager reply keeps assignee', m3.body.ticket.expertId === NA2.uid);
  // read receipts
  s = await snapS();
  const rd = await S1.post(`/queries/${Q1.id}/read`);
  expectStatus(rd, 200, 'S1 marks read');
  check('S1 read clears hasUnreadStudentReply', rd.body.hasUnreadStudentReply === false, rd.body);
  await settle();
  check('message:update to room after student read', got(s, NA2, 'message:update', (p) => p.queryId === Q1.id && p.readIds.includes(m1.body.message.id) && p.readIds.includes(m3.body.message.id)));
  check('notification:read to S1', got(s, S1, 'notification:read', (p) => p.queryId === Q1.id));
  check('S1 notifications for Q1 all read', (await notifs(S1, Q1.id)).every((n) => n.isRead));
  let msgs = (await S1.get(`/queries/${Q1.id}/messages`)).body;
  check('admin messages marked read, student message not yet', msgs.filter((m) => m.senderRole !== 'student').every((m) => m.isRead) && msgs.find((m) => m.id === m2.body.message.id)?.isRead === false, msgs.map((m) => [m.senderRole, m.isRead]));
  const rdE = await EA.post(`/queries/${Q1.id}/read`);
  check('non-assignee manager read does not clear admin unread flag', rdE.body.hasUnreadAdminReply === true, rdE.body);
  const rdN = await NA2.post(`/queries/${Q1.id}/read`);
  check('assignee read clears hasUnreadAdminReply & sets isInitialQueryReadByAdmin', rdN.body.hasUnreadAdminReply === false && rdN.body.isInitialQueryReadByAdmin === true, rdN.body);
  msgs = (await S1.get(`/queries/${Q1.id}/messages`)).body;
  check('student message now read', msgs.find((m) => m.id === m2.body.message.id)?.isRead === true);
  expectStatus(await S2.post(`/queries/${Q1.id}/read`), 404, 'other student read');

  sec('5d. Status, rating, reopen');
  expectStatus(await S1.patch(`/queries/${Q1.id}/status`, { status: 'open' }), 403, 'student sets open');
  expectStatus(await S1.patch(`/queries/${Q1.id}/status`, { status: 'closed' }), 400, 'invalid status');
  expectStatus(await NA1.patch(`/queries/${Q1.id}/status`, { status: 'resolved' }), 404, 'other admin status');
  expectStatus(await S2.patch(`/queries/${Q1.id}/status`, { status: 'resolved' }), 404, 'other student status');
  expectStatus(await S1.post(`/queries/${Q1.id}/rating`, { rating: 5 }), 400, 'rating before resolved');
  s = await snapS();
  const st1 = await S1.patch(`/queries/${Q1.id}/status`, { status: 'resolved' });
  check('student resolves', st1.status === 200 && st1.body.status === 'resolved', st1.body);
  await settle();
  check('student resolve: no query_resolved notification to student', !got(s, S1, 'notification:new', (p) => p.type === 'query_resolved'));
  const same = await S1.patch(`/queries/${Q1.id}/status`, { status: 'resolved' });
  check('same status idempotent', same.status === 200 && same.body.status === 'resolved');
  expectStatus(await NA2.patch(`/queries/${Q1.id}/status`, { status: 'in_progress' }), 200, 'staff sets in_progress');
  s = await snapS();
  const st2 = await NA2.patch(`/queries/${Q1.id}/status`, { status: 'resolved' });
  expectStatus(st2, 200, 'staff resolves');
  await settle();
  expectSock(s, 'staff resolve', 'notification:new', (p) => p.queryId === Q1.id && p.type === 'query_resolved', [S1], [NA2, EA, SA, S2]);
  expectStatus(await NA2.post(`/queries/${Q1.id}/rating`, { rating: 5 }), 403, 'admin rates');
  expectStatus(await S2.post(`/queries/${Q1.id}/rating`, { rating: 5 }), 404, 'other student rates');
  for (const bad of [0, 6, 3.5, '5', null]) expectStatus(await S1.post(`/queries/${Q1.id}/rating`, { rating: bad }), 400, `rating ${JSON.stringify(bad)}`);
  expectStatus(await S1.post(`/queries/${Q1.id}/rating`, { rating: 4, feedback: 'f'.repeat(2001) }), 400, 'feedback too long');
  expectStatus(await S1.post(`/queries/${Q1.id}/rating`, { rating: 4, tags: Array(11).fill('t') }), 400, 'too many tags');
  s = await snapS();
  const rt1 = await S1.post(`/queries/${Q1.id}/rating`, { rating: 4, feedback: 'Great 👍', tags: ['helpful'] });
  expectStatus(rt1, 200, 'S1 rates 4');
  check('rating -> expert count 1 sum 4', rt1.body.expert?.ratingCount === 1 && rt1.body.expert?.ratingSum === 4, rt1.body.expert);
  await settle();
  expectSock(s, 'rating', 'notification:new', (p) => p.queryId === Q1.id && p.type === 'query_rating', [NA2], [S1, EA, SA]);
  check('rating broadcasts data:changed reviews', got(s, S2, 'data:changed', (p) => p.resource === 'reviews'));
  const rt2 = await S1.post(`/queries/${Q1.id}/rating`, { rating: 2 });
  check('re-rating replaces: count 1 sum 2', rt2.body.expert?.ratingCount === 1 && rt2.body.expert?.ratingSum === 2, rt2.body.expert);
  check('re-rating clears feedback', rt2.body.ticket.ratingFeedback === '' || rt2.body.ticket.ratingFeedback === undefined, rt2.body.ticket.ratingFeedback);
  const revPub = await anon.get('/reviews');
  const rvQ1 = revPub.body.find((r) => r.id === Q1.id);
  check('public /reviews has Q1 rating 2 w/o email/title', rvQ1?.rating === 2 && !('studentEmail' in rvQ1) && !('title' in rvQ1), rvQ1);
  const revMgr = await EA.get('/reviews');
  check('manager /reviews has studentEmail+title', revMgr.body.find((r) => r.id === Q1.id)?.studentEmail === S1.profile.email);
  const revNA = await NA2.get('/reviews');
  check('normal admin /reviews no email', !('studentEmail' in (revNA.body.find((r) => r.id === Q1.id) || {})));
  // reopen
  const ro = await S1.post(`/queries/${Q1.id}/reopen`);
  check('reopen -> in_progress, rating cleared', ro.status === 200 && ro.body.status === 'in_progress' && ro.body.rating === undefined, ro.body);
  let na2p = (await NA2.get('/auth/me')).body.profile;
  check('reopen undoes rating aggregate (0/0)', na2p.ratingCount === 0 && na2p.ratingSum === 0, [na2p.ratingCount, na2p.ratingSum]);
  check('reopened ticket gone from /reviews', !(await anon.get('/reviews')).body.some((r) => r.id === Q1.id));
  expectStatus(await S1.post(`/queries/${Q1.id}/rating`, { rating: 5 }), 400, 'rating after reopen (not resolved)');
  expectStatus(await S2.post(`/queries/${Q1.id}/reopen`), 404, 'other student reopen');
  expectStatus(await NA1.post(`/queries/${Q1.id}/reopen`), 404, 'other admin reopen');
  await S1.patch(`/queries/${Q1.id}/status`, { status: 'resolved' });
  await S1.post(`/queries/${Q1.id}/rating`, { rating: 5 });
  // second ticket for NA2 by S2 to detect double-decrement
  const q2r = await S2.post('/queries', qBody({ title: 'S2 question' }));
  const Q2 = q2r.body.ticket;
  await NA2.post(`/queries/${Q2.id}/messages`, { content: 'answer' });
  await NA2.patch(`/queries/${Q2.id}/status`, { status: 'resolved' });
  await S2.post(`/queries/${Q2.id}/rating`, { rating: 3 });
  na2p = (await NA2.get('/auth/me')).body.profile;
  check('NA2 aggregate 2 ratings sum 8', na2p.ratingCount === 2 && na2p.ratingSum === 8, [na2p.ratingCount, na2p.ratingSum]);
  // parallel double reopen
  const [ra, rb] = await Promise.all([S1.post(`/queries/${Q1.id}/reopen`), S1.post(`/queries/${Q1.id}/reopen`)]);
  check('parallel reopens both 200', ra.status === 200 && rb.status === 200);
  na2p = (await NA2.get('/auth/me')).body.profile;
  check('parallel double reopen decrements aggregate only once (expect 1/3)', na2p.ratingCount === 1 && na2p.ratingSum === 3, [na2p.ratingCount, na2p.ratingSum]);
  // parallel double rating
  await S1.patch(`/queries/${Q1.id}/status`, { status: 'resolved' });
  const before = (await NA2.get('/auth/me')).body.profile;
  const [pa1, pa2] = await Promise.all([S1.post(`/queries/${Q1.id}/rating`, { rating: 4 }), S1.post(`/queries/${Q1.id}/rating`, { rating: 4 })]);
  check('parallel ratings 200', pa1.status === 200 && pa2.status === 200);
  const after = (await NA2.get('/auth/me')).body.profile;
  check('parallel double rating counts once', after.ratingCount === before.ratingCount + 1 && after.ratingSum === before.ratingSum + 4, [before.ratingCount, before.ratingSum, after.ratingCount, after.ratingSum]);
  // staff PATCH status away from resolved keeps rating (surprising)
  const keep = await NA2.patch(`/queries/${Q1.id}/status`, { status: 'in_progress' });
  check('[behavior] staff status change away from resolved keeps rating', keep.body.rating === 4, keep.body.rating);
  await NA2.patch(`/queries/${Q1.id}/status`, { status: 'resolved' });

  sec('5e. Merge into existing chat, double submission');
  s = await snapS();
  const mg = await S1.post('/queries', qBody({ title: 'Second question', detail: 'More detail' }));
  expectStatus(mg, 201, 'S1 new query with NA2 again');
  check('merged into Q1', mg.body.merged === true && mg.body.ticket.id === Q1.id && mg.body.ticket.status === 'open' && mg.body.ticket.title === 'Second question', mg.body);
  check('[behavior] merged ticket keeps previous rating though reopened to open', mg.body.ticket.rating === 4, mg.body.ticket.rating);
  msgs = (await S1.get(`/queries/${Q1.id}/messages`)).body;
  check('merge adds header message', msgs.filter((m) => m.isNewQueryHeader).length >= 1 && msgs.at(-1).isNewQueryHeader && msgs.at(-1).queryTitle === 'Second question');
  await settle();
  check('merge: message:new to room (S1 joined)', got(s, S1, 'message:new', (p) => p.queryId === Q1.id && p.isNewQueryHeader));
  expectSock(s, 'merge', 'notification:new', forQ(Q1.id), [NA2], [S1, EA]);
  const [d1, d2] = await Promise.all([S2.post('/queries', qBody({ expertId: EA.uid, title: 'dbl' })), S2.post('/queries', qBody({ expertId: EA.uid, title: 'dbl' }))]);
  check('parallel double create with same counselor -> one ticket', d1.body.ticket?.id === d2.body.ticket?.id, [d1.status, d2.status, d1.body.ticket?.id, d2.body.ticket?.id]);
  const QEA = d1.body.ticket;

  sec('5f. Follow-up');
  expectStatus(await NA2.post(`/queries/${Q1.id}/follow-up`, { title: 'x', detail: 'y' }), 403, 'admin follow-up');
  expectStatus(await S2.post(`/queries/${Q1.id}/follow-up`, { title: 'x', detail: 'y' }), 404, 'other student follow-up');
  expectStatus(await S1.post(`/queries/${Q1.id}/follow-up`, { detail: 'y' }), 400, 'follow-up missing title');
  s = await snapS();
  const fu = await S1.post(`/queries/${Q1.id}/follow-up`, { title: 'Follow-up 🔁', detail: '' });
  expectStatus(fu, 201, 'S1 follow-up');
  check('follow-up -> in_progress, header message', fu.body.ticket.status === 'in_progress' && fu.body.message.isNewQueryHeader === true, fu.body.ticket.status);
  await settle();
  expectSock(s, 'follow-up', 'notification:new', (p) => p.queryId === Q1.id && p.type === 'new_query', [NA2], [S1, EA, SA]);
  expectSock(s, 'follow-up', 'query:upsert', forQ(Q1.id), [S1, NA2, EA, SA], [S2, NA1, NA3]);

  sec('5g. Unassigned ticket, claim by reply');
  s = await snapS();
  const qu = await S1.post('/queries', { categoryId: catA, title: 'Unassigned Q', detail: 'Who will answer?' });
  expectStatus(qu, 201, 'S1 creates query in catA (no primary)');
  const QU = qu.body.ticket;
  check('QU unassigned', QU.expertId === 'unassigned' && QU.assignmentStatus === 'unassigned', QU);
  await settle();
  expectSock(s, 'unassigned create', 'query:upsert', forQ(QU.id), [S1, NA1, NA3, EA, SA], [S2, NA2]);
  expectSock(s, 'unassigned create', 'notification:new', forQ(QU.id), [NA1, NA3, EA, SA], [S1, S2]);
  check('unassigned create: admin of other category (NA2, cannot view it) gets NO notification', !got(s, NA2, 'notification:new', forQ(QU.id)));
  expectStatus(await NA2.get(`/queries/${QU.id}`), 404, 'NA2 cannot view QU');
  expectStatus(await NA1.get(`/queries/${QU.id}`), 200, 'NA1 can view QU');
  check('NA1 /queries includes QU', (await NA1.get('/queries')).body.some((q) => q.id === QU.id));
  check('NA1 unassigned list includes QU', (await NA1.get('/queries-meta/unassigned')).body.some((q) => q.id === QU.id));
  check('NA2 unassigned list lacks QU', !(await NA2.get('/queries-meta/unassigned')).body.some((q) => q.id === QU.id));
  check('EA unassigned list includes QU', (await EA.get('/queries-meta/unassigned')).body.some((q) => q.id === QU.id));
  expectStatus(await NA2.post(`/queries/${QU.id}/messages`, { content: 'claim?' }), 404, 'other-category admin cannot claim');
  check('NA3 joins QU room', (await NA3.join(QU.id)) === true);
  s = await snapS();
  const sm = await S1.post(`/queries/${QU.id}/messages`, { content: 'anyone?' });
  await settle();
  check('student reply on unassigned: other-category admin NA2 not notified', !got(s, NA2, 'notification:new', forQ(QU.id)));
  s = await snapS();
  const claim = await NA1.post(`/queries/${QU.id}/messages`, { content: 'I will take this' });
  expectStatus(claim, 201, 'NA1 claims by replying');
  check('claimed: expertId NA1, assigned, replied', claim.body.ticket.expertId === NA1.uid && claim.body.ticket.assignmentStatus === 'assigned' && claim.body.ticket.status === 'replied', claim.body.ticket);
  await settle();
  check('claim: NA3 (same category, lost access) is told (query:upsert or query:removed)', got(s, NA3, 'query:upsert', forQ(QU.id)) || got(s, NA3, 'query:removed', forQ(QU.id)));
  expectStatus(await NA3.get(`/queries/${QU.id}`), 404, 'NA3 no longer sees claimed QU');
  expectStatus(await NA3.post(`/queries/${QU.id}/messages`, { content: 'late' }), 404, 'NA3 cannot reply after claim');
  s = await snapS();
  const afterClaim = await NA1.post(`/queries/${QU.id}/messages`, { content: 'private follow-up after claim' });
  await settle();
  check('after claim, NA3 (still in QU room from before) must NOT receive message:new of a chat it can no longer view', !got(s, NA3, 'message:new', (p) => p.id === afterClaim.body.message?.id));
  check('QU gone from unassigned list', !(await NA3.get('/queries-meta/unassigned')).body.some((q) => q.id === QU.id));

  sec('5h. Reassign');
  expectStatus(await S1.post(`/queries/${QU.id}/reassign`, { newExpertId: NA2.uid }), 403, 'student reassign');
  expectStatus(await NA1.post(`/queries/${QU.id}/reassign`, {}), 400, 'reassign missing newExpertId');
  expectStatus(await NA1.post(`/queries/${QU.id}/reassign`, { newExpertId: NA1.uid }), 400, 'reassign to current expert');
  expectStatus(await NA1.post(`/queries/${QU.id}/reassign`, { newExpertId: S2.uid }), 400, 'reassign to student');
  expectStatus(await NA1.post(`/queries/${QU.id}/reassign`, { newExpertId: 'ghost' }), 400, 'reassign to unknown');
  expectStatus(await NA1.post(`/queries/${Q1.id}/reassign`, { newExpertId: EA.uid }), 404, 'reassign invisible ticket');
  check('NA1 joins QU room', (await NA1.join(QU.id)) === true);
  s = await snapS();
  const ra1 = await NA1.post(`/queries/${QU.id}/reassign`, { newExpertId: NA2.uid });
  expectStatus(ra1, 200, 'NA1 reassigns QU to NA2 (S1 already chats with NA2)');
  check('reassign merged into existing Q1', ra1.body.merged === true && ra1.body.targetTicket.id === Q1.id, { merged: ra1.body.merged, t: ra1.body.targetTicket?.id });
  check('old ticket resolved+reassigned', ra1.body.oldTicket.status === 'resolved' && ra1.body.oldTicket.assignmentStatus === 'reassigned' && ra1.body.oldTicket.reassignedToAdminId === NA2.uid, ra1.body.oldTicket);
  check('target ticket open, unread for admin', ra1.body.targetTicket.status === 'open' && ra1.body.targetTicket.hasUnreadAdminReply === true);
  await settle();
  expectSock(s, 'reassign', 'notification:new', (p) => p.queryId === Q1.id, [NA2, S1], [NA1, EA, SA, S2]);
  expectSock(s, 'reassign', 'query:upsert', forQ(QU.id), [NA1, S1, EA, SA], [S2, NA2]);
  expectSock(s, 'reassign', 'query:upsert', forQ(Q1.id), [NA2, S1, EA, SA], [S2, NA1]);
  check('reassign merge: header message:new pushed to the open Q1 room (NA2 joined)', got(s, NA2, 'message:new', (p) => p.queryId === Q1.id && p.isNewQueryHeader));
  check('reassign: system message:new pushed to the open old-ticket room (NA1 joined QU)', got(s, NA1, 'message:new', (p) => p.queryId === QU.id && p.isSystemMessage));
  msgs = (await NA2.get(`/queries/${Q1.id}/messages`)).body;
  check('merged reassignment header in Q1', msgs.some((m) => m.isNewQueryHeader && m.content.includes('Reassigned from')));
  check('system message in old ticket', (await NA1.get(`/queries/${QU.id}/messages`)).body.some((m) => m.isSystemMessage));
  expectStatus(await NA1.post(`/queries/${QU.id}/reassign`, { newExpertId: EA.uid }), 409, 'repeat reassign of old ticket');
  // reassign Q1 (S1,NA2) to EA by NA2 → new ticket (S1 has no chat with EA)
  const ra2 = await NA2.post(`/queries/${Q1.id}/reassign`, { newExpertId: EA.uid });
  expectStatus(ra2, 200, 'NA2 reassigns Q1 to EA');
  check('new ticket created (not merged), from NA2, rating reset', ra2.body.merged === false && ra2.body.targetTicket.id !== Q1.id && ra2.body.targetTicket.reassignedFromAdminId === NA2.uid && ra2.body.targetTicket.rating === undefined && ra2.body.targetTicket.expertId === EA.uid, ra2.body.targetTicket);
  const Q1b = ra2.body.targetTicket;
  // repeated reassign of the new ticket back to NA1 → merges into old reassigned QU (revives it)
  const ra3 = await EA.post(`/queries/${Q1b.id}/reassign`, { newExpertId: NA1.uid });
  expectStatus(ra3, 200, 'EA reassigns Q1b to NA1');
  check('[behavior] reassign merges into the old reassigned chat with NA1 (QU) and revives it', ra3.body.merged === true && ra3.body.targetTicket.id === QU.id && ra3.body.targetTicket.assignmentStatus === 'assigned', { m: ra3.body.merged, id: ra3.body.targetTicket?.id, as: ra3.body.targetTicket?.assignmentStatus });
  check('revived ticket clears reassignedTo', !ra3.body.targetTicket.reassignedToAdminId, ra3.body.targetTicket.reassignedToAdminId);
  // parallel double reassign
  const qp = await S2.post('/queries', { categoryId: catA, expertId: NA1.uid, title: 'parallel reassign', detail: 'x' });
  const QP = qp.body.ticket;
  const [pr1, pr2] = await Promise.all([NA1.post(`/queries/${QP.id}/reassign`, { newExpertId: NA3.uid }), NA1.post(`/queries/${QP.id}/reassign`, { newExpertId: EA.uid })]);
  check('parallel reassign: one 200, one 409', [pr1.status, pr2.status].sort().join() === '200,409', [pr1.status, pr2.status, pr1.body, pr2.body]);
  const qpAll = (await SA.get('/queries?scope=all')).body.filter((q) => q.reassignedInitialTicketId === QP.id);
  check('parallel reassign creates exactly one new ticket', qpAll.length === 1, qpAll.length);
  // EA reassigns a ticket to themselves: actor should not be notified
  const qself = await S2.post('/queries', { categoryId: catA, expertId: NA3.uid, title: 'self reassign', detail: 'x' });
  s = await snapS();
  const rs = await EA.post(`/queries/${qself.body.ticket.id}/reassign`, { newExpertId: EA.uid });
  expectStatus(rs, 200, 'EA reassigns ticket to self');
  await settle();
  check('actor (EA) is not notified about own reassignment', !got(s, EA, 'notification:new', (p) => p.type === 'new_query' && p.queryId === rs.body.targetTicket?.id));
  // unassigned ticket reassigned by manager
  const qu2 = await S2.post('/queries', { categoryId: catA, title: 'unassigned 2', detail: 'x' });
  const ra4 = await SA.post(`/queries/${qu2.body.ticket.id}/reassign`, { newExpertId: NA1.uid });
  check('manager reassigns unassigned ticket', ra4.status === 200 && ra4.body.targetTicket.expertId === NA1.uid, ra4.body);
  // the old (reassigned) ticket still accepts student messages
  const late = await S1.post(`/queries/${Q1.id}/messages`, { content: 'writing in the old reassigned ticket' });
  check('[behavior] student can still write in a reassigned (closed) ticket', late.status === 201, late.status);

  sec('5i. Hide for me');
  // S2 has Q2 (NA2). Save an answer + notification, then hide.
  const q2msgs = (await S2.get(`/queries/${Q2.id}/messages`)).body;
  const saved = await S2.post('/saved-answers', { queryId: Q2.id, messageId: q2msgs.at(-1).id, queryTitle: 't', answerText: 'a' });
  expectStatus(saved, 201, 'S2 saves answer on Q2');
  check('S2 has notifications for Q2 before hide', (await notifs(S2, Q2.id)).length > 0);
  s = await snapS();
  expectStatus(await S2.post(`/queries/${Q2.id}/hide`), 200, 'S2 hides Q2');
  await settle();
  check('query:removed to S2 only', got(s, S2, 'query:removed', forQ(Q2.id)) && !got(s, NA2, 'query:removed', forQ(Q2.id)));
  const q2view = (await S2.get('/queries')).body.find((q) => q.id === Q2.id);
  check('hidden ticket still listed with deletedForUsers=[S2]', q2view && q2view.deletedForUsers.includes(S2.uid), q2view?.deletedForUsers);
  check('hide removed saved answers', (await S2.get(`/saved-answers?queryId=${Q2.id}`)).body.length === 0);
  check('hide removed notifications', (await notifs(S2, Q2.id)).length === 0);
  check('NA2 still sees Q2 not hidden for NA2', !(await NA2.get(`/queries/${Q2.id}`)).body.deletedForUsers.includes(NA2.uid));
  expectStatus(await S1.post(`/queries/${Q2.id}/hide`), 404, 'other student hide');
  expectStatus(await S2.post(`/queries/${Q2.id}/hide`), 200, 'hide twice idempotent');
  const nq = await S2.post('/queries', qBody({ title: 'after hide' }));
  check('new query to same counselor after hide -> new ticket', nq.body.merged === false && nq.body.ticket.id !== Q2.id, nq.body);
  const Q2b = nq.body.ticket;
  // admin hides chat, then student submits again to same counselor
  expectStatus(await NA2.post(`/queries/${Q2b.id}/hide`), 200, 'NA2 hides Q2b');
  const nq2 = await S2.post('/queries', qBody({ title: 'new question after admin hid chat' }));
  const visibleForNA2 = (await NA2.get('/queries')).body.find((q) => q.id === nq2.body.ticket.id);
  check('new query merged into a chat the counselor hid must be visible to counselor (not in deletedForUsers)', visibleForNA2 && !visibleForNA2.deletedForUsers.includes(NA2.uid), { merged: nq2.body.merged, del: visibleForNA2?.deletedForUsers });

  sec('5j. Saved answers');
  const q1mid = (await S1.get(`/queries/${Q1.id}/messages`)).body.find((m) => m.senderRole !== 'student').id;
  s = await snapS();
  const sv1 = await S1.post('/saved-answers', { queryId: Q1.id, messageId: q1mid, queryTitle: 'Q 🩺', categoryName: 'c', expertName: 'e', questionText: 'q', answerText: 'a' });
  expectStatus(sv1, 201, 'save answer');
  await settle();
  check('saved-answer:upsert to S1 only', got(s, S1, 'saved-answer:upsert', (p) => p.id === sv1.body.id) && !got(s, S2, 'saved-answer:upsert'));
  const sv2 = await S1.post('/saved-answers', { queryId: Q1.id, messageId: q1mid, answerText: 'different' });
  check('same messageId returns existing (200, same id)', sv2.status === 200 && sv2.body.id === sv1.body.id, [sv2.status, sv2.body.id]);
  const [sp1, sp2] = await Promise.all([
    S1.post('/saved-answers', { queryId: Q1.id, messageId: m3.body.message.id }),
    S1.post('/saved-answers', { queryId: Q1.id, messageId: m3.body.message.id }),
  ]);
  const savedM3 = (await S1.get('/saved-answers')).body.filter((x) => x.messageId === m3.body.message.id);
  check('parallel double save with same messageId -> one row', savedM3.length === 1, savedM3.length);
  expectStatus(await S2.post('/saved-answers', { queryId: Q1.id, messageId: q1mid }), 404, 'save on invisible ticket');
  expectStatus(await S1.post('/saved-answers', { messageId: q1mid }), 400, 'save missing queryId');
  expectStatus(await S1.post('/saved-answers', { queryId: Q1.id, answerText: 'x'.repeat(8001) }), 400, 'save oversized');
  const noMid1 = await S1.post('/saved-answers', { queryId: Q1.id, answerText: 'x' });
  const noMid2 = await S1.post('/saved-answers', { queryId: Q1.id, answerText: 'x' });
  check('no messageId -> no dedupe (two rows)', noMid1.body.id !== noMid2.body.id);
  const adminSave = await NA2.post('/saved-answers', { queryId: Q1.id, messageId: q1mid });
  check('admin can save on visible ticket', adminSave.status === 201);
  check('S2 cannot see S1 saved answers', !(await S2.get('/saved-answers')).body.some((x) => x.id === sv1.body.id));
  check('GET ?queryId filter', (await S1.get(`/saved-answers?queryId=${Q1.id}`)).body.every((x) => x.queryId === Q1.id));
  expectStatus(await S2.del(`/saved-answers/${sv1.body.id}`), 404, 'delete other user saved answer');
  s = await snapS();
  expectStatus(await S1.del(`/saved-answers/${sv1.body.id}`), 200, 'delete own saved answer');
  await settle();
  check('saved-answer:deleted to S1', got(s, S1, 'saved-answer:deleted', (p) => p.id === sv1.body.id));
  expectStatus(await S1.del(`/saved-answers/${sv1.body.id}`), 404, 'delete again');

  sec('5k. Coffee treats');
  const cfg = await S1.get('/coffee-treats/config');
  check('coffee config disabled', cfg.status === 200 && cfg.body.enabled === false && cfg.body.accountNumber === '', cfg.body);
  const up = await upload(S1, [{ name: 'shot.png', type: 'image/png', data: PNG }]);
  const shotUrl = up.body.files?.[0]?.url;
  expectStatus(await S1.post('/coffee-treats', { ticketId: Q1.id, screenshotUrl: shotUrl }), 503, 'coffee not configured');
  expectStatus(await S1.post('/coffee-treats', { ticketId: Q1.id, screenshotUrl: 'https://x/y.png' }), 400, 'coffee bad screenshot');
  expectStatus(await S2.post('/coffee-treats', { ticketId: Q1.id, screenshotUrl: shotUrl }), 404, 'coffee other ticket');
  expectStatus(await NA2.post('/coffee-treats', { ticketId: Q1.id, screenshotUrl: shotUrl }), 403, 'coffee by admin');
  const ct = await S1.get(`/queries/${Q1.id}/coffee-treat`);
  check('coffee-treat for ticket null', ct.status === 200 && ct.body === null, ct.body);
  expectStatus(await S2.get(`/queries/${Q1.id}/coffee-treat`), 404, 'coffee-treat invisible ticket');
  expectStatus(await SA.get('/admin/coffee-treats'), 200, 'SA coffee list');
  expectStatus(await EA.get('/admin/coffee-treats'), 403, 'EA coffee list');

  // ===================================================================== 6
  sec('6. Notifications endpoints');
  const nl = await NA2.get('/notifications?limit=1');
  check('limit=1', nl.body.length === 1);
  const nall = await NA2.get('/notifications');
  check('newest first', nall.body.every((n, i, a) => i === 0 || a[i - 1].createdAt >= n.createdAt));
  const someN = nall.body[0];
  expectStatus(await S1.patch(`/notifications/${someN.id}/read`), 404, 'mark other user notification');
  s = await snapS();
  expectStatus(await NA2.patch(`/notifications/${someN.id}/read`), 200, 'mark own notification');
  await settle();
  check('notification:read ids to owner', got(s, NA2, 'notification:read', (p) => p.ids?.includes(someN.id)));
  expectStatus(await NA2.post('/notifications/read-by-query', {}), 400, 'read-by-query missing queryId');
  const rbq = await NA2.post('/notifications/read-by-query', { queryId: Q1.id });
  check('read-by-query returns updated count', rbq.status === 200 && typeof rbq.body.updated === 'number');
  const rall = await NA2.post('/notifications/read-all');
  check('read-all', rall.status === 200 && (await NA2.get('/notifications')).body.every((n) => n.isRead));
  const rall2 = await NA2.post('/notifications/read-all');
  check('read-all again -> 0', rall2.body.updated === 0);

  // ===================================================================== 7
  sec('7. Articles');
  const art = { title: 'QA Article ✍️', description: 'desc', coverImage: 'https://example.com/c.png', category: 'Guides', tags: ['a', 'b'],
    content: '<p onclick="x()">Hi <script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://ok.test">ok</a><img src="x" onerror="alert(1)"><iframe src="https://e"></iframe><span style="color:red;position:fixed">c</span></p>' };
  expectStatus(await S1.post('/articles', art), 403, 'student creates article');
  expectStatus(await anon.post('/articles', art), 401, 'anon creates article');
  expectStatus(await NA1.post('/articles', { ...art, title: 'ab' }), 400, 'title too short');
  expectStatus(await NA1.post('/articles', { ...art, coverImage: 'http://x' }), 400, 'cover http rejected');
  expectStatus(await NA1.post('/articles', { ...art, content: undefined }), 400, 'missing content');
  expectStatus(await NA1.post('/articles', { ...art, readTimeMinutes: 0 }), 400, 'readTime 0');
  s = await snapS();
  const ar = await NA1.post('/articles', { ...art, authorId: SA.uid, viewsCount: 999 });
  expectStatus(ar, 201, 'NA1 creates article');
  const A = ar.body;
  check('author from session', A.authorId === NA1.uid, A.authorId);
  check('viewsCount not settable', !A.viewsCount, A.viewsCount);
  check('sanitized: no script/onclick/javascript:/onerror/iframe', !/script|onclick|javascript:|onerror|iframe/i.test(A.content), A.content);
  check('sanitized: safe link kept with rel', /href="https:\/\/ok.test"/.test(A.content) && /noopener/.test(A.content), A.content);
  check('sanitized: disallowed style dropped, color kept', /color:red/.test(A.content) && !/position/.test(A.content), A.content);
  check('readTime estimated >=1', A.readTimeMinutes >= 1);
  await settle();
  check('data:changed articles broadcast to all incl. anon-ish students', got(s, S2, 'data:changed', (p) => p.resource === 'articles'));
  check('GET /articles includes it (anon)', (await anon.get('/articles')).body.some((x) => x.id === A.id));
  expectStatus(await anon.get(`/articles/${A.id}`), 200, 'GET article anon');
  expectStatus(await anon.get('/articles/nope'), 404, 'GET unknown article');
  expectStatus(await NA2.patch(`/articles/${A.id}`, { title: 'hijack' }), 403, 'other normal admin edits');
  expectStatus(await S1.patch(`/articles/${A.id}`, { title: 'hijack' }), 403, 'student edits');
  const pt = await NA1.patch(`/articles/${A.id}`, { title: 'QA Article edited' });
  expectStatus(pt, 200, 'author partial edit');
  check('partial edit keeps description/category/tags', pt.body.description === 'desc' && pt.body.category === 'Guides' && JSON.stringify(pt.body.tags) === '["a","b"]', { d: pt.body.description, c: pt.body.category, t: pt.body.tags });
  check('partial edit keeps content', pt.body.content === A.content);
  const pt2 = await EA.patch(`/articles/${A.id}`, { content: '<b>x</b><script>y</script>' });
  check('manager edits + sanitizes', pt2.status === 200 && pt2.body.content === '<b>x</b>', pt2.body.content);
  expectStatus(await NA1.patch(`/articles/${A.id}`, { title: 'x' }), 400, 'partial edit validation');
  expectStatus(await NA1.patch(`/articles/nope`, { title: 'xxxx' }), 404, 'edit unknown article');
  // likes
  expectStatus(await anon.post(`/articles/${A.id}/like`, { liked: true }), 401, 'anon like');
  expectStatus(await S1.post(`/articles/${A.id}/like`, { liked: 'yes' }), 400, 'like bad body');
  expectStatus(await S1.post(`/articles/nope/like`, { liked: true }), 404, 'like unknown');
  await S1.post(`/articles/${A.id}/like`, { liked: true });
  const lk = await S1.post(`/articles/${A.id}/like`, { liked: true });
  check('like idempotent', lk.body.likesCount === 1 && JSON.stringify(lk.body.likedBy) === JSON.stringify([S1.uid]), lk.body);
  const lk2 = await S2.post(`/articles/${A.id}/like`, { liked: true });
  check('second user like -> 2', lk2.body.likesCount === 2);
  await S1.post(`/articles/${A.id}/like`, { liked: false });
  const lk3 = await S1.post(`/articles/${A.id}/like`, { liked: false });
  check('unlike idempotent -> 1', lk3.body.likesCount === 1 && lk3.body.likedBy[0] === S2.uid, lk3.body);
  const [pl1, pl2] = await Promise.all([NA2.post(`/articles/${A.id}/like`, { liked: true }), NA2.post(`/articles/${A.id}/like`, { liked: true })]);
  check('parallel like counts once', pl1.status === 200 && pl2.status === 200 && (await anon.get(`/articles/${A.id}`)).body.likesCount === 2);
  // views
  const v1 = await S1.post(`/articles/${A.id}/view`);
  const v2 = await S1.post(`/articles/${A.id}/view`);
  check('view counted once per user per hour', v1.body.viewsCount === 1 && v2.body.viewsCount === 1, [v1.body, v2.body]);
  const v3 = await anon.post(`/articles/${A.id}/view`);
  const v4 = await anon.post(`/articles/${A.id}/view`);
  check('anon view counted once per IP', v3.body.viewsCount === 2 && v4.body.viewsCount === 2, [v3.body, v4.body]);
  expectStatus(await anon.post('/articles/nope/view'), 404, 'view unknown article');
  // saved articles
  s = await snapS();
  expectStatus(await S1.put(`/saved-articles/${A.id}`), 200, 'save article');
  expectStatus(await S1.put(`/saved-articles/${A.id}`), 200, 'save article twice');
  await settle();
  check('saved-articles data:changed only to S1', got(s, S1, 'data:changed', (p) => p.resource === 'saved-articles') && !got(s, S2, 'data:changed', (p) => p.resource === 'saved-articles'));
  check('saved list has A once', JSON.stringify((await S1.get('/saved-articles')).body.filter((x) => x === A.id)) === JSON.stringify([A.id]));
  expectStatus(await S1.put('/saved-articles/nope'), 404, 'save unknown article');
  expectStatus(await S1.del('/saved-articles/nope'), 200, '[behavior] unsave unknown article is a no-op 200');
  // delete
  expectStatus(await NA2.del(`/articles/${A.id}`), 403, 'other admin delete');
  const ar2 = await NA2.post('/articles', { ...art, title: 'NA2 article' });
  expectStatus(await SA.del(`/articles/${ar2.body.id}`), 200, 'manager deletes others article');
  expectStatus(await NA1.del(`/articles/${A.id}`), 200, 'author deletes');
  expectStatus(await anon.get(`/articles/${A.id}`), 404, 'deleted article 404');
  check('saved list cleaned by cascade', !(await S1.get('/saved-articles')).body.includes(A.id));
  expectStatus(await NA1.del(`/articles/${A.id}`), 404, 'delete again');

  // ===================================================================== 8
  sec('8. Reviews');
  const rvBody = { studentName: 'Guest Reviewer', rating: 5, ratingFeedback: 'Excellent platform!' };
  s = await snapS();
  const g = await anon.post('/platform-reviews', rvBody, RIP);
  expectStatus(g, 201, 'guest review');
  check('guest review pending', g.body.pending === true && g.body.status === 'pending', g.body);
  await settle();
  expectSock(s, 'guest review', 'notification:new', (p) => p.type === 'platform_review', [SA], [EA, S1, NA1]);
  check('pending review not public', !(await anon.get('/reviews')).body.some((r) => r.id === g.body.id));
  const sr = await S1.post('/platform-reviews', { ...rvBody, studentName: 'S1 名前' }, RIP);
  check('student review active', sr.status === 201 && sr.body.pending === false && sr.body.status === 'active', sr.body);
  check('student review public', (await anon.get('/reviews')).body.some((r) => r.id === sr.body.id));
  const inv = await anon.post('/platform-reviews', { ...rvBody, ratingFeedback: 'bad' }, RIP);
  expectStatus(inv, 400, 'review feedback too short');
  const third = await anon.post('/platform-reviews', { ...rvBody, studentName: 'Third valid' }, RIP);
  check('a rejected (400) review must not consume the 3/day quota -> 3rd valid review accepted', third.status === 201, third.status);
  const fourth = await anon.post('/platform-reviews', { ...rvBody, studentName: 'Fourth' }, RIP);
  expectStatus(fourth, 429, '4th review same IP');
  for (const [c, code] of [[S1, 403], [NA1, 403], [EA, 200], [SA, 200]]) expectStatus(await c.get('/admin/platform-reviews'), code, `admin platform reviews as ${c.name}`);
  const pend = await EA.get('/admin/platform-reviews?status=pending');
  check('?status=pending filter', pend.body.every((r) => r.status === 'pending') && pend.body.some((r) => r.id === g.body.id));
  expectStatus(await NA1.patch(`/admin/platform-reviews/${g.body.id}`, { status: 'active' }), 403, 'normal admin moderates');
  expectStatus(await EA.patch(`/admin/platform-reviews/${g.body.id}`, { status: 'deleted' }), 400, 'bad moderation status');
  expectStatus(await EA.patch('/admin/platform-reviews/nope', { status: 'active' }), 404, 'moderate unknown');
  s = await snapS();
  const ap = await EA.patch(`/admin/platform-reviews/${g.body.id}`, { status: 'active' });
  check('approve', ap.status === 200 && ap.body.status === 'active');
  await settle();
  check('approve broadcasts reviews change', got(s, S1, 'data:changed', (p) => p.resource === 'reviews'));
  check('approved review public', (await anon.get('/reviews')).body.some((r) => r.id === g.body.id));
  await EA.patch(`/admin/platform-reviews/${g.body.id}`, { status: 'hidden' });
  check('hidden review not public', !(await anon.get('/reviews')).body.some((r) => r.id === g.body.id));
  const pubRev = (await anon.get('/reviews')).body.find((r) => r.id === sr.body.id);
  check('public platform review hides studentEmail', pubRev && !('studentEmail' in pubRev));
  const al = await EA.get('/admin/audit-logs?limit=5');
  check('audit logs (EA) newest first, limit', al.status === 200 && al.body.length === 5 && al.body[0].timestamp >= al.body[4].timestamp, al.body?.length);
  check('audit has platform_review_hidden', (await SA.get('/admin/audit-logs')).body.some((x) => x.action === 'platform_review_hidden'));
  expectStatus(await NA1.get('/admin/audit-logs'), 403, 'normal admin audit logs');

  // ===================================================================== 9
  sec('9. Uploads');
  const u1 = await upload(S1, [{ name: 'a.png', type: 'image/png', data: PNG }, { name: 'résumé 📄.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4 test') }]);
  check('upload 2 files', u1.status === 200 && u1.body.files.length === 2 && /^\/api\/files\/[0-9a-f-]{36}$/.test(u1.body.files[0].url), u1.body);
  const fget = await anon.get(u1.body.files[0].url.replace('/api', ''), { raw: true });
  check('GET file anon by link', fget.status === 200 && fget.headers.get('content-type') === 'image/png' && fget.body.length === PNG.length, fget.status);
  const fr = await anon.get(u1.body.files[1].url.replace('/api', ''), { raw: true, headers: { range: 'bytes=0-3' } });
  check('Range request 206', fr.status === 206 && fr.body.toString() === '%PDF', [fr.status, fr.body.toString()]);
  check('unicode filename in disposition', /filename\*=UTF-8''r%C3%A9sum%C3%A9/.test(fr.headers.get('content-disposition') || ''), fr.headers.get('content-disposition'));
  expectStatus(await anon.get('/files/nope'), 404, 'unknown file');
  expectStatus(await upload(S1, [{ name: 'x.svg', type: 'image/svg+xml', data: Buffer.from('<svg/>') }]), 415, 'svg rejected');
  expectStatus(await upload(S1, [{ name: 'x.html', type: 'text/html', data: Buffer.from('<b>') }]), 415, 'html rejected');
  expectStatus(await upload(S1, [{ name: 'big.png', type: 'image/png', data: Buffer.alloc(10 * 1024 * 1024 + 1) }]), 413, '>10MB rejected');
  expectStatus(await S1.req('POST', '/uploads', new FormData()), 400, 'no files');
  const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.png`, type: 'image/png', data: PNG }));
  const u11 = await upload(S1, eleven);
  check('11 files -> 4xx (not 500)', u11.status >= 400 && u11.status < 500, { status: u11.status, body: u11.body });
  const wf = await upload(S1, [{ field: 'file', name: 'a.png', type: 'image/png', data: PNG }]);
  check('wrong multipart field name -> 4xx (not 500)', wf.status >= 400 && wf.status < 500, { status: wf.status, body: wf.body });
  // attach uploaded file to a message
  const att = await S1.post(`/queries/${QU.id}/messages`, { content: '', attachments: [u1.body.files[0]] });
  check('message with only attachment ok + preview', att.status === 201 && att.body.ticket.lastReplyPreview === '📎 File Attachment', att.body?.ticket?.lastReplyPreview);
  const voice = await S1.post(`/queries/${QU.id}/messages`, { audioUrl: u1.body.files[0].url, audioDuration: 3 });
  check('voice-only message', voice.status === 201 && voice.body.message.content === '🎤 Voice Message');
  expectStatus(await S1.post(`/queries/${QU.id}/messages`, { audioUrl: u1.body.files[0].url, audioDuration: 3601 }), 400, 'audio > 1h');

  // ===================================================================== 10
  sec('10. Drive');
  const dc = await S1.get('/drive/config');
  check('drive config', dc.status === 200 && dc.body.config === null && dc.body.apiConfigured === false, dc.body);
  expectStatus(await S1.post('/drive/config', { rootFolderId: 'abcdefghijkl' }), 403, 'student sets drive');
  expectStatus(await NA1.post('/drive/config', { rootFolderId: 'abcdefghijkl' }), 403, 'normal admin sets drive');
  expectStatus(await SA.post('/drive/config', {}), 400, 'drive config empty');
  expectStatus(await SA.post('/drive/config', { rootFolderId: 'abcdefghijkl' }), 503, 'drive not configured (no key)');
  expectStatus(await S1.get('/drive/folder-contents'), 404, 'folder-contents no root');
  expectStatus(await S1.get('/drive/file-stream?fileId=abcdefghijkl'), 503, 'file-stream no key');

  // ===================================================================== 11
  sec('11. Admin management: deactivate / delete / password / categories');
  // NA4 (catB) with an open ticket, deactivate with reassignToUid NA1
  const NA4 = new Client('NA4'), NA5 = new Client('NA5'), NA6 = new Client('NA6');
  await mkAdmin(EA, 'na4', 'normal_admin', { assignedCategories: [catB] });
  await mkAdmin(EA, 'na5', 'normal_admin', { assignedCategories: [catA] });
  await mkAdmin(EA, 'na6', 'normal_admin', { assignedCategories: [catA] });
  await login(NA4, `na4_${RUN}@qa.test`); await login(NA5, `na5_${RUN}@qa.test`); await login(NA6, `na6_${RUN}@qa.test`);
  await NA4.connect(); clients.push(NA4);
  const t4 = (await S2.post('/queries', { categoryId: catB, expertId: NA4.uid, title: 'for NA4', detail: 'x' })).body.ticket;
  const t4r = (await S1.post('/queries', { categoryId: catB, expertId: NA4.uid, title: 'resolved NA4', detail: 'x' })).body.ticket;
  await NA4.patch(`/queries/${t4r.id}/status`, { status: 'resolved' });
  expectStatus(await NA1.patch(`/admin/users/${NA4.uid}/status`, { status: 'deactivated' }), 403, 'normal admin deactivates');
  expectStatus(await EA.patch(`/admin/users/${SA.uid}/status`, { status: 'deactivated' }), 403, 'expert deactivates super admin');
  expectStatus(await EA.patch(`/admin/users/${EA.uid}/status`, { status: 'deactivated' }), 400, 'deactivate self');
  expectStatus(await EA.patch(`/admin/users/${NA4.uid}/status`, { status: 'paused' }), 400, 'bad status value');
  expectStatus(await EA.patch(`/admin/users/nobody/status`, { status: 'deactivated' }), 404, 'deactivate unknown');
  // invalid reassignToUid should fail atomically
  const badDeact = await EA.patch(`/admin/users/${NA4.uid}/status`, { status: 'deactivated', reassignToUid: S1.uid });
  expectStatus(badDeact, 400, 'deactivate with student as reassignToUid');
  const na4After = (await EA.get(`/users/${NA4.uid}`)).body;
  check('failed deactivation (400) leaves the admin active', na4After.status === 'active', na4After.status);
  check('failed deactivation leaves the admin signed in', (await NA4.get('/auth/me')).body.profile !== null);
  // reactivate in case the bug left NA4 deactivated, then re-login
  await EA.patch(`/admin/users/${NA4.uid}/status`, { status: 'active' });
  if (!(await NA4.get('/auth/me')).body.profile) { await login(NA4, `na4_${RUN}@qa.test`); NA4.socket?.close(); await NA4.connect(); }
  s = await snapS();
  const deact = await EA.patch(`/admin/users/${NA4.uid}/status`, { status: 'deactivated', reassignToUid: NA1.uid });
  expectStatus(deact, 200, 'deactivate NA4 -> NA1');
  check('reassignedCount 1 (resolved stays)', deact.body.reassignedCount === 1 && deact.body.profile.status === 'deactivated', deact.body);
  await settle();
  check('NA4 socket disconnected', got(s, NA4, '__disconnect'));
  check('NA4 session revoked', (await NA4.get('/auth/me')).body.profile === null);
  expectStatus(await login(new Client('x'), `na4_${RUN}@qa.test`), 403, 'deactivated login');
  const t4now = (await SA.get(`/queries/${t4.id}`)).body;
  check('open ticket handed to NA1', t4now.expertId === NA1.uid && t4now.assignmentStatus === 'assigned', t4now.expertId);
  check('resolved ticket stays with NA4', (await SA.get(`/queries/${t4r.id}`)).body.expertId === NA4.uid);
  check('NA1 assignment notification', got(s, NA1, 'notification:new', (p) => p.type === 'assignment'));
  check('hand-over: NA1 gets query:upsert', got(s, NA1, 'query:upsert', forQ(t4.id)));
  check('hand-over: student S2 gets query:upsert', got(s, S2, 'query:upsert', forQ(t4.id)));
  check('deactivated admin not in /admins for students', !(await S1.get('/admins')).body.some((u) => u.uid === NA4.uid));
  check('deactivated admin in /admins for managers', (await EA.get('/admins')).body.some((u) => u.uid === NA4.uid && u.status === 'deactivated'));
  expectStatus(await S1.post('/queries', { categoryId: catB, expertId: NA4.uid, title: 't', detail: 'x' }), 400, 'cannot ask deactivated counselor');
  // NA5 deactivate without replacement → unassigned queue (catA admins see it)
  const t5 = (await S2.post('/queries', { categoryId: catA, expertId: NA5.uid, title: 'for NA5', detail: 'x' })).body.ticket;
  s = await snapS();
  const d5 = await EA.patch(`/admin/users/${NA5.uid}/status`, { status: 'deactivated' });
  check('deactivate NA5 without replacement', d5.status === 200 && d5.body.reassignedCount === 1, d5.body);
  await settle();
  const t5now = (await SA.get(`/queries/${t5.id}`)).body;
  check('ticket back to unassigned queue', t5now.expertId === 'unassigned' && t5now.assignmentStatus === 'unassigned', t5now);
  check('unassigned hand-over clears expert title/avatar snapshot', !t5now.expertTitle, t5now.expertTitle);
  check('catA admin NA3 sees unassigned ticket + socket upsert', (await NA3.get('/queries-meta/unassigned')).body.some((q) => q.id === t5.id) && got(s, NA3, 'query:upsert', forQ(t5.id)));
  // reactivation
  const re5 = await EA.patch(`/admin/users/${NA5.uid}/status`, { status: 'active' });
  check('reactivate', re5.status === 200 && re5.body.profile.status === 'active');
  expectStatus(await login(NA5, `na5_${RUN}@qa.test`), 200, 'reactivated login');
  // student deactivation
  const S3 = new Client('S3');
  await S3.post('/auth/register', { ...regBase, fullName: 'Student Three', email: `s3_${RUN}@qa.test`, password: PW });
  const d3 = await EA.patch(`/admin/users/${S3.profile?.uid ?? (await S3.get('/auth/me')).body.profile.uid}/status`, { status: 'deactivated' });
  check('expert deactivates student', d3.status === 200 && d3.body.reassignedCount === 0);
  check('deactivated student session dead', (await S3.get('/auth/me')).body.profile === null);
  // password reset
  expectStatus(await EA.put(`/admin/users/${SA.uid}/password`, { newPassword: 'Another1!x' }), 403, 'expert resets super admin pw');
  expectStatus(await EA.put(`/admin/users/${EA.uid}/password`, { newPassword: 'Another1!x' }), 400, 'reset own pw');
  expectStatus(await EA.put(`/admin/users/${S2.uid}/password`, { newPassword: 'short' }), 400, 'reset short pw');
  expectStatus(await NA1.put(`/admin/users/${S2.uid}/password`, { newPassword: 'Another1!x' }), 403, 'normal admin resets pw');
  expectStatus(await EA.put(`/admin/users/nobody/password`, { newPassword: 'Another1!x' }), 404, 'reset unknown');
  s = await snapS();
  const rp = await EA.put(`/admin/users/${S2.uid}/password`, { newPassword: 'Another1!x' });
  check('reset S2 pw', rp.status === 200 && rp.body.success && /Student Two/.test(rp.body.message), rp.body);
  await settle();
  check('S2 signed out everywhere', (await S2.get('/auth/me')).body.profile === null && got(s, S2, '__disconnect'));
  expectStatus(await login(S2, `s2_${RUN}@qa.test`, PW), 401, 'old pw rejected');
  expectStatus(await login(S2, `s2_${RUN}@qa.test`, 'Another1!x'), 200, 'new pw works');
  check('mustChangePassword after reset', S2.profile.mustChangePassword === true);
  // delete admin NA6 with resolved + open ticket, reassignToUid NA3
  const t6open = (await S1.post('/queries', { categoryId: catA, expertId: NA6.uid, title: 'NA6 open', detail: 'x' })).body.ticket;
  const t6res = (await S2.post('/queries', { categoryId: catA, expertId: NA6.uid, title: 'NA6 resolved', detail: 'x' })).body.ticket;
  await NA6.post(`/queries/${t6res.id}/messages`, { content: 'done' });
  await NA6.patch(`/queries/${t6res.id}/status`, { status: 'resolved' });
  expectStatus(await NA1.del(`/admin/admins/${NA6.uid}`), 403, 'normal admin deletes admin');
  expectStatus(await EA.del(`/admin/admins/${SA.uid}`), 403, 'expert deletes super admin');
  expectStatus(await EA.del(`/admin/admins/${EA.uid}`), 400, 'delete self');
  expectStatus(await EA.del(`/admin/admins/${S1.uid}`), 400, 'delete student via admin route');
  expectStatus(await EA.del('/admin/admins/nobody'), 404, 'delete unknown admin');
  expectStatus(await EA.del(`/admin/admins/${NA6.uid}?reassignToUid=${S1.uid}`), 400, 'delete with invalid reassignToUid');
  check('NA6 still exists after failed delete', (await EA.get(`/users/${NA6.uid}`)).status === 200);
  const del6 = await EA.del(`/admin/admins/${NA6.uid}?reassignToUid=${NA3.uid}`);
  check('delete NA6', del6.status === 200 && del6.body.success, del6.body);
  expectStatus(await EA.get(`/users/${NA6.uid}`), 404, 'deleted admin gone');
  check('open ticket moved to NA3', (await SA.get(`/queries/${t6open.id}`)).body.expertId === NA3.uid);
  const t6r = (await SA.get(`/queries/${t6res.id}`)).body;
  check('resolved ticket keeps expertName snapshot', t6r.expertName === `QA NA6`, t6r.expertName);
  check('resolved ticket of deleted admin must NOT appear in the unassigned queue', !(await NA1.get('/queries-meta/unassigned')).body.some((q) => q.id === t6res.id), { expertId: t6r.expertId, assignmentStatus: t6r.assignmentStatus });
  const claimOld = await NA1.post(`/queries/${t6res.id}/messages`, { content: 'claiming a resolved orphan' });
  check('category admin should not be able to "claim" a deleted admin\'s resolved ticket', claimOld.status !== 201, claimOld.status);
  check('category assignments of deleted admin removed', !(await SA.get('/categories')).body.find((c) => c.id === catA).assignedAdminIds.includes(NA6.uid));
  // last super admin protection with a second SA
  const cSA2 = await mkAdmin(SA, 'sa2', 'super_admin');
  expectStatus(cSA2, 201, 'SA creates SA2');
  const SA2 = new Client('SA2'); await login(SA2, `sa2_${RUN}@qa.test`);
  const dem = await SA.patch(`/admin/admins/${SA2.uid}`, { role: 'expert_admin' });
  check('SA demotes SA2 (another super remains)', dem.status === 200 && dem.body.profile.role === 'expert_admin', dem.body);
  expectStatus(await SA2.del(`/admin/admins/${SA.uid}`), 403, 'demoted SA2 (now expert) cannot delete SA');
  expectStatus(await SA.patch(`/admin/admins/${SA2.uid}`, { role: 'super_admin' }), 200, 'promote SA2 back');
  await login(SA2, `sa2_${RUN}@qa.test`);
  expectStatus(await SA2.patch(`/admin/users/${SA.uid}/status`, { status: 'deactivated' }), 200, 'SA2 deactivates SA (SA2 remains)');
  expectStatus(await SA2.patch(`/admin/admins/${SA2.uid}`, { role: 'normal_admin' }), 400, 'SA2 is now last active super admin: cannot demote self');
  await SA2.patch(`/admin/users/${SA.uid}/status`, { status: 'active' });
  await login(SA, SA_EMAIL, SA_PASSWORD);
  expectStatus(await SA.del(`/admin/admins/${SA2.uid}`), 200, 'SA deletes SA2');
  expectStatus(await SA.del(`/admin/admins/${SA.uid}`), 400, 'cannot delete self (last super)');
  // categories delete
  expectStatus(await SA.del(`/admin/categories/${catB}`), 409, 'delete category with tickets');
  expectStatus(await NA1.del(`/admin/categories/${catE}`), 403, 'normal admin deletes category');
  s = await snapS();
  expectStatus(await EA.del(`/admin/categories/${catE}`), 200, 'delete empty category');
  await settle();
  check('category delete broadcasts categories', got(s, S1, 'data:changed', (p) => p.resource === 'categories'));
  expectStatus(await EA.del(`/admin/categories/${catE}`), 404, 'delete category again');
  // stats after activity
  const stats = await EA.get('/admin/stats/replies-24h');
  check('replies-24h counts NA2 replies', stats.body[NA2.uid] >= 1, stats.body);
  check('replies-24h excludes system messages (null sender)', !('null' in stats.body) && !('' in stats.body), stats.body);

  // ===================================================================== done
  for (const c of clients) c.socket?.close();
  console.log(`\nChecks: ${passed + failures.length}, passed: ${passed}, failed: ${failures.length}`);
  for (const f of failures) console.log(`- [${f.section}] ${f.name}`);
  process.exit(0);
}

main().catch((e) => { console.error('CRASH', e); console.log(`passed ${passed}, failed ${failures.length}`); process.exit(1); });
