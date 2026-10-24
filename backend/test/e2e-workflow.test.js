const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const BloodUnit = require('../src/models/BloodUnit');
const BloodRequest = require('../src/models/BloodRequest');
const EmergencyTransfer = require('../src/models/EmergencyTransfer');

describe('Full Vein-to-Vein End-to-End Supply Chain Lifecycle Test', () => {
  let adminToken, bbToken, hospToken, hosp2Token, donorToken;
  let donorRefId;
  const e2eUnitId = 'BLD-E2E-9999';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await User.deleteMany({});
    await BloodUnit.deleteMany({});
    await BloodRequest.deleteMany({});
    await EmergencyTransfer.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('Step 1: Admin setup & organization approvals', async () => {
    // Register Admin
    const adminUser = await User.create({
      username: 'e2e_admin',
      email: 'admin@e2e.org',
      password: 'AdminPassword123!',
      role: 'admin',
      isApproved: true,
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'admin@e2e.org', password: 'AdminPassword123!' });
    adminToken = adminLogin.body.token;

    // Register Blood Bank
    const bbReg = await request(app)
      .post('/api/auth/register-organization')
      .send({
        username: 'e2e_bloodbank',
        email: 'bb@e2e.org',
        password: 'Password123!',
        role: 'blood_bank',
        organizationName: 'E2E Blood Center',
        licenseNumber: 'E2E-BB-101',
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      });
    expect(bbReg.status).toBe(201);

    // Admin approves Blood Bank
    await request(app)
      .put(`/api/auth/users/${bbReg.body.userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approve: true });

    // Blood bank logs in
    const bbLogin = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'bb@e2e.org', password: 'Password123!' });
    bbToken = bbLogin.body.token;

    // Register Hospital 1
    const h1Reg = await request(app)
      .post('/api/auth/register-organization')
      .send({
        username: 'e2e_hosp1',
        email: 'h1@e2e.org',
        password: 'Password123!',
        role: 'hospital',
        organizationName: 'E2E General Hospital',
        licenseNumber: 'E2E-H1-201',
        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      });
    await request(app)
      .put(`/api/auth/users/${h1Reg.body.userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approve: true });

    const h1Login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'h1@e2e.org', password: 'Password123!' });
    hospToken = h1Login.body.token;

    // Register Hospital 2 (for emergency transfer)
    const h2Reg = await request(app)
      .post('/api/auth/register-organization')
      .send({
        username: 'e2e_hosp2',
        email: 'h2@e2e.org',
        password: 'Password123!',
        role: 'hospital',
        organizationName: 'E2E St. Jude Hospital',
        licenseNumber: 'E2E-H2-202',
        walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      });
    await request(app)
      .put(`/api/auth/users/${h2Reg.body.userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approve: true });

    const h2Login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'h2@e2e.org', password: 'Password123!' });
    hosp2Token = h2Login.body.token;
  });

  test('Step 2: Voluntary Donor registers with separated PII', async () => {
    const regRes = await request(app)
      .post('/api/auth/register-donor')
      .send({
        username: 'clara_donor',
        email: 'clara@e2e.org',
        password: 'Password123!',
        fullName: 'Clara Oswald',
        dateOfBirth: '1995-11-23',
        gender: 'Female',
        bloodGroup: 'O+',
        phoneNumber: '+1-555-1234',
        emotionDetected: 'Calm',
        affectiveConsentStatus: 'true',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.user.donorRefId).toBeDefined();
    donorRefId = regRes.body.user.donorRefId;
    donorToken = regRes.body.token;
  });

  test('Step 3: Blood Bank records donation collection & unit creation', async () => {
    const colRes = await request(app)
      .post('/api/blood-units')
      .set('Authorization', `Bearer ${bbToken}`)
      .send({
        customUnitId: e2eUnitId,
        donorRefId,
        bloodGroup: 'O+',
        componentType: 'Whole Blood',
        volumeMl: 450,
      });

    expect(colRes.status).toBe(201);
    expect(colRes.body.unit.unitId).toBe(e2eUnitId);
    expect(colRes.body.unit.status).toBe('collected');
    expect(colRes.body.unit.screeningStatus).toBe('pending');
  });

  test('Step 4: Duplicate unit registration is rejected', async () => {
    const dupRes = await request(app)
      .post('/api/blood-units')
      .set('Authorization', `Bearer ${bbToken}`)
      .send({
        customUnitId: e2eUnitId,
        donorRefId,
        bloodGroup: 'O+',
        componentType: 'Whole Blood',
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.success).toBe(false);
  });

  test('Step 5: Laboratory serology screening passes and makes unit Available', async () => {
    const screenRes = await request(app)
      .put(`/api/blood-units/${e2eUnitId}/screening`)
      .set('Authorization', `Bearer ${bbToken}`)
      .send({
        screeningStatus: 'passed',
        hiv: 'Negative',
        hbv: 'Negative',
        hcv: 'Negative',
        notes: 'Passed all serology pathogens',
      });

    expect(screenRes.status).toBe(200);
    expect(screenRes.body.unit.status).toBe('available');
    expect(screenRes.body.unit.screeningStatus).toBe('passed');
  });

  test('Step 6: Hospital 1 places urgent blood request', async () => {
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${hospToken}`)
      .send({
        bloodGroup: 'O+',
        componentType: 'Whole Blood',
        quantity: 1,
        urgency: 'urgent',
        patientRefId: 'PT-E2E-CARDIO',
      });

    expect(reqRes.status).toBe(201);
    expect(reqRes.body.request.requestId).toBeDefined();

    // Step 7: Blood Bank allocates unit
    const allocRes = await request(app)
      .post(`/api/requests/${reqRes.body.request.requestId}/allocate`)
      .set('Authorization', `Bearer ${bbToken}`)
      .send({
        unitIds: [e2eUnitId],
      });

    expect(allocRes.status).toBe(200);
    expect(allocRes.body.allocatedUnits).toContain(e2eUnitId);
  });

  test('Step 8: Cold chain dispatch, transit and hospital receipt', async () => {
    // Dispatch
    const dispRes = await request(app)
      .post(`/api/dispatch/${e2eUnitId}`)
      .set('Authorization', `Bearer ${bbToken}`)
      .send({
        shipmentRef: 'E2E-WAYBILL-001',
        carrier: 'MediCold Logistics',
        temperatureCelsius: 3.8,
      });

    expect(dispRes.status).toBe(200);
    expect(dispRes.body.unit.status).toBe('dispatched');

    // Hospital receives unit
    const recRes = await request(app)
      .post(`/api/dispatch/${e2eUnitId}/receive`)
      .set('Authorization', `Bearer ${hospToken}`);

    expect(recRes.status).toBe(200);
    expect(recRes.body.unit.status).toBe('received');
  });

  test('Step 9: Emergency Inter-Hospital Transfer between Hospital 1 and Hospital 2', async () => {
    // Hospital 2 requests emergency transfer of the unit from Hospital 1
    const trRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${hosp2Token}`)
      .send({
        unitId: e2eUnitId,
        urgency: 'CRITICAL',
        reason: 'Trauma surge blood shortage',
      });

    expect(trRes.status).toBe(201);
    expect(trRes.body.transfer.transferId).toBeDefined();
    const transferId = trRes.body.transfer.transferId;

    // Hospital 2 completes the receipt
    const compRes = await request(app)
      .post(`/api/transfers/${transferId}/complete`)
      .set('Authorization', `Bearer ${hosp2Token}`);

    expect(compRes.status).toBe(200);
    expect(compRes.body.transfer.status).toBe('completed');
  });

  test('Step 10: Clinical patient transfusion outcome recorded', async () => {
    const transfuseRes = await request(app)
      .post(`/api/dispatch/${e2eUnitId}/transfuse`)
      .set('Authorization', `Bearer ${hosp2Token}`)
      .send({
        patientRefId: 'PT-E2E-EMERGENCY-RECEIVER',
        clinicalNotes: 'Administered in OR 3 successfully',
      });

    expect(transfuseRes.status).toBe(200);
    expect(transfuseRes.body.unit.status).toBe('transfused');
  });

  test('Step 11: Cryptographic integrity verification matches authentic state', async () => {
    const verifyRes = await request(app).get(`/api/blood-units/${e2eUnitId}/verify`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isTamperFree).toBe(true);
    expect(verifyRes.body.message).toContain('Integrity Verified');
  });

  test('Step 12: Direct database tampering causes integrity verification to fail', async () => {
    // Malicious actor modifies blood group directly in DB
    await BloodUnit.updateOne({ unitId: e2eUnitId }, { $set: { bloodGroup: 'AB-' } });

    const verifyTampered = await request(app).get(`/api/blood-units/${e2eUnitId}/verify`);
    expect(verifyTampered.status).toBe(200);
    expect(verifyTampered.body.isTamperFree).toBe(false);
    expect(verifyTampered.body.message).toContain('INTEGRITY ALERT');
  });
});
