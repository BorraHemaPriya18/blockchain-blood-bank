const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const AuditLog = require('../models/AuditLog');
const blockchainService = require('../services/blockchainService');

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'blood_chain_dev_secret_key_991823719823',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// @desc    Register a new blood donor (PII separated from auth)
// @route   POST /api/auth/register-donor
// @access  Public
exports.registerDonor = async (req, res, next) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      dateOfBirth,
      gender,
      bloodGroup,
      phoneNumber,
      address,
      emergencyContact,
      affectiveConsentStatus,
      emotionDetected,
    } = req.body;

    if (!username || !email || !password || !fullName || !bloodGroup || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all mandatory donor details and credentials.',
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with that email or username already exists.',
      });
    }

    // Generate unique donor reference ID
    const donorRefId = `DNR-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Create User (Auth credentials only)
    const user = await User.create({
      username,
      email,
      password,
      role: 'donor',
      isApproved: true, // Donors can log in immediately
      donorRefId,
    });

    // Create Donor Profile (PII stored separately)
    const profile = await DonorProfile.create({
      donorRefId,
      fullName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('2000-01-01'),
      gender: gender || 'Other',
      bloodGroup,
      phoneNumber,
      address: typeof address === 'string' ? JSON.parse(address || '{}') : address,
      emergencyContact: typeof emergencyContact === 'string' ? JSON.parse(emergencyContact || '{}') : emergencyContact,
      photoUrl: req.files && req.files.photo ? `/uploads/${req.files.photo[0].filename}` : null,
      documentUrl: req.files && req.files.document ? `/uploads/${req.files.document[0].filename}` : null,
      affectiveCheck: {
        enabled: Boolean(emotionDetected),
        emotionDetected: emotionDetected || 'Neutral',
        confidenceScore: 0.98,
        underDuressFlag: false,
        manualConsentConfirmed: affectiveConsentStatus !== 'false',
      },
      isIdentityVerified: true,
    });

    await AuditLog.create({
      action: 'DONOR_REGISTERED',
      entityType: 'USER',
      entityId: user._id.toString(),
      actorId: user._id,
      actorUsername: user.username,
      actorRole: 'donor',
      details: { donorRefId, bloodGroup },
      ipAddress: req.ip,
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Donor registered successfully.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        donorRefId,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Register organization (Blood Bank or Hospital, requires Admin approval)
// @route   POST /api/auth/register-organization
// @access  Public
exports.registerOrganization = async (req, res, next) => {
  try {
    const { username, email, password, role, organizationName, licenseNumber, walletAddress } = req.body;

    if (!['blood_bank', 'hospital'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid organization role. Allowed: blood_bank, hospital.',
      });
    }

    if (!organizationName || !licenseNumber) {
      return res.status(400).json({
        success: false,
        message: 'Organization name and medical license number are mandatory.',
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with that email or username already exists.',
      });
    }

    // Default development wallet if not supplied
    const assignedWallet =
      walletAddress ||
      (role === 'blood_bank'
        ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // Hardhat account #1
        : '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'); // Hardhat account #2

    const user = await User.create({
      username,
      email,
      password,
      role,
      organizationName,
      licenseNumber,
      walletAddress: assignedWallet,
      isApproved: false, // Requires admin approval
    });

    await AuditLog.create({
      action: 'ORGANIZATION_REGISTERED_PENDING_APPROVAL',
      entityType: 'USER',
      entityId: user._id.toString(),
      actorId: user._id,
      actorUsername: user.username,
      actorRole: role,
      details: { organizationName, licenseNumber, walletAddress: assignedWallet },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Account is pending system administrator verification and approval.',
      userId: user._id,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    User Login
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/username and password.',
      });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact administrator.',
      });
    }

    if ((user.role === 'blood_bank' || user.role === 'hospital') && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your organization account is pending administrator approval.',
      });
    }

    const token = generateToken(user._id, user.role);

    // Fetch profile if donor
    let profile = null;
    if (user.role === 'donor' && user.donorRefId) {
      profile = await DonorProfile.findOne({ donorRefId: user.donorRefId });
    }

    await AuditLog.create({
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user._id.toString(),
      actorId: user._id,
      actorUsername: user.username,
      actorRole: user.role,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        organizationName: user.organizationName,
        licenseNumber: user.licenseNumber,
        walletAddress: user.walletAddress,
        donorRefId: user.donorRefId,
        isApproved: user.isApproved,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Current Logged In User Profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let profile = null;
    if (user.role === 'donor' && user.donorRefId) {
      profile = await DonorProfile.findOne({ donorRefId: user.donorRefId });
    }

    res.status(200).json({
      success: true,
      user,
      profile,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin: List all users & organizations
// @route   GET /api/auth/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin: Approve or Reject Organization Account
// @route   PUT /api/auth/users/:id/approve
// @access  Private (Admin only)
exports.approveOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approve = true } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.isApproved = Boolean(approve);
    await user.save();

    let onChainTx = null;
    // Register on blockchain if walletAddress exists
    if (user.isApproved && user.walletAddress) {
      try {
        if (user.role === 'blood_bank') {
          onChainTx = await blockchainService.registerBloodBankOnChain(
            user.walletAddress,
            user.organizationName || user.username,
            user.licenseNumber || 'N/A',
            true
          );
        } else if (user.role === 'hospital') {
          onChainTx = await blockchainService.registerHospitalOnChain(
            user.walletAddress,
            user.organizationName || user.username,
            user.licenseNumber || 'N/A',
            true
          );
        }
      } catch (bcErr) {
        console.warn(`[Blockchain] Note: On-chain registration warning: ${bcErr.message}`);
      }
    }

    await AuditLog.create({
      action: user.isApproved ? 'ORGANIZATION_APPROVED' : 'ORGANIZATION_REJECTED',
      entityType: 'USER',
      entityId: user._id.toString(),
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: 'admin',
      details: {
        organizationName: user.organizationName,
        role: user.role,
        approved: user.isApproved,
        onChainTx,
      },
      blockchainTxHash: onChainTx ? onChainTx.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Organization ${user.isApproved ? 'approved' : 'rejected'} successfully.`,
      user,
      onChainTx,
    });
  } catch (err) {
    next(err);
  }
};
