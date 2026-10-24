const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomicfoundation/hardhat-chai-matchers");

describe("BloodSupplyChain Smart Contract", function () {
  let BloodSupplyChain;
  let contract;
  let admin, bloodBank, hospitalA, hospitalB, unauthorizedUser;

  const sampleUnitId = "BLD-2026-0001";
  const sampleBloodGroup = "O+";
  const sampleComponent = "Whole Blood";
  const initialHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const updatedHash = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";

  beforeEach(async function () {
    [admin, bloodBank, hospitalA, hospitalB, unauthorizedUser] = await ethers.getSigners();

    BloodSupplyChain = await ethers.getContractFactory("BloodSupplyChain");
    contract = await BloodSupplyChain.deploy();
    await contract.waitForDeployment();

    // Authorize organizations
    await contract.registerBloodBank(bloodBank.address, "Red Cross Central Blood Bank", "BB-LIC-001", true);
    await contract.registerHospital(hospitalA.address, "Metro General Hospital", "HOSP-LIC-101", true);
    await contract.registerHospital(hospitalB.address, "St. Jude Memorial Hospital", "HOSP-LIC-102", true);
  });

  describe("1. Deployment & Authorization", function () {
    it("Should set the deployer as admin", async function () {
      expect(await contract.admin()).to.equal(admin.address);
    });

    it("Should register and verify blood bank authorization", async function () {
      const bb = await contract.bloodBanks(bloodBank.address);
      expect(bb.name).to.equal("Red Cross Central Blood Bank");
      expect(bb.isAuthorized).to.be.true;
    });

    it("Should register and verify hospital authorization", async function () {
      const hosp = await contract.hospitals(hospitalA.address);
      expect(hosp.name).to.equal("Metro General Hospital");
      expect(hosp.isAuthorized).to.be.true;
    });

    it("Should reject non-admin registering organizations", async function () {
      await expect(
        contract.connect(unauthorizedUser).registerBloodBank(unauthorizedUser.address, "Fake Bank", "BB-000", true)
      ).to.be.revertedWith("Caller is not the system administrator");
    });
  });

  describe("2. Blood Unit Registration & Duplicate Prevention", function () {
    it("Should allow authorized blood bank to register a blood unit", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600; // 35 days shelf life

      await expect(
        contract.connect(bloodBank).registerBloodUnit(
          sampleUnitId,
          sampleBloodGroup,
          sampleComponent,
          now,
          expiry,
          initialHash
        )
      )
        .to.emit(contract, "BloodUnitRegistered")
        .withArgs(sampleUnitId, sampleBloodGroup, sampleComponent, bloodBank.address, expiry, initialHash);

      const unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.unitId).to.equal(sampleUnitId);
      expect(unit.bloodGroup).to.equal(sampleBloodGroup);
      expect(unit.status).to.equal(0); // Collected
      expect(unit.currentCustodian).to.equal(bloodBank.address);
    });

    it("Should reject duplicate registration of the same unit ID", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;

      await contract.connect(bloodBank).registerBloodUnit(
        sampleUnitId,
        sampleBloodGroup,
        sampleComponent,
        now,
        expiry,
        initialHash
      );

      await expect(
        contract.connect(bloodBank).registerBloodUnit(
          sampleUnitId,
          sampleBloodGroup,
          sampleComponent,
          now,
          expiry,
          initialHash
        )
      ).to.be.revertedWith("Blood unit already registered");
    });

    it("Should reject registration from unauthorized user", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;

      await expect(
        contract.connect(unauthorizedUser).registerBloodUnit(
          sampleUnitId,
          sampleBloodGroup,
          sampleComponent,
          now,
          expiry,
          initialHash
        )
      ).to.be.revertedWith("Caller is not an authorized blood bank");
    });
  });

  describe("3. Screening Workflow & Inventory Availability", function () {
    beforeEach(async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;
      await contract.connect(bloodBank).registerBloodUnit(
        sampleUnitId,
        sampleBloodGroup,
        sampleComponent,
        now,
        expiry,
        initialHash
      );
    });

    it("Should update screening to Passed and make unit Available", async function () {
      await expect(
        contract.connect(bloodBank).updateScreeningStatus(
          sampleUnitId,
          1, // Passed
          "All pathogen and serology tests negative",
          updatedHash
        )
      )
        .to.emit(contract, "ScreeningStatusUpdated")
        .withArgs(sampleUnitId, 1, 3, bloodBank.address, updatedHash); // status 3 = Available

      const unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.screeningStatus).to.equal(1); // Passed
      expect(unit.status).to.equal(3); // Available
    });

    it("Should quarantine unit if screening fails", async function () {
      await expect(
        contract.connect(bloodBank).updateScreeningStatus(
          sampleUnitId,
          2, // Failed
          "Positive for viral markers",
          updatedHash
        )
      )
        .to.emit(contract, "ScreeningStatusUpdated")
        .withArgs(sampleUnitId, 2, 8, bloodBank.address, updatedHash); // status 8 = Quarantined

      const unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.screeningStatus).to.equal(2);
      expect(unit.status).to.equal(8); // Quarantined
    });

    it("Should reject reservation of unapproved unit", async function () {
      await expect(
        contract.connect(bloodBank).reserveBloodUnit(
          sampleUnitId,
          hospitalA.address,
          "REQ-2026-100",
          updatedHash,
          sampleBloodGroup,
          sampleComponent
        )
      ).to.be.revertedWith("Only available units can be reserved");
    });
  });

  describe("4. Reservation, Dispatch, Receipt, and Transfusion Lifecycle", function () {
    let now, expiry;

    beforeEach(async function () {
      now = Math.floor(Date.now() / 1000);
      expiry = now + 35 * 24 * 3600;
      await contract.connect(bloodBank).registerBloodUnit(
        sampleUnitId,
        sampleBloodGroup,
        sampleComponent,
        now,
        expiry,
        initialHash
      );
      await contract.connect(bloodBank).updateScreeningStatus(sampleUnitId, 1, "Passed", updatedHash);
    });

    it("Should allow blood bank to reserve available unit for hospital request", async function () {
      await expect(
        contract.connect(bloodBank).reserveBloodUnit(
          sampleUnitId, hospitalA.address, "REQ-101", updatedHash,
          sampleBloodGroup, sampleComponent
        )
      )
        .to.emit(contract, "BloodUnitReserved")
        .withArgs(sampleUnitId, hospitalA.address, "REQ-101", updatedHash);

      const unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.status).to.equal(4); // Reserved
      expect(unit.hospital).to.equal(hospitalA.address);
    });

    it("Should prevent double reservation of the same unit", async function () {
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, "REQ-101", updatedHash,
        sampleBloodGroup, sampleComponent
      );

      await expect(
        contract.connect(bloodBank).reserveBloodUnit(
          sampleUnitId, hospitalB.address, "REQ-102", updatedHash,
          sampleBloodGroup, sampleComponent
        )
      ).to.be.revertedWith("Only available units can be reserved");
    });

    it("Should reject reservation when blood group does not match request", async function () {
      await expect(
        contract.connect(bloodBank).reserveBloodUnit(
          sampleUnitId, hospitalA.address, "REQ-103", updatedHash,
          "AB-", sampleComponent
        )
      ).to.be.revertedWith("Unit blood group does not match request");
    });

    it("Should reject reservation when component type does not match request", async function () {
      await expect(
        contract.connect(bloodBank).reserveBloodUnit(
          sampleUnitId, hospitalA.address, "REQ-104", updatedHash,
          sampleBloodGroup, "Platelets"
        )
      ).to.be.revertedWith("Unit component type does not match request");
    });

    it("Should complete dispatch and receipt cycle", async function () {
      // 1. Reserve
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, "REQ-101", updatedHash,
        sampleBloodGroup, sampleComponent
      );

      // 2. Dispatch
      await expect(
        contract.connect(bloodBank).dispatchBloodUnit(
          sampleUnitId,
          hospitalA.address,
          "WAYBILL-9901-COLD",
          updatedHash
        )
      )
        .to.emit(contract, "BloodUnitDispatched")
        .withArgs(sampleUnitId, bloodBank.address, hospitalA.address, "WAYBILL-9901-COLD", updatedHash);

      let unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.status).to.equal(5); // Dispatched

      // 3. Receipt by authorized hospital
      await expect(
        contract.connect(hospitalA).receiveBloodUnit(sampleUnitId, updatedHash)
      ).to.emit(contract, "BloodUnitReceived");

      unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.status).to.equal(6); // Received
      expect(unit.currentCustodian).to.equal(hospitalA.address);

      // 4. Transfusion to patient
      const patientHash = "0xaa54b9d034293fbf04b3ae986ef6da5100000000000000000000000000000001";
      await expect(
        contract.connect(hospitalA).transfuseBloodUnit(sampleUnitId, patientHash, updatedHash)
      )
        .to.emit(contract, "BloodUnitTransfused")
        .withArgs(sampleUnitId, hospitalA.address, patientHash, (val) => true, updatedHash);

      unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.status).to.equal(7); // Transfused
    });

    it("Should reject receipt from unauthorized hospital", async function () {
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, "REQ-101", updatedHash,
        sampleBloodGroup, sampleComponent
      );
      await contract.connect(bloodBank).dispatchBloodUnit(sampleUnitId, hospitalA.address, "WAYBILL-1", updatedHash);

      // Hospital B tries to claim unit assigned to Hospital A
      await expect(
        contract.connect(hospitalB).receiveBloodUnit(sampleUnitId, updatedHash)
      ).to.be.revertedWith("Caller is not designated hospital");
    });
  });

  describe("5. Emergency Inter-Hospital Transfer", function () {
    const transferId = "EMG-TR-5001";

    beforeEach(async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;
      await contract.connect(bloodBank).registerBloodUnit(sampleUnitId, sampleBloodGroup, sampleComponent, now, expiry, initialHash);
      await contract.connect(bloodBank).updateScreeningStatus(sampleUnitId, 1, "Passed", updatedHash);
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, "REQ-A", updatedHash,
        sampleBloodGroup, sampleComponent
      );
      await contract.connect(bloodBank).dispatchBloodUnit(sampleUnitId, hospitalA.address, "SHIP-1", updatedHash);
      await contract.connect(hospitalA).receiveBloodUnit(sampleUnitId, updatedHash);
    });

    it("Should allow emergency request and completion between hospitals", async function () {
      // Hospital B requests emergency transfer from Hospital A
      await expect(
        contract.connect(hospitalB).createEmergencyTransfer(transferId, sampleUnitId, hospitalA.address, "CRITICAL")
      )
        .to.emit(contract, "EmergencyRequestCreated")
        .withArgs(transferId, sampleUnitId, hospitalB.address, hospitalA.address, "CRITICAL");

      // Hospital B completes the receipt
      await expect(
        contract.connect(hospitalB).completeEmergencyTransfer(transferId, updatedHash)
      )
        .to.emit(contract, "BloodTransferCompleted")
        .withArgs(transferId, sampleUnitId, hospitalB.address, (val) => true);

      const unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.currentCustodian).to.equal(hospitalB.address);
      expect(unit.hospital).to.equal(hospitalB.address);
    });
  });

  describe("6. Expiry, Discard & Data Integrity Verification", function () {
    it("Should record discard with reason", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;
      await contract.connect(bloodBank).registerBloodUnit(sampleUnitId, sampleBloodGroup, sampleComponent, now, expiry, initialHash);

      await expect(
        contract.connect(bloodBank).discardBloodUnit(sampleUnitId, "Hemolysis detected", updatedHash)
      )
        .to.emit(contract, "BloodUnitDiscarded")
        .withArgs(sampleUnitId, bloodBank.address, "Hemolysis detected", (val) => true, updatedHash);

      const unit = await contract.getBloodUnit(sampleUnitId);
      expect(unit.status).to.equal(10); // Discarded
    });

    it("Should verify data integrity hash matches and detect tampering", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;
      await contract.connect(bloodBank).registerBloodUnit(sampleUnitId, sampleBloodGroup, sampleComponent, now, expiry, initialHash);

      // Verify authentic hash
      const isValid = await contract.verifyDataIntegrity(sampleUnitId, initialHash);
      expect(isValid).to.be.true;

      // Tampered hash check
      const tamperedHash = "9999999999999999999999999999999999999999999999999999999999999999";
      const isTamperedValid = await contract.verifyDataIntegrity(sampleUnitId, tamperedHash);
      expect(isTamperedValid).to.be.false;
    });

    it("Should preserve complete chronological event history", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 35 * 24 * 3600;
      await contract.connect(bloodBank).registerBloodUnit(sampleUnitId, sampleBloodGroup, sampleComponent, now, expiry, initialHash);
      await contract.connect(bloodBank).updateScreeningStatus(sampleUnitId, 1, "Passed", updatedHash);
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, "REQ-HIST", updatedHash,
        sampleBloodGroup, sampleComponent
      );

      const events = await contract.getUnitEvents(sampleUnitId);
      expect(events.length).to.equal(3);
      expect(events[0].eventType).to.equal("BloodUnitRegistered");
      expect(events[1].eventType).to.equal("ScreeningPassed");
      expect(events[2].eventType).to.equal("BloodUnitReserved");
    });
  });

  describe("7. approveBloodRequest & fulfillBloodRequest Guards", function () {
    const reqId = "REQ-GUARD-001";
    let now, expiry;

    beforeEach(async function () {
      now = Math.floor(Date.now() / 1000);
      expiry = now + 35 * 24 * 3600;

      // Register, screen, reserve, dispatch, receive — unit is now in Received state
      await contract.connect(bloodBank).registerBloodUnit(
        sampleUnitId, sampleBloodGroup, sampleComponent, now, expiry, initialHash
      );
      await contract.connect(bloodBank).updateScreeningStatus(sampleUnitId, 1, "Passed", updatedHash);
      // NOTE: approveBloodRequest is called BEFORE reserve — unit must be Available at approval time
    });

    // ── approveBloodRequest guards ────────────────────────────────────────────

    it("Should approve a blood request and lock the unit into the record", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      const rec = await contract.bloodRequests(reqId);
      expect(rec.isApproved).to.be.true;
      expect(rec.isFulfilled).to.be.false;
      expect(rec.hospital).to.equal(hospitalA.address);
      expect(rec.assignedBloodBank).to.equal(bloodBank.address);
      expect(rec.assignedUnitId).to.equal(sampleUnitId);
    });

    it("Should reject duplicate approval of the same request ID", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      await expect(
        contract.connect(bloodBank).approveBloodRequest(
          reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
        )
      ).to.be.revertedWith("Request already approved");
    });

    it("Should reject approval for an unauthorized hospital address", async function () {
      await expect(
        contract.connect(bloodBank).approveBloodRequest(
          "REQ-GUARD-002", unauthorizedUser.address, sampleBloodGroup, sampleComponent, sampleUnitId
        )
      ).to.be.revertedWith("Hospital is not authorized");
    });

    it("Should reject approval when unit blood group does not match request", async function () {
      await expect(
        contract.connect(bloodBank).approveBloodRequest(
          "REQ-GUARD-BG", hospitalA.address, "AB-", sampleComponent, sampleUnitId
        )
      ).to.be.revertedWith("Unit blood group does not match request");
    });

    it("Should reject approval when component type does not match request", async function () {
      await expect(
        contract.connect(bloodBank).approveBloodRequest(
          "REQ-GUARD-CT", hospitalA.address, sampleBloodGroup, "Platelets", sampleUnitId
        )
      ).to.be.revertedWith("Unit component type does not match request");
    });

    it("Should reject approval when unit belongs to a different blood bank", async function () {
      // Register a second blood bank and try to approve using bloodBank's unit
      await contract.registerBloodBank(unauthorizedUser.address, "Second Blood Bank", "BB-LIC-002", true);
      await expect(
        contract.connect(unauthorizedUser).approveBloodRequest(
          "REQ-GUARD-BB", hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
        )
      ).to.be.revertedWith("Unit does not belong to this blood bank");
    });

    it("Should reject approval when unit is not Available (e.g. still Collected)", async function () {
      const unitId2 = "BLD-GUARD-NOTAVAIL";
      await contract.connect(bloodBank).registerBloodUnit(
        unitId2, sampleBloodGroup, sampleComponent, now, expiry, initialHash
      );
      // Unit is Collected — screening not done yet
      await expect(
        contract.connect(bloodBank).approveBloodRequest(
          "REQ-GUARD-NA", hospitalA.address, sampleBloodGroup, sampleComponent, unitId2
        )
      ).to.be.revertedWith("Unit is not available for this request");
    });

    // ── fulfillBloodRequest guards ────────────────────────────────────────────

    it("Should fulfill a request after unit is received and emit BloodRequestFulfilled", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      // Reserve → dispatch → receive the locked unit
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, reqId, updatedHash, sampleBloodGroup, sampleComponent
      );
      await contract.connect(bloodBank).dispatchBloodUnit(sampleUnitId, hospitalA.address, "SHIP-G1", updatedHash);
      await contract.connect(hospitalA).receiveBloodUnit(sampleUnitId, updatedHash);

      await expect(
        contract.connect(bloodBank).fulfillBloodRequest(reqId)
      )
        .to.emit(contract, "BloodRequestFulfilled")
        .withArgs(reqId, sampleUnitId, hospitalA.address, bloodBank.address);

      const rec = await contract.bloodRequests(reqId);
      expect(rec.isFulfilled).to.be.true;
    });

    it("Should reject fulfillment before unit is received (unit still Available)", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      // Unit is Available — not yet dispatched/received
      await expect(
        contract.connect(bloodBank).fulfillBloodRequest(reqId)
      ).to.be.revertedWith("Unit must be received before fulfillment");
    });

    it("Should reject fulfillment before unit is received (unit only Dispatched)", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, reqId, updatedHash, sampleBloodGroup, sampleComponent
      );
      await contract.connect(bloodBank).dispatchBloodUnit(sampleUnitId, hospitalA.address, "SHIP-G1", updatedHash);
      // Unit is Dispatched — not yet received
      await expect(
        contract.connect(bloodBank).fulfillBloodRequest(reqId)
      ).to.be.revertedWith("Unit must be received before fulfillment");
    });

    it("Should reject fulfillment from a different (wrong) blood bank", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, reqId, updatedHash, sampleBloodGroup, sampleComponent
      );
      await contract.connect(bloodBank).dispatchBloodUnit(sampleUnitId, hospitalA.address, "SHIP-G1", updatedHash);
      await contract.connect(hospitalA).receiveBloodUnit(sampleUnitId, updatedHash);

      await contract.registerBloodBank(unauthorizedUser.address, "Second Blood Bank", "BB-LIC-002", true);
      await expect(
        contract.connect(unauthorizedUser).fulfillBloodRequest(reqId)
      ).to.be.revertedWith("Not the assigned blood bank");
    });

    it("Should reject double fulfillment of the same request", async function () {
      await contract.connect(bloodBank).approveBloodRequest(
        reqId, hospitalA.address, sampleBloodGroup, sampleComponent, sampleUnitId
      );
      await contract.connect(bloodBank).reserveBloodUnit(
        sampleUnitId, hospitalA.address, reqId, updatedHash, sampleBloodGroup, sampleComponent
      );
      await contract.connect(bloodBank).dispatchBloodUnit(sampleUnitId, hospitalA.address, "SHIP-G1", updatedHash);
      await contract.connect(hospitalA).receiveBloodUnit(sampleUnitId, updatedHash);
      await contract.connect(bloodBank).fulfillBloodRequest(reqId);

      await expect(
        contract.connect(bloodBank).fulfillBloodRequest(reqId)
      ).to.be.revertedWith("Request already fulfilled");
    });
  });
});
