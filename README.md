# Blockchain Blood Bank Supply Management

A decentralized, tamper-evident blood bank supply chain management system.

---

## 1. System Architecture & Features

- **Decentralized Provenance**: Vein-to-vein tracking from voluntary donor registration, blood collection, laboratory serology screening, inventory stocking, hospital blood requests, cold-chain refrigerated transit, to patient transfusion or safe disposal.
- **Privacy-Preserving PII Segregation**: Donor Personally Identifiable Information (PII) is kept strictly off-chain in MongoDB, isolated behind cryptographic reference IDs (`donorRefId`). Only the pseudonymous `donorRefId` token is committed on-chain — never names, addresses, or medical records.
- **Cryptographic Integrity Engine**: Deterministic SHA-256 state hashes committed to `BloodSupplyChain.sol` on-chain. If any database record is tampered with directly, the system automatically detects the discrepancy and flags an **INTEGRITY ALERT**.
- **Inter-Hospital Emergency Supply Protocol**: Decentralized P2P search across partner hospital inventories with measured processing intervals (solving golden-hour delivery delays).
- **Four Role-Based Dashboards**: System Administrator, Blood Bank Staff, Clinical Hospital Staff, and Voluntary Donor.
- **CSV Compliance Exports**: One-click authenticated export of Inventory Ledger, Hospital Orders, Emergency Transfers, and Audit Trail reports from the Analytics page.
- **Base Paper Demonstration — Affective State & Anti-Duress Check** *(Toggle on Login Page)*: SSRN paper section 5 proposes video emotion verification to detect coercion. Per clinical safety guidelines, this demo feature is isolated: facial expressions are never treated as proof of medical consent, and genuine donors are never blocked from manual verification.

---

## 2. Technology Stack & Versions

- **Node.js**: v18+ (tested on Node v24.21.0)
- **Blockchain**: Solidity 0.8.20, Hardhat 2.22.2, Ethers.js v6.13.0
- **Database**: MongoDB with Mongoose (with embedded automatic `MongoMemoryServer` fallback)
- **Backend API**: Express.js, JWT, bcryptjs, Multer, Helmet, Morgan, express-rate-limit
- **Frontend**: React 18, Vite 5, Tailwind CSS 3, React Router v6, Axios, Recharts, Lucide React

---

## 3. Synthetic Demonstration Credentials

Use these synthetic test accounts with 1-click fill on the Sign In page:

| Role | Username / Email | Password | Assigned Wallet / Purpose |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@bloodchain.org` | `Admin@password123` | Contract Owner (`0xf39F...2266`) |
| **Blood Bank Staff** | `bloodbank@redcross.org` | `Bank@password123` | Red Cross Blood Center (`0x7099...79C8`) |
| **Hospital Staff #1** | `hospital1@metrohealth.org` | `Hosp@password123` | Metro General Hospital (`0x3C44...93BC`) |
| **Hospital Staff #2** | `hospital2@stjude.org` | `Hosp@password123` | St. Jude Memorial Hospital (`0x90F7...b906`) |
| **Voluntary Donor** | `donor1@example.com` | `Donor@password123` | Alex Mercer (O+ Donor) |
| **Pending Blood Bank** | `pending@lifeshare.org` | `Bank@password123` | LifeShare BB (Requires Admin Approval) |

---

## 4. Windows PowerShell Execution Guide

Run each service in a separate terminal window.

### Step 1: Clone / Navigate to Workspace
```powershell
cd c:\Users\DELL\OneDrive\Desktop\chain
```

---

### Step 2: Blockchain Setup & Smart Contract Deployment

**Terminal 1 (Ganache):**

Start Ganache GUI on port `7545`.

**Terminal 2 (Deploy Contract):**
```powershell
cd blockchain
npm install
npx hardhat run scripts/deploy.js --network localhost
```
*This deploys `BloodSupplyChain.sol` to Ganache and automatically exports the contract address and ABI into `backend/src/config/BloodSupplyChain.json`.*

---

### Step 3: Backend API Setup & Synthetic Seeding

**Terminal 3 (Backend API):**
```powershell
cd backend
npm install

# (Optional) Seed realistic synthetic donors, blood units, requests, and emergency transfers:
node src/scripts/seed.js

# Start the Express API server:
npm start
```
*The backend API will start on **`http://localhost:5000`**.*
*(Note: If local MongoDB is not running, the backend automatically initializes an in-memory database fallback via `MongoMemoryServer` with zero configuration required!)*

---

### Step 4: Frontend Web Application

**Terminal 4 (React Vite Frontend):**
```powershell
cd frontend
npm install
npm run dev
```
*The frontend web application will start on **`http://localhost:3000`**.*

---

## 5. Application URLs

### Public Routes
| Interface | URL |
| :--- | :--- |
| **Public Landing Page** | [http://localhost:3000/](http://localhost:3000/) |
| **Sign In Page** | [http://localhost:3000/login](http://localhost:3000/login) |
| **Donor Registration** | [http://localhost:3000/register-donor](http://localhost:3000/register-donor) |
| **Organization Registration** | [http://localhost:3000/register-org](http://localhost:3000/register-org) |

### Role Dashboards (Authenticated)
| Interface | URL | Roles |
| :--- | :--- | :--- |
| **Admin Dashboard** | [http://localhost:3000/admin-dashboard](http://localhost:3000/admin-dashboard) | admin |
| **Blood Bank Dashboard** | [http://localhost:3000/bloodbank-dashboard](http://localhost:3000/bloodbank-dashboard) | blood_bank, admin |
| **Hospital Dashboard** | [http://localhost:3000/hospital-dashboard](http://localhost:3000/hospital-dashboard) | hospital, admin |
| **Donor Dashboard** | [http://localhost:3000/donor-dashboard](http://localhost:3000/donor-dashboard) | donor, admin |

### Operational Pages (Authenticated)
| Interface | URL | Roles |
| :--- | :--- | :--- |
| **Digital Blood Inventory** | [http://localhost:3000/inventory](http://localhost:3000/inventory) | all authenticated |
| **Blood Unit Details** | [http://localhost:3000/units/:unitId](http://localhost:3000/units/:unitId) | all authenticated |
| **Register Blood Unit** | [http://localhost:3000/units/register](http://localhost:3000/units/register) | blood_bank, admin |
| **Hospital Blood Orders** | [http://localhost:3000/requests](http://localhost:3000/requests) | blood_bank, hospital, admin |
| **Emergency Transfers** | [http://localhost:3000/transfers](http://localhost:3000/transfers) | hospital, admin |
| **Cold Chain Dispatch** | [http://localhost:3000/dispatch](http://localhost:3000/dispatch) | blood_bank, hospital, admin |
| **Expiry & Wastage Monitor** | [http://localhost:3000/expiry](http://localhost:3000/expiry) | blood_bank, hospital, admin |
| **Blockchain Explorer** | [http://localhost:3000/explorer](http://localhost:3000/explorer) | blood_bank, hospital, admin |
| **Audit Logs** | [http://localhost:3000/audit](http://localhost:3000/audit) | blood_bank, hospital, admin |
| **Reports & Analytics** | [http://localhost:3000/analytics](http://localhost:3000/analytics) | all authenticated |
| **User Profile** | [http://localhost:3000/profile](http://localhost:3000/profile) | all authenticated |
| **Backend API Health** | [http://localhost:5000/api/health](http://localhost:5000/api/health) | — |

---

## 6. Seeded Demonstration Data

Running `node src/scripts/seed.js` populates the following synthetic data:

- **12 Blood Units** covering all lifecycle statuses: `collected`, `pending_screening`, `available`, `reserved`, `dispatched`, `received`, `transfused`, `expired`, `quarantined`, `discarded`
- **4 Blood Component Types**: Whole Blood, Red Blood Cells, Platelets, Plasma
- **3 Blood Requests**: urgent, emergency, and normal priority
- **1 Completed Emergency Inter-Hospital Transfer** with measured elapsed time (85 mins)
- **3 Donor Profiles** with off-chain PII (Alex Mercer O+, Sarah Connor A+, Elena Rostova B-)
- **3 Audit Log entries** for system initialization and organization approvals

---

## 7. Running Automated Tests

### 1. Smart Contract Hardhat Tests (18 Passing Tests)
```powershell
cd blockchain
npx hardhat test
```
*Covers contract deployment, admin access control, unit registration, duplicate unit rejection, lab screening gates, reservation locking, cold chain dispatch, hospital receipt, patient transfusion, emergency inter-hospital transfer, and on-chain hash verification.*

### 2. Backend API & E2E Workflow Tests (22 Passing Tests)
```powershell
cd backend
npm test
```
*Covers full donation-to-hospital-receipt lifecycle, role protection, and cryptographic data tampering detection.*

**Total Automated Tests:** **40 passing automated tests**.

---

## 8. Troubleshooting & Reset

- **Resetting Database**: Run `cd backend && node src/scripts/seed.js` to wipe and re-seed clean demonstration data.
- **Port Conflicts**: If port 5000 is occupied, change `PORT=5001` in `backend/.env` and update the proxy in `frontend/vite.config.js`.
- **Blockchain Connection**: Ensure Ganache GUI is running on port `7545` before deploying or starting the backend.
