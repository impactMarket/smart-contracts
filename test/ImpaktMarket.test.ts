import { should } from 'chai';
import { ImpactMarketInstance, CommunityInstance, cUSDInstance } from '../types/truffle-contracts';
import BigNumber from 'bignumber.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { expectRevert, time } = require('@openzeppelin/test-helpers');


const ImpactMarket = artifacts.require('./ImpactMarket.sol') as Truffle.Contract<ImpactMarketInstance>;
const Community = artifacts.require('./Community.sol') as Truffle.Contract<CommunityInstance>;
const cUSD = artifacts.require('./test/cUSD.sol') as Truffle.Contract<cUSDInstance>;
should();
enum BeneficiaryState {
    NONE = '0',
    Accepted = '1',
    Locked = '2',
    Removed = '3',
}


BigNumber.config({ EXPONENTIAL_AT: 25 })
/** @test {ImpactMarket} contract */
contract('ImpactMarket', async (accounts) => {
    const adminAccount = accounts[0];
    // community managers
    const communityA = accounts[1];
    const communityB = accounts[2];
    const communityC = accounts[3];
    // beneficiaries
    const userA = accounts[4];
    const userB = accounts[5];
    // contract instances
    let impactMarketInstance: ImpactMarketInstance;
    let communityInstance: CommunityInstance;
    let cUSDInstance: cUSDInstance;

    describe('Community - User', () => {
        beforeEach(async () => {
            cUSDInstance = await cUSD.new();
            impactMarketInstance = await ImpactMarket.new(cUSDInstance.address);
        });

        it('should add user to community', async () => {
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.NONE);
            await communityInstance.addBeneficiary(userA, { from: communityA });
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.Accepted);
        });

        it('should lock user from community', async () => {
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.NONE);
            await communityInstance.addBeneficiary(userA, { from: communityA });
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.Accepted);
            await communityInstance.lockBeneficiary(userA, { from: communityA });
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.Locked);
        });

        it('should remove user from community', async () => {
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.NONE);
            await communityInstance.addBeneficiary(userA, { from: communityA });
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.Accepted);
            await communityInstance.removeBeneficiary(userA, { from: communityA });
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.Removed);
        });
    });

    describe('Community - Claim', () => {
        beforeEach(async () => {
            cUSDInstance = await cUSD.new();
            impactMarketInstance = await ImpactMarket.new(cUSDInstance.address);
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
            await cUSDInstance.testFakeFundAddress(communityAddress, { from: adminAccount });
            await communityInstance.addBeneficiary(userA, { from: communityA });
        });

        it('should not claim without belong to community', async () => {
            await expectRevert(
                communityInstance.claim({ from: userB }),
                "NOT_BENEFICIARY"
            );
        });

        it('should not claim after locked from community', async () => {
            await communityInstance.lockBeneficiary(userA, { from: communityA });
            await expectRevert(
                communityInstance.claim({ from: userA }),
                "LOCKED"
            );
        });

        it('should not claim after removed from community', async () => {
            await communityInstance.removeBeneficiary(userA, { from: communityA });
            await expectRevert(
                communityInstance.claim({ from: userA }),
                "REMOVED"
            );
        });

        it('should not claim without waiting', async () => {
            await expectRevert(
                communityInstance.claim({ from: userA }),
                "NOT_YET"
            );
        });

        it('should claim after waiting', async () => {
            await time.increase(time.duration.seconds(86405));
            await communityInstance.claim({ from: userA });
            (await cUSDInstance.balanceOf(userA)).toString()
                .should.be.equal(new BigNumber(10).pow(18).multipliedBy(2).toString());
        });
    });

    describe('Community - Governance', () => {
        beforeEach(async () => {
            cUSDInstance = await cUSD.new();
            impactMarketInstance = await ImpactMarket.new(cUSDInstance.address);
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
        });

        it('should not be able to add coordinator to community if not coordinator', async () => {
            await expectRevert(
                communityInstance.addCoordinator(communityB, { from: communityC }),
                "NOT_COORDINATOR"
            );
        });

        it('should not be able to remove coordinator from community if not coordinator', async () => {
            await communityInstance.addCoordinator(communityB, { from: communityA });
            await expectRevert(
                communityInstance.removeCoordinator(communityB, { from: communityC }),
                "NOT_COORDINATOR"
            );
        });

        it('should be able to add coordinator to community if coordinator', async () => {
            await communityInstance.addCoordinator(communityB, { from: communityA });
        });

        it('should be able to add coordinator to community if coordinator', async () => {
            await communityInstance.addCoordinator(communityB, { from: communityA });
            await communityInstance.removeCoordinator(communityB, { from: communityA });
        });
    });

    describe('ImpactMarket', () => {
        beforeEach(async () => {
            cUSDInstance = await cUSD.new();
            impactMarketInstance = await ImpactMarket.new(cUSDInstance.address);
        });

        it('should add a community', async () => {
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000').multipliedBy(new BigNumber(10).pow(18)), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
            (await communityInstance.amountByClaim()).toString().should.be.equal(
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)).toString()
            );
            (await communityInstance.baseIntervalTime()).toString().should.be.equal('86400');
            (await communityInstance.incIntervalTime()).toString().should.be.equal('3600');
            (await communityInstance.claimHardCap()).toString().should.be.equal(
                new BigNumber('1000').multipliedBy(new BigNumber(10).pow(18)).toString()
            );

        });

        it('should remove a community', async () => {
            const tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            await impactMarketInstance.removeCommunity(communityAddress, { from: adminAccount });
        });
    });

    describe('Test complete flow', async () => {
        it('one user to one community', async () => {
            let tx;
            let blockData;
            cUSDInstance = await cUSD.new();
            impactMarketInstance = await ImpactMarket.new(cUSDInstance.address);
            tx = await impactMarketInstance.addCommunity(
                communityA,
                new BigNumber('2').multipliedBy(new BigNumber(10).pow(18)), // amount by claim
                new BigNumber('86400'), // base interval time in ms
                new BigNumber('3600'), // increment interval time in ms
                new BigNumber('1000'), // claim hardcap
                { from: adminAccount },
            );
            const communityAddress = tx.logs[0].args[0];
            communityInstance = await Community.at(communityAddress);
            await cUSDInstance.testFakeFundAddress(communityAddress, { from: adminAccount });
            tx = await communityInstance.addBeneficiary(
                userA,
                { from: communityA },
            );
            blockData = await web3.eth.getBlock(tx.receipt.blockNumber);
            (await communityInstance.beneficiaries(userA)).toString().should.be.equal(BeneficiaryState.Accepted);
            (await communityInstance.cooldownClaim(userA)).toNumber().should.be.equal(blockData.timestamp + 86400);

            await time.increase(time.duration.seconds(86405)); // base interval + 5
            tx = await communityInstance.claim({ from: userA });
            (await cUSDInstance.balanceOf(userA)).toString()
                .should.be.equal(new BigNumber(10).pow(18).multipliedBy(2).toString());

            blockData = await web3.eth.getBlock(tx.receipt.blockNumber);
            (await communityInstance.cooldownClaim(userA)).toNumber().should.be.equal(blockData.timestamp + 3600);
            await expectRevert(
                communityInstance.claim({ from: userA }),
                "NOT_YET"
            );

            await time.increase(time.duration.seconds(3605)); // increment interval + 5
            await communityInstance.claim({ from: userA });
            (await cUSDInstance.balanceOf(userA)).toString()
                .should.be.equal(new BigNumber(10).pow(18).multipliedBy(4).toString());
        });
    });
});