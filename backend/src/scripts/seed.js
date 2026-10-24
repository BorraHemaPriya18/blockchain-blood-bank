require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const BloodUnit = require('../models/BloodUnit');
const BloodRequest = require('../models/BloodRequest');
const EmergencyTransfer = require('../models/EmergencyTransfer');
const AuditLog = require('../models/AuditLog');
const integrityService = require('../services/integrityService');
const blockchainService = require('../services/blockchainService');

async function seedData({ manageConnection = true } = {})  {
  console.log('--- SEEDING SYNTHETIC DEMONSTRATION DATA ---');
  if (manageConnection) {
  await connectDB();
}

  // Clean existing collections
  await Promise.all([
    User.deleteMany({}),
    DonorProfile.deleteMany({}),
    BloodUnit.deleteMany({}),
    BloodRequest.deleteMany({}),
    EmergencyTransfer.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('[Seed] Cleared existing records.');

  // 1. System Administrator
  const admin = await User.create({
    username: 'admin',
    email: 'admin@bloodchain.org',
    password: 'Admin@password123',
    role: 'admin',
    isApproved: true,
    walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat Account #0
  });

  // 2. Approved Blood Bank
  const bloodBank = await User.create({
    username: 'redcross_bb',
    email: 'bloodbank@redcross.org',
    password: 'Bank@password123',
    role: 'blood_bank',
    organizationName: 'Red Cross Central Blood Bank',
    licenseNumber: 'BB-LIC-9021',
    isApproved: true,
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat Account #1
  });

  // 3. Pending Blood Bank (for testing admin approval workflow)
  const pendingBank = await User.create({
    username: 'lifeshare_bb',
    email: 'pending@lifeshare.org',
    password: 'Bank@password123',
    role: 'blood_bank',
    organizationName: 'LifeShare Regional Blood Center',
    licenseNumber: 'BB-LIC-8822',
    isApproved: false,
    walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  });

  // 4. Approved Hospitals
  const hospitalA = await User.create({
    username: 'metro_hospital',
    email: 'hospital1@metrohealth.org',
    password: 'Hosp@password123',
    role: 'hospital',
    organizationName: 'Metro General Hospital',
    licenseNumber: 'HOSP-LIC-101',
    isApproved: true,
    walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Hardhat Account #2
  });

  const hospitalB = await User.create({
    username: 'stjude_hospital',
    email: 'hospital2@stjude.org',
    password: 'Hosp@password123',
    role: 'hospital',
    organizationName: 'St. Jude Memorial Hospital',
    licenseNumber: 'HOSP-LIC-102',
    isApproved: true,
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Hardhat Account #3
  });

  // 5. Registered Donors & Separated Profiles
  const donorsData = [
    {
      username: 'alex_donor',
      email: 'donor1@example.com',
      password: 'Donor@password123',
      donorRefId: 'DNR-2026-001',
      profile: {
        fullName: 'Alex Mercer',
        dateOfBirth: new Date('1995-04-12'),
        gender: 'Male',
        bloodGroup: 'O+',
        phoneNumber: '+1-555-0192',
        address: { street: '452 Broadway', city: 'Metropolis', state: 'NY', postalCode: '10001' },
        emergencyContact: { name: 'Claire Mercer', relationship: 'Spouse', phone: '+1-555-0199' },
        totalDonations: 4,
        isIdentityVerified: true,
      },
    },
    {
      username: 'sarah_donor',
      email: 'donor2@example.com',
      password: 'Donor@password123',
      donorRefId: 'DNR-2026-002',
      profile: {
        fullName: 'Sarah Connor',
        dateOfBirth: new Date('1998-09-24'),
        gender: 'Female',
        bloodGroup: 'A+',
        phoneNumber: '+1-555-0184',
        address: { street: '128 Pine Rd', city: 'Metropolis', state: 'NY', postalCode: '10002' },
        emergencyContact: { name: 'John Connor', relationship: 'Sibling', phone: '+1-555-0189' },
        totalDonations: 2,
        isIdentityVerified: true,
      },
    },
    {
      username: 'elena_donor',
      email: 'donor3@example.com',
      password: 'Donor@password123',
      donorRefId: 'DNR-2026-003',
      profile: {
        fullName: 'Elena Rostova',
        dateOfBirth: new Date('1992-11-05'),
        gender: 'Female',
        bloodGroup: 'B-',
        phoneNumber: '+1-555-0177',
        address: { street: '78 Elm St', city: 'Metropolis', state: 'NY', postalCode: '10003' },
        emergencyContact: { name: 'Dmitri Rostov', relationship: 'Parent', phone: '+1-555-0171' },
        totalDonations: 6,
        isIdentityVerified: true,
      },
    },
  ];

  for (const d of donorsData) {
    const user = await User.create({
      username: d.username,
      email: d.email,
      password: d.password,
      role: 'donor',
      isApproved: true,
      donorRefId: d.donorRefId,
    });

    await DonorProfile.create({
      donorRefId: d.donorRefId,
      ...d.profile,
    });
  }

  // 6. Blood Units across the full supply chain
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const rawUnits = [
    // Available units
    {
      unitId: 'BLD-2026-1001',
      bloodGroup: 'O+',
      componentType: 'Whole Blood',
      donorRefId: 'DNR-2026-001',
      collectionDate: new Date(now.getTime() - 5 * day),
      expiryDate: new Date(now.getTime() + 30 * day),
      screeningStatus: 'passed',
      status: 'available',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    {
      unitId: 'BLD-2026-1002',
      bloodGroup: 'A+',
      componentType: 'Red Blood Cells',
      donorRefId: 'DNR-2026-002',
      collectionDate: new Date(now.getTime() - 8 * day),
      expiryDate: new Date(now.getTime() + 34 * day),
      screeningStatus: 'passed',
      status: 'available',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    {
      unitId: 'BLD-2026-1003',
      bloodGroup: 'B-',
      componentType: 'Platelets',
      donorRefId: 'DNR-2026-003',
      collectionDate: new Date(now.getTime() - 1 * day),
      expiryDate: new Date(now.getTime() + 4 * day),
      screeningStatus: 'passed',
      status: 'available',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    // Pending screening unit
    {
      unitId: 'BLD-2026-1004',
      bloodGroup: 'AB+',
      componentType: 'Whole Blood',
      donorRefId: 'DNR-2026-001',
      collectionDate: new Date(now.getTime() - 1 * day),
      expiryDate: new Date(now.getTime() + 34 * day),
      screeningStatus: 'pending',
      status: 'pending_screening',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    // Quarantined unit
    {
      unitId: 'BLD-2026-1005',
      bloodGroup: 'O-',
      componentType: 'Whole Blood',
      donorRefId: 'DNR-2026-002',
      collectionDate: new Date(now.getTime() - 4 * day),
      expiryDate: new Date(now.getTime() + 31 * day),
      screeningStatus: 'failed',
      status: 'quarantined',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    // Reserved unit for request
    {
      unitId: 'BLD-2026-1006',
      bloodGroup: 'O+',
      componentType: 'Whole Blood',
      donorRefId: 'DNR-2026-001',
      collectionDate: new Date(now.getTime() - 10 * day),
      expiryDate: new Date(now.getTime() + 25 * day),
      screeningStatus: 'passed',
      status: 'reserved',
      hospitalRequestId: 'REQ-2026-001',
      reservedHospital: {
        id: hospitalA._id,
        name: hospitalA.organizationName,
        walletAddress: hospitalA.walletAddress,
      },
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    // Dispatched unit in cold chain
    {
      unitId: 'BLD-2026-1007',
      bloodGroup: 'A+',
      componentType: 'Red Blood Cells',
      donorRefId: 'DNR-2026-002',
      collectionDate: new Date(now.getTime() - 12 * day),
      expiryDate: new Date(now.getTime() + 30 * day),
      screeningStatus: 'passed',
      status: 'dispatched',
      hospitalRequestId: 'REQ-2026-002',
      reservedHospital: {
        id: hospitalA._id,
        name: hospitalA.organizationName,
        walletAddress: hospitalA.walletAddress,
      },
      currentCustodian: {
        role: 'transit',
        name: 'MediCold Express Logistics',
      },
      shipmentDetails: {
        shipmentRef: 'WAYBILL-9901-COLD',
        carrier: 'MediCold Express Logistics',
        dispatchedAt: new Date(now.getTime() - 2 * 3600 * 1000),
        temperatureCelsius: 3.8,
      },
    },
    // Received unit in Hospital B storage
    {
      unitId: 'BLD-2026-1008',
      bloodGroup: 'O+',
      componentType: 'Whole Blood',
      donorRefId: 'DNR-2026-001',
      collectionDate: new Date(now.getTime() - 15 * day),
      expiryDate: new Date(now.getTime() + 20 * day),
      screeningStatus: 'passed',
      status: 'received',
      currentCustodian: {
        role: 'hospital',
        id: hospitalB._id,
        name: hospitalB.organizationName,
        walletAddress: hospitalB.walletAddress,
      },
    },
    // Transfused unit
    {
      unitId: 'BLD-2026-1009',
      bloodGroup: 'B-',
      componentType: 'Platelets',
      donorRefId: 'DNR-2026-003',
      collectionDate: new Date(now.getTime() - 4 * day),
      expiryDate: new Date(now.getTime() + 1 * day),
      screeningStatus: 'passed',
      status: 'transfused',
      patientRefHash: '0x9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
      currentCustodian: {
        role: 'hospital',
        id: hospitalA._id,
        name: hospitalA.organizationName,
        walletAddress: hospitalA.walletAddress,
      },
    },
    // Unit nearing expiry (3 days left)
    {
      unitId: 'BLD-2026-1010',
      bloodGroup: 'AB+',
      componentType: 'Platelets',
      donorRefId: 'DNR-2026-001',
      collectionDate: new Date(now.getTime() - 3 * day),
      expiryDate: new Date(now.getTime() + 2 * day),
      screeningStatus: 'passed',
      status: 'available',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    // Expired unit
    {
      unitId: 'BLD-2026-1011',
      bloodGroup: 'O-',
      componentType: 'Red Blood Cells',
      donorRefId: 'DNR-2026-002',
      collectionDate: new Date(now.getTime() - 45 * day),
      expiryDate: new Date(now.getTime() - 3 * day),
      screeningStatus: 'passed',
      status: 'expired',
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
    // Discarded unit
    {
      unitId: 'BLD-2026-1012',
      bloodGroup: 'A+',
      componentType: 'Whole Blood',
      donorRefId: 'DNR-2026-003',
      collectionDate: new Date(now.getTime() - 20 * day),
      expiryDate: new Date(now.getTime() + 15 * day),
      screeningStatus: 'failed',
      status: 'discarded',
      discardReason: 'Thermal excursion during refrigeration compressor maintenance',
      discardedAt: new Date(now.getTime() - 2 * day),
      currentCustodian: {
        role: 'blood_bank',
        id: bloodBank._id,
        name: bloodBank.organizationName,
        walletAddress: bloodBank.walletAddress,
      },
    },
  ];

  const chainStatus = await blockchainService.isBlockchainConnected();
  if (chainStatus.connected) {
    try {
      await blockchainService.registerBloodBankOnChain(bloodBank.walletAddress, bloodBank.organizationName, bloodBank.licenseNumber, true);
      await blockchainService.registerHospitalOnChain(hospitalA.walletAddress, hospitalA.organizationName, hospitalA.licenseNumber, true);
      await blockchainService.registerHospitalOnChain(hospitalB.walletAddress, hospitalB.organizationName, hospitalB.licenseNumber, true);
    } catch (e) {
      console.log('[Seed] Node registration note:', e.message);
    }
  }

  for (const u of rawUnits) {
    const dataHash = integrityService.computeUnitHash(u);
    let realTxHash = null;
    let realBlockNum = null;

    if (chainStatus.connected) {
      try {
        const colTs = new Date(u.collectionDate).getTime();
        const expTs = new Date(u.expiryDate).getTime();
        const regRes = await blockchainService.registerBloodUnitOnChain(
          u.unitId,
          u.bloodGroup,
          u.componentType,
          colTs,
          expTs,
          dataHash
        );
        realTxHash = regRes.txHash;
        realBlockNum = regRes.blockNumber;

        if (u.screeningStatus === 'passed') {
          await blockchainService.updateScreeningOnChain(u.unitId, 1, 'Screening passed during collection intake', dataHash);
        }
      } catch (err) {
        realTxHash = null;
        realBlockNum = null;
      }
    }

    const blockchainHistory = [];
    if (realTxHash) {
      blockchainHistory.push({
        eventType: 'BloodUnitRegistered',
        txHash: realTxHash,
        blockNumber: realBlockNum,
        timestamp: u.collectionDate,
        actorAddress: bloodBank.walletAddress,
        dataHash,
        remarks: 'Collection recorded and integrity hashed on-chain',
      });
    }

    await BloodUnit.create({
      ...u,
      bloodBankId: bloodBank._id,
      bloodBankName: bloodBank.organizationName,
      dataHash,
      blockchainHistory,
    });
  }

  // 7. Hospital Blood Requests
  await BloodRequest.create([
    {
      requestId: 'REQ-2026-001',
      hospitalId: hospitalA._id,
      hospitalName: hospitalA.organizationName,
      hospitalWallet: hospitalA.walletAddress,
      bloodBankId: bloodBank._id,
      bloodBankName: bloodBank.organizationName,
      bloodGroup: 'O+',
      componentType: 'Whole Blood',
      quantity: 1,
      urgency: 'urgent',
      patientRefId: 'PT-SURGERY-8821',
      status: 'approved',
      allocatedUnits: ['BLD-2026-1006'],
    },
    {
      requestId: 'REQ-2026-002',
      hospitalId: hospitalA._id,
      hospitalName: hospitalA.organizationName,
      hospitalWallet: hospitalA.walletAddress,
      bloodBankId: bloodBank._id,
      bloodBankName: bloodBank.organizationName,
      bloodGroup: 'A+',
      componentType: 'Red Blood Cells',
      quantity: 1,
      urgency: 'emergency',
      patientRefId: 'PT-TRAUMA-9912',
      status: 'approved',
      allocatedUnits: ['BLD-2026-1007'],
    },
    {
      requestId: 'REQ-2026-003',
      hospitalId: hospitalB._id,
      hospitalName: hospitalB.organizationName,
      hospitalWallet: hospitalB.walletAddress,
      bloodBankName: 'All Participating Blood Banks',
      bloodGroup: 'B-',
      componentType: 'Platelets',
      quantity: 2,
      urgency: 'normal',
      patientRefId: 'PT-ONCOLOGY-1104',
      status: 'pending',
    },
  ]);

  // 8. Emergency Inter-Hospital Transfer
  await EmergencyTransfer.create({
    transferId: 'EMG-TR-2026-8801',
    requestingHospitalId: hospitalA._id,
    requestingHospitalName: hospitalA.organizationName,
    requestingHospitalWallet: hospitalA.walletAddress,
    supplyingHospitalId: hospitalB._id,
    supplyingHospitalName: hospitalB.organizationName,
    supplyingHospitalWallet: hospitalB.walletAddress,
    unitId: 'BLD-2026-1008',
    bloodGroup: 'O+',
    componentType: 'Whole Blood',
    urgency: 'CRITICAL',
    reason: 'Multi-vehicle collision trauma surge',
    status: 'completed',
    timestamps: {
      requestedAt: new Date(now.getTime() - 120 * 60 * 1000),
      approvedAt: new Date(now.getTime() - 110 * 60 * 1000),
      dispatchedAt: new Date(now.getTime() - 95 * 60 * 1000),
      completedAt: new Date(now.getTime() - 35 * 60 * 1000),
    },
    elapsedTimeMinutes: 85,
    blockchainTxHash: null,
  });

  // 9. Initial Audit Logs
  await AuditLog.create([
    {
      action: 'SYSTEM_INITIALIZED',
      entityType: 'SYSTEM',
      actorUsername: 'admin',
      actorRole: 'admin',
      details: { environment: 'development', version: '1.0.0' },
      timestamp: new Date(now.getTime() - 20 * day),
    },
    {
      action: 'ORGANIZATION_APPROVED',
      entityType: 'USER',
      actorUsername: 'admin',
      actorRole: 'admin',
      details: { organizationName: 'Red Cross Central Blood Bank', role: 'blood_bank' },
      timestamp: new Date(now.getTime() - 19 * day),
    },
    {
      action: 'ORGANIZATION_APPROVED',
      entityType: 'USER',
      actorUsername: 'admin',
      actorRole: 'admin',
      details: { organizationName: 'Metro General Hospital', role: 'hospital' },
      timestamp: new Date(now.getTime() - 18 * day),
    },
  ]);

  console.log('[Seed] Demonstration data seeded successfully!');
  console.log('--- TEST ACCOUNTS SUMMARY ---');
  console.log('Admin:       admin@bloodchain.org / Admin@password123');
  console.log('Blood Bank:  bloodbank@redcross.org / Bank@password123');
  console.log('Hospital 1:  hospital1@metrohealth.org / Hosp@password123');
  console.log('Hospital 2:  hospital2@stjude.org / Hosp@password123');
  console.log('Donor:       donor1@example.com / Donor@password123');
  console.log('Pending BB:  pending@lifeshare.org / Bank@password123');

  if (manageConnection) {
  await disconnectDB();
}
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}

module.exports = seedData;
