const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const BloodUnit = require('../src/models/BloodUnit');
const BloodRequest = require('../src/models/BloodRequest');

describe('Blood Supply Chain API Acceptance Tests', () => {
  let adminToken, bloodBankToken, hospitalToken, donorToken;
  let testBloodBankUser, testHospitalUser;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Clean test DB
    await User.deleteMany({});
    await BloodUnit.deleteMany({});
    await BloodRequest.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Authentication & Role Permissions', () => {
    it('Criteria 1: A donor can register and log in', async () => {
      // Register Donor
      const regRes = await request(app)
        .post('/api/auth/register-donor')
        .send({
          username: 'test_donor_1',
          email: 'test_donor_1@example.com',
          password: 'Password123!',
          fullName: 'Test Donor Person',
          dateOfBirth: '1996-05-15',
          gender: 'Male',
          bloodGroup: 'O+',
          phoneNumber: '+1-555-8888',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.token).toBeDefined();
      expect(regRes.body.user.donorRefId).toBeDefined();

      // Login Donor
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'test_donor_1@example.com',
          password: 'Password123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeDefined();
      donorToken = loginRes.body.token;
    });

    it('Criteria 2: An incorrect password is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'test_donor_1@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Criteria 3: A donor cannot access administrator APIs', async () => {
      const res = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Forbidden');
    });

    it('Criteria 4: An administrator can approve an organization', async () => {
      // 1. Create Admin
      const admin = await User.create({
        username: 'sysadmin',
        email: 'sysadmin@bloodchain.org',
        password: 'AdminPassword123!',
        role: 'admin',
        isApproved: true,
      });

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'sysadmin@bloodchain.org',
          password: 'AdminPassword123!',
        });
      adminToken = adminLogin.body.token;

      // 2. Register organization (pending approval)
      const orgReg = await request(app)
        .post('/api/auth/register-organization')
        .send({
          username: 'city_blood_bank',
          email: 'citybb@hospital.org',
          password: 'BankPassword123!',
          role: 'blood_bank',
          organizationName: 'City Central Blood Bank',
          licenseNumber: 'BB-999',
          walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        });

      expect(orgReg.status).toBe(201);
      const orgId = orgReg.body.userId;

      // Organization cannot login before approval
      const prematureLogin = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'citybb@hospital.org',
          password: 'BankPassword123!',
        });
      expect(prematureLogin.status).toBe(403);

      // Admin approves organization
      const approveRes = await request(app)
        .put(`/api/auth/users/${orgId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approve: true });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.user.isApproved).toBe(true);

      // Organization can now log in
      const postApproveLogin = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'citybb@hospital.org',
          password: 'BankPassword123!',
        });

      expect(postApproveLogin.status).toBe(200);
      bloodBankToken = postApproveLogin.body.token;
      testBloodBankUser = postApproveLogin.body.user;

      // Also create an approved hospital
      const hospUser = await User.create({
        username: 'general_hospital',
        email: 'genhosp@health.org',
        password: 'HospPassword123!',
        role: 'hospital',
        organizationName: 'General Hospital',
        licenseNumber: 'HOSP-777',
        isApproved: true,
        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      });
      const hospLogin = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'genhosp@health.org',
          password: 'HospPassword123!',
        });
      hospitalToken = hospLogin.body.token;
      testHospitalUser = hospLogin.body.user;
    });
  });

  describe('2. Blood Unit Lifecycle, Verification & Security Controls', () => {
    const testUnitId = 'BLD-TEST-9001';

    it('Criteria 5: Authorized blood bank staff can register a unique blood unit', async () => {
      const res = await request(app)
        .post('/api/blood-units')
        .set('Authorization', `Bearer ${bloodBankToken}`)
        .send({
          customUnitId: testUnitId,
          donorRefId: 'DNR-TEST-001',
          bloodGroup: 'O+',
          componentType: 'Whole Blood',
          volumeMl: 450,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.unit.unitId).toBe(testUnitId);
      expect(res.body.unit.status).toBe('collected');
      expect(res.body.unit.dataHash).toBeDefined();
    });

    it('Criteria 6: Duplicate blood unit registration is rejected', async () => {
      const res = await request(app)
        .post('/api/blood-units')
        .set('Authorization', `Bearer ${bloodBankToken}`)
        .send({
          customUnitId: testUnitId,
          donorRefId: 'DNR-TEST-002',
          bloodGroup: 'O+',
          componentType: 'Whole Blood',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });

    it('Criteria 7: An unapproved unit cannot become available until lab screening passes', async () => {
      let unit = await BloodUnit.findOne({ unitId: testUnitId });
      expect(unit.status).toBe('collected');

      // Update lab screening to Passed
      const screenRes = await request(app)
        .put(`/api/blood-units/${testUnitId}/screening`)
        .set('Authorization', `Bearer ${bloodBankToken}`)
        .send({
          screeningStatus: 'passed',
          hiv: 'Negative',
          hbv: 'Negative',
          hcv: 'Negative',
          notes: 'Serology clean',
        });

      expect(screenRes.status).toBe(200);
      expect(screenRes.body.unit.status).toBe('available');
    });

    it('Criteria 9: An authorized hospital can submit a blood request', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          bloodGroup: 'O+',
          componentType: 'Whole Blood',
          quantity: 1,
          urgency: 'urgent',
          patientRefId: 'PT-CARDIO-4001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.request.requestId).toBeDefined();
    });

    it('Criteria 10 & 11: An available unit can be reserved, and unauthorized users cannot dispatch', async () => {
      // Find request
      const reqDoc = await BloodRequest.findOne({ patientRefId: 'PT-CARDIO-4001' });

      // Blood bank reserves the available unit
      const allocRes = await request(app)
        .post(`/api/requests/${reqDoc.requestId}/allocate`)
        .set('Authorization', `Bearer ${bloodBankToken}`)
        .send({
          unitIds: [testUnitId],
        });

      expect(allocRes.status).toBe(200);
      expect(allocRes.body.allocatedUnits).toContain(testUnitId);

      // Verify double allocation is prevented
      const secondAllocRes = await request(app)
        .post(`/api/requests/${reqDoc.requestId}/allocate`)
        .set('Authorization', `Bearer ${bloodBankToken}`)
        .send({
          unitIds: [testUnitId],
        });
      expect(secondAllocRes.body.allocatedUnits.length).toBe(0);
      expect(secondAllocRes.body.errors[0]).toContain('not available');

      // Unauthorized user (Donor) cannot dispatch
      const unauthDispatch = await request(app)
        .post(`/api/dispatch/${testUnitId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({});
      expect(unauthDispatch.status).toBe(403);

      // Authorized blood bank dispatches
      const dispatchRes = await request(app)
        .post(`/api/dispatch/${testUnitId}`)
        .set('Authorization', `Bearer ${bloodBankToken}`)
        .send({
          shipmentRef: 'SHIP-TEST-01',
          carrier: 'BloodLink Express',
          temperatureCelsius: 3.9,
        });

      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.unit.status).toBe('dispatched');

      // Hospital receives unit
      const receiveRes = await request(app)
        .post(`/api/dispatch/${testUnitId}/receive`)
        .set('Authorization', `Bearer ${hospitalToken}`);

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.unit.status).toBe('received');
    });

    it('Criteria 16: Modifying a stored record causes integrity verification to fail', async () => {
      // Check untouched integrity
      const verifyGood = await request(app).get(`/api/blood-units/${testUnitId}/verify`);
      expect(verifyGood.status).toBe(200);
      expect(verifyGood.body.isTamperFree).toBe(true);

      // Maliciously tamper with MongoDB record directly
      await BloodUnit.updateOne({ unitId: testUnitId }, { $set: { bloodGroup: 'AB-' } });

      // Re-verify integrity
      const verifyTampered = await request(app).get(`/api/blood-units/${testUnitId}/verify`);
      expect(verifyTampered.status).toBe(200);
      expect(verifyTampered.body.isTamperFree).toBe(false);
      expect(verifyTampered.body.message).toContain('INTEGRITY ALERT');
    });

    it('Criteria 18: Dashboard statistics reflect database records accurately', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalDonors).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalBloodBanks).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalHospitals).toBeGreaterThanOrEqual(1);
    });
  });
});
