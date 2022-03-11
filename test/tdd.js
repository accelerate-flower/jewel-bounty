const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("JewelDisburse", function () {
  var lastMinedTime = Math.floor(Date.now() / 1000);

  it("Verify no initial disbursements", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
  
    await jd.deployed();
  
    await expect(await jd.totalVested(addr1.address))
      .to.equal(0, "Nothing vested");

    await expect(await jd.totalUnclaimed(addr1.address))
      .to.equal(0, "Nothing unclaimed");

    await expect(await jd.totalClaimed(addr1.address))
      .to.equal(0, "Nothing claimed");  
  });

  it("Verify disbursement adds", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
  
    await jd.deployed();

    await expect(await jd.connect(owner).addDisbursement(addr1.address, 10, lastMinedTime, lastMinedTime))
      .to.emit(
        jd,
        "DisbursementAdded"
      )
      .withArgs(addr1.address, 10, lastMinedTime, lastMinedTime);
  
    await expect(await jd.totalVested(addr1.address))
      .to.equal(10, "Fully vested");

    await expect(await jd.totalUnclaimed(addr1.address))
      .to.equal(0, "Fully unclaimed");

    await expect(await jd.totalClaimed(addr1.address))
      .to.equal(0, "Nothing claimed");  
  });

  it("Verify multiple disbursements", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
  
    await jd.deployed();

    await expect(await jd.connect(owner).addDisbursement(addr1.address, 100, lastMinedTime, lastMinedTime))
      .to.emit(
        jd,
        "DisbursementAdded"
      )
      .withArgs(addr1.address, 100, lastMinedTime, lastMinedTime);

    await expect(await jd.getDisbursements(addr1.address))
      .to.lengthOf(1);  

    await expect(await jd.connect(owner).addDisbursement(addr1.address, 100, lastMinedTime + 1, lastMinedTime + 1))
      .to.emit(
        jd,
        "DisbursementAdded"
      )
      .withArgs(addr1.address, 100, lastMinedTime + 1, lastMinedTime + 1);  
  
    await expect(await jd.getDisbursements(addr1.address))
      .to.lengthOf(2);
  });

  it("Verify partially vested", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
  
    await jd.deployed();

    await expect(await jd.connect(owner).addDisbursement(addr1.address, 100, lastMinedTime, lastMinedTime + 100))
      .to.emit(
        jd,
        "DisbursementAdded"
      )
      .withArgs(addr1.address, 100, lastMinedTime, lastMinedTime + 100);
  
    await ethers.provider.send("evm_mine", [lastMinedTime + 75]);
    lastMinedTime += 80;
    await expect(await jd.totalVested(addr1.address))
      .to.equal(75, "Partially vested");

    await expect(await jd.totalUnclaimed(addr1.address))
      .to.equal(25, "Partially unclaimed");

    await expect(await jd.totalClaimed(addr1.address))
      .to.equal(0, "Nothing claimed");  
  });

  it("Verify can claim", async function () {
    // This test currenlty only works when commenting out jewelToken.transfer in the claim function.
    // This is not ideal, but without being able to deploy the IJewelToken (or having a valid address for it), can't currently test with in.
    const [owner, addr1] = await ethers.getSigners();
    /*const JEWEL = await ethers.getContractFactory("IJewelToken");
    const jewel = await JEWEL.deploy();
    await jewel.deployed();*/
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
    await jd.deployed();

    await jd.connect(owner).addDisbursement(addr1.address, 100, lastMinedTime, lastMinedTime)
  
    await ethers.provider.send("evm_mine", [lastMinedTime + 1]);
    lastMinedTime += 5;
    await expect(await jd.totalVested(addr1.address))
      .to.equal(100, "Verify unclaimed");
    await expect(await jd.totalClaimed(addr1.address))
      .to.equal(0, "Nothing claimed");

    await expect(await jd.connect(addr1).claim(50))
      .to.emit(
        jd,
        "DisbursementClaim"
      )
      .withArgs(1, addr1.address, 50);

    await expect(await jd.totalVested(addr1.address))
      .to.equal(50, "Verify unclaimed");
    await expect(await jd.totalClaimed(addr1.address))
      .to.equal(50, "Partially claimed");  
  });

  it("Verify cannot overclaim", async function () {
    // This test currenlty only works when commenting out jewelToken.transfer in the claim function.
    const [owner, addr1] = await ethers.getSigners();
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
    await jd.deployed();

    await jd.connect(owner).addDisbursement(addr1.address, 100, lastMinedTime, lastMinedTime)
  
    await ethers.provider.send("evm_mine", [lastMinedTime + 1]);
    lastMinedTime += 5;

    await expect(await jd.connect(addr1).claim(1000))
      .to.emit(
        jd,
        "DisbursementClaim"
      )
      .withArgs(1, addr1.address, 100);
  });

  it("Verify can claim across disbursements", async function () {
    // This test currenlty only works when commenting out jewelToken.transfer in the claim function.
    const [owner, addr1] = await ethers.getSigners();
    const JD = await ethers.getContractFactory("JewelDisburse");
    const jd = await upgrades.deployProxy(JD, [owner.address]);
    await jd.deployed();

    await jd.connect(owner).addDisbursement(addr1.address, 10, lastMinedTime, lastMinedTime)
    await jd.connect(owner).addDisbursement(addr1.address, 10, lastMinedTime, lastMinedTime)
  
    await ethers.provider.send("evm_mine", [lastMinedTime + 1]);
    lastMinedTime += 5;

    await expect(await jd.connect(addr1).claim(1000))
      .to.emit(
        jd,
        "DisbursementClaim"
      )
      .withArgs(1, addr1.address, 10)
      .to.emit(
        jd,
        "DisbursementClaim"
      )
      .withArgs(2, addr1.address, 10);
  });
});