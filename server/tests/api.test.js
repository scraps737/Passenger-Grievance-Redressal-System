/**
 * End-to-end API tests. These run against a real MongoDB instance using an
 * isolated test database — no mocking of the database or the AI engine.
 *
 *   npm --workspace server test
 */
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/grievanceai_test';
process.env.JWT_SECRET = 'integration-test-secret-integration-test-secret';
process.env.AI_PROVIDER = 'none';
process.env.UPLOAD_DIR = 'uploads-test';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

const { createApp } = await import('../src/app.js');
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.js');
const { Department } = await import('../src/models/Department.js');
const { Grievance } = await import('../src/models/Grievance.js');
const { Notification } = await import('../src/models/Notification.js');
const { TimelineEvent } = await import('../src/models/TimelineEvent.js');
const { Message } = await import('../src/models/Message.js');
const { Feedback } = await import('../src/models/Feedback.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { Setting } = await import('../src/models/Setting.js');

const app = createApp();
const api = request(app);

const state = {};

async function wipe() {
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Grievance.deleteMany({}),
    Notification.deleteMany({}),
    TimelineEvent.deleteMany({}),
    Message.deleteMany({}),
    Feedback.deleteMany({}),
    AuditLog.deleteMany({}),
    Setting.deleteMany({}),
  ]);
}

before(async () => {
  await connectDatabase(process.env.MONGODB_URI);
  await wipe();

  state.dept = await Department.create({
    name: 'Electrical & HVAC Systems',
    code: 'ELEC',
    categories: ['electrical_hvac'],
    slaHours: { tier1: 4, tier2: 12, tier3: 48 },
    capacity: 10,
  });
  state.otherDept = await Department.create({
    name: 'Cleanliness & Sanitation',
    code: 'OBHS',
    categories: ['cleanliness'],
    slaHours: { tier1: 6, tier2: 24, tier3: 72 },
    capacity: 10,
  });

  state.admin = await User.create({
    name: 'Test Admin',
    email: 'admin@test.local',
    password: 'Admin@12345',
    role: 'admin',
  });
  state.officer = await User.create({
    name: 'Test Officer',
    email: 'officer@test.local',
    password: 'Officer@12345',
    role: 'officer',
    department: state.dept._id,
    designation: 'SSE Electrical',
  });
  state.outsiderOfficer = await User.create({
    name: 'Other Wing Officer',
    email: 'other@test.local',
    password: 'Officer@12345',
    role: 'officer',
    department: state.otherDept._id,
  });
  state.passengerA = await User.create({
    name: 'Passenger A',
    email: 'a@test.local',
    password: 'Passenger@123',
    role: 'passenger',
  });
  state.passengerB = await User.create({
    name: 'Passenger B',
    email: 'b@test.local',
    password: 'Passenger@123',
    role: 'passenger',
  });
});

after(async () => {
  await wipe();
  await disconnectDatabase();
});

async function login(email, password) {
  const res = await api.post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

describe('health & engine transparency', () => {
  it('reports database and AI engine status honestly', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'connected');
    assert.equal(res.body.ai.configured, false);
    assert.equal(res.body.ai.engine, 'rule-based-fallback');
  });
});

describe('authentication', () => {
  it('registers a passenger and rejects weak input', async () => {
    const bad = await api.post('/api/auth/register').send({ name: 'X', email: 'nope', password: 'short' });
    assert.equal(bad.status, 400);
    assert.ok(Array.isArray(bad.body.details));

    const ok = await api.post('/api/auth/register').send({
      name: 'New Passenger',
      email: 'new@test.local',
      password: 'Passw0rd1',
    });
    assert.equal(ok.status, 201);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.role, 'passenger');
    assert.equal(ok.body.user.password, undefined, 'password must never be returned');
  });

  it('cannot self-register as an officer or admin', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Sneaky User',
      email: 'sneaky@test.local',
      password: 'Passw0rd1',
      role: 'admin',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'passenger', 'role escalation on signup must be ignored');
  });

  it('rejects a wrong password and missing token', async () => {
    const bad = await api.post('/api/auth/login').send({ email: 'a@test.local', password: 'wrong' });
    assert.equal(bad.status, 401);
    const noToken = await api.get('/api/grievances');
    assert.equal(noToken.status, 401);
  });
});

describe('grievance submission and AI triage', () => {
  it('creates a grievance with a unique reference and labelled triage', async () => {
    state.passengerToken = await login('a@test.local', 'Passenger@123');
    const res = await api
      .post('/api/grievances')
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({
        subject: 'AC thermostat blowing freezing air in coach B-4',
        description:
          'The air conditioner above berths 28 and 29 is blowing sub-15 degree air continuously. The attendant did not respond and elderly passengers are shivering badly.',
        trainNumber: '12952',
        coach: 'B-4',
        berth: '28',
        station: 'Ratlam',
        transportMode: 'rail',
      });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    state.grievanceId = res.body.grievance._id;
    state.referenceId = res.body.grievance.referenceId;

    assert.match(state.referenceId, /^GAI-\d{4}-[0-9A-F]+$/);
    assert.equal(res.body.grievance.category, 'electrical_hvac');
    assert.ok(['tier1', 'tier2'].includes(res.body.grievance.priority));
    assert.ok(res.body.grievance.sla.dueAt, 'SLA deadline must be derived');
    assert.equal(res.body.triage.engine, 'rule-based-fallback');
    assert.equal(res.body.triage.degraded, true, 'fallback must be flagged, not disguised as AI');
    assert.ok(res.body.grievance.department, 'a department must be routed from triage');
  });

  it('accepts a multipart submission with evidence and keeps the file private', async () => {
    const res = await api
      .post('/api/grievances')
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .field('subject', 'Charging socket sparking at berth 18')
      .field(
        'description',
        'The socket beside berth 18 sparked when the charger was plugged in. The circuit is still live and could start a fire.'
      )
      .field('coach', 'C-2')
      .field('berth', '18')
      // FormData stringifies this, which the validator must still accept.
      .field('runAiTriage', 'true')
      .attach('evidence', Buffer.from('evidence fixture'), 'berth18.txt');

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.grievance.attachments.length, 1);
    assert.equal(res.body.grievance.attachments[0].originalName, 'berth18.txt');
    assert.equal(res.body.triage.engine, 'rule-based-fallback');

    const grievanceId = res.body.grievance._id;
    const attachmentId = res.body.grievance.attachments[0]._id;

    const owner = await api
      .get(`/api/grievances/${grievanceId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${state.passengerToken}`);
    assert.equal(owner.status, 200);
    assert.equal(owner.text, 'evidence fixture');

    const tokenB = await login('b@test.local', 'Passenger@123');
    const outsider = await api
      .get(`/api/grievances/${grievanceId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(outsider.status, 403, 'attachments must never leak to other passengers');

    const anonymous = await api.get(`/api/grievances/${grievanceId}/attachments/${attachmentId}`);
    assert.equal(anonymous.status, 401);
  });

  it('validates that description is substantive', async () => {
    const res = await api
      .post('/api/grievances')
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({ subject: 'Too short', description: 'bad' });
    assert.equal(res.status, 400);
  });

  it('supports public tracking by reference without leaking personal data', async () => {
    const res = await api.get(`/api/grievances/track/${state.referenceId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.tracking.referenceId, state.referenceId);
    assert.equal(res.body.tracking.passenger, undefined);
    assert.equal(res.body.tracking.passengerEmail, undefined);
    assert.ok(res.body.tracking.steps.length > 0);
  });
});

describe('passenger isolation (RBAC)', () => {
  it('only lists the caller own grievances', async () => {
    const tokenB = await login('b@test.local', 'Passenger@123');
    const resB = await api.get('/api/grievances').set('Authorization', `Bearer ${tokenB}`);
    assert.equal(resB.status, 200);
    assert.equal(resB.body.pagination.total, 0, 'passenger B must not see passenger A records');

    const resA = await api.get('/api/grievances').set('Authorization', `Bearer ${state.passengerToken}`);
    assert.ok(resA.body.pagination.total >= 1, 'passenger A must see their own records');
    for (const item of resA.body.items) {
      assert.equal(
        String(item.passenger?._id || item.passenger),
        String(state.passengerA._id),
        'every listed grievance must belong to the caller'
      );
    }
  });

  it('blocks reading another passenger grievance', async () => {
    const tokenB = await login('b@test.local', 'Passenger@123');
    const res = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 403);
  });

  it('blocks passengers from officer and admin surfaces', async () => {
    const headers = { Authorization: `Bearer ${state.passengerToken}` };
    for (const path of ['/api/analytics/overview', '/api/users', '/api/settings', '/api/analytics/ai-insights']) {
      const res = await api.get(path).set(headers);
      assert.equal(res.status, 403, `${path} must be forbidden for passengers`);
    }
  });
});

describe('officer workflow', () => {
  before(async () => {
    state.officerToken = await login('officer@test.local', 'Officer@12345');
    state.adminToken = await login('admin@test.local', 'Admin@12345');
  });

  it('lets the owning department officer see the case', async () => {
    const res = await api.get('/api/grievances').set('Authorization', `Bearer ${state.officerToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((g) => g._id === state.grievanceId));
  });

  it('hides the case from an officer in an unrelated wing', async () => {
    const token = await login('other@test.local', 'Officer@12345');
    const list = await api.get('/api/grievances').set('Authorization', `Bearer ${token}`);
    assert.ok(!list.body.items.some((g) => g._id === state.grievanceId));
    const direct = await api.get(`/api/grievances/${state.grievanceId}`).set('Authorization', `Bearer ${token}`);
    assert.equal(direct.status, 403);
  });

  it('assigns the case to itself and records a timeline event', async () => {
    const res = await api
      .post(`/api/grievances/${state.grievanceId}/assign`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ officerId: String(state.officer._id), reason: 'Within my wing' });
    assert.equal(res.status, 200);
    assert.equal(res.body.grievance.status, 'assigned');

    const detail = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${state.officerToken}`);
    assert.ok(detail.body.timeline.some((e) => e.type === 'assigned'));
  });

  it('requests clarification, then the passenger answers and reopens progress', async () => {
    const req1 = await api
      .post(`/api/grievances/${state.grievanceId}/messages`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ body: 'Is the cold draft at berth 28 or from the gangway?', kind: 'clarification_request' });
    assert.equal(req1.status, 201);

    let detail = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${state.officerToken}`);
    assert.equal(detail.body.grievance.status, 'awaiting_clarification');

    const reply = await api
      .post(`/api/grievances/${state.grievanceId}/messages`)
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({ body: 'Directly above berth 28.', kind: 'clarification_response' });
    assert.equal(reply.status, 201);

    detail = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${state.officerToken}`);
    assert.equal(detail.body.grievance.status, 'in_progress');
  });

  it('prevents a passenger from forging a clarification request', async () => {
    const res = await api
      .post(`/api/grievances/${state.grievanceId}/messages`)
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({ body: 'pretend', kind: 'clarification_request' });
    assert.equal(res.status, 201, 'request is accepted but downgraded');
    const detail = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${state.officerToken}`);
    assert.equal(detail.body.messages.at(-1).kind, 'message', 'kind must be downgraded for passengers');
  });

  it('escalates the grievance and raises the audit severity', async () => {
    const res = await api
      .post(`/api/grievances/${state.grievanceId}/escalate`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ reason: 'Passenger welfare at risk; escalating to DRM office' });
    assert.equal(res.status, 200);
    assert.equal(res.body.grievance.escalation.level, 1);
    assert.equal(res.body.grievance.status, 'escalated');
  });

  it('allows an authorised officer to override the AI recommendation', async () => {
    const res = await api
      .post(`/api/grievances/${state.grievanceId}/triage/override`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ priority: 'tier1', slaHours: 4, reason: 'Vulnerable passengers confirmed onboard' });
    assert.equal(res.status, 200);
    assert.equal(res.body.grievance.priority, 'tier1');
    assert.equal(res.body.grievance.sla.hours, 4);

    const detail = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${state.officerToken}`);
    assert.equal(detail.body.grievance.aiTriage.overrideReason, 'Vulnerable passengers confirmed onboard');
    assert.ok(detail.body.grievance.aiTriage.original, 'the original recommendation must be preserved');
  });
});

describe('resolution with dual verification', () => {
  it('refuses resolution before an OTP is generated', async () => {
    const res = await api
      .post(`/api/grievances/${state.grievanceId}/resolve`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ notes: 'Thermostat recalibrated on ground.' });
    assert.equal(res.status, 400);
  });

  it('generates an OTP delivered to the passenger stream', async () => {
    const res = await api
      .post(`/api/grievances/${state.grievanceId}/resolution-otp`)
      .set('Authorization', `Bearer ${state.officerToken}`);
    assert.equal(res.status, 200);
    assert.match(res.body.deliveryChannel, /in-app/);

    const notes = await api.get('/api/notifications').set('Authorization', `Bearer ${state.passengerToken}`);
    const match = notes.body.items
      .map((n) => n.title.match(/Resolution verification code: (\d{4})/))
      .find(Boolean);
    assert.ok(match, 'passenger must receive the verification code');
    state.otp = match[1];
  });

  it('rejects an incorrect OTP and accepts the correct one', async () => {
    const bad = await api
      .post(`/api/grievances/${state.grievanceId}/resolve`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ notes: 'Trying with wrong code', otp: '0000' });
    assert.equal(bad.status, 400);

    const ok = await api
      .post(`/api/grievances/${state.grievanceId}/resolve`)
      .set('Authorization', `Bearer ${state.officerToken}`)
      .send({ notes: 'Thermostat recalibrated; verified with passenger.', otp: state.otp });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.grievance.status, 'resolved');
    assert.equal(ok.body.grievance.resolution.otpVerified, true);
  });

  it('accepts feedback once, then rejects duplicates', async () => {
    const first = await api
      .post(`/api/grievances/${state.grievanceId}/feedback`)
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({ rating: 5, comment: 'Quick response, issue fixed.' });
    assert.equal(first.status, 201);

    const second = await api
      .post(`/api/grievances/${state.grievanceId}/feedback`)
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({ rating: 1, comment: 'Duplicate' });
    assert.equal(second.status, 409);
  });

  it('blocks another passenger from rating the case', async () => {
    const tokenB = await login('b@test.local', 'Passenger@123');
    const other = await api
      .post('/api/grievances')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        subject: 'Coach washroom not cleaned for the whole journey',
        description: 'The washroom in coach B-4 was soiled with no water and staff did not visit at all.',
      });
    assert.equal(other.status, 201);
    const res = await api
      .post(`/api/grievances/${other.body.grievance._id}/feedback`)
      .set('Authorization', `Bearer ${state.passengerToken}`)
      .send({ rating: 5, comment: 'not mine' });
    assert.equal(res.status, 403);
  });
});

describe('admin surfaces', () => {
  it('computes analytics from stored records', async () => {
    const res = await api.get('/api/analytics/overview?range=90d').set('Authorization', `Bearer ${state.adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.kpis.total >= 2);
    assert.ok(res.body.byCategory.length >= 1);
    assert.ok(res.body.kpis.slaCompliance <= 100 && res.body.kpis.slaCompliance > 0);
    assert.ok(Array.isArray(res.body.trend));
  });

  it('exposes AI insights without fabricating a provider', async () => {
    const res = await api
      .get('/api/analytics/ai-insights')
      .set('Authorization', `Bearer ${state.adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.engine.configured, false);
    assert.equal(res.body.engine.engine, 'rule-based-fallback');
    assert.ok(res.body.categories.length >= 1);
  });

  it('only lets the owner department read the case, but an admin sees everything', async () => {
    const adminView = await api
      .get(`/api/grievances/${state.grievanceId}`)
      .set('Authorization', `Bearer ${state.adminToken}`);
    assert.equal(adminView.status, 200);
    assert.equal(adminView.body.grievance.referenceId, state.referenceId);
  });

  it('updates configurable SLA rules and records an audit entry', async () => {
    const res = await api
      .patch('/api/settings')
      .set('Authorization', `Bearer ${state.adminToken}`)
      .send({ slaRules: { tier1: 3, tier2: 20, tier3: 60 } });
    assert.equal(res.status, 200);
    assert.ok(res.body.updated.includes('slaRules'));

    const logs = await api.get('/api/settings/audit-logs').set('Authorization', `Bearer ${state.adminToken}`);
    assert.equal(logs.status, 200);
    assert.ok(logs.body.items.some((l) => l.action === 'settings.updated'));
    assert.ok(logs.body.items.some((l) => l.action === 'grievance.resolved'));
  });

  it('manages users and departments', async () => {
    const created = await api
      .post('/api/users')
      .set('Authorization', `Bearer ${state.adminToken}`)
      .send({
        name: 'New Officer',
        email: 'newofficer@test.local',
        password: 'Officer@12345',
        role: 'officer',
        department: String(state.dept._id),
      });
    assert.equal(created.status, 201);

    const listed = await api.get('/api/users?role=officer').set('Authorization', `Bearer ${state.adminToken}`);
    assert.ok(listed.body.items.some((u) => u.email === 'newofficer@test.local'));
    assert.ok(listed.body.roleCounts.officer >= 3);

    const dept = await api
      .post('/api/departments')
      .set('Authorization', `Bearer ${state.adminToken}`)
      .send({ name: 'Ticket Verification Cell', code: 'TVC', categories: ['ticketing_refund'] });
    assert.equal(dept.status, 201);

    const deptList = await api.get('/api/departments').set('Authorization', `Bearer ${state.adminToken}`);
    assert.ok(deptList.body.departments.every((d) => d.metrics !== undefined), 'metrics must be derived');
  });

  it('exports a CSV of grievances', async () => {
    const res = await api.get('/api/grievances/export/csv').set('Authorization', `Bearer ${state.adminToken}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text.split('\n')[0], /referenceId/);
  });
});
