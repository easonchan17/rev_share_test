import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getContractInst } from '../common/utils';
import { assert } from 'console';
import { Configuration } from '../common/configuration';
import config from 'config';
import { BigNumber } from 'ethers';
import logger from 'node-color-log';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Check Tokens ...");

    const usdtInst = await getContractInst(deployments, "", "USDT", "");
    assert(usdtInst != null, "usdt inst is null");
    let symbol = await usdtInst?.symbol();
    let totalSupply = await usdtInst?.totalSupply();
    console.log(`${symbol}:${totalSupply}`);

    const usdcInst = await getContractInst(deployments, "", "USDC", "");
    assert(usdcInst != null, "usdc inst is null");
    symbol = await usdcInst?.symbol();
    totalSupply = await usdcInst?.totalSupply();
    console.log(`${symbol}:${totalSupply}`);


    const tt01Inst = await getContractInst(deployments, "", "TT01", "");
    assert(tt01Inst != null, "tt01 inst is null");
    symbol = await tt01Inst?.symbol();
    totalSupply = await tt01Inst?.totalSupply();
    console.log(`${symbol}:${totalSupply}`);


    const tt02Inst = await getContractInst(deployments, "", "TT02", "");
    assert(tt02Inst != null, "tt02 inst is null");
    symbol = await tt02Inst?.symbol();
    totalSupply = await tt02Inst?.totalSupply();
    console.log(`${symbol}:${totalSupply}`);

    const tokenTransferProxyInst = await getContractInst(deployments, "", "TokenTransferProxy", "");
    assert(tokenTransferProxyInst != null, "tokenTransferProxy inst is null");

    // Init TT01
    logger.color('blue').bold().log("Init TT01 ...");
    let oldCount = await tt01Inst!.additionEventCount();
    let newCount = BigNumber.from(config.get("test_contracts.tt01.addition_event_count"));
    if (!oldCount.eq(newCount)) {
        const tx = await tt01Inst!.setAdditionEventCount(newCount);
        await tx.wait();
    }
    console.log(`TT01 addition event count is ${newCount.toString()}, old value=${oldCount}`);

    // Init TT02
    logger.color('blue').bold().log("Init TT02 ...");
    oldCount = await tt02Inst!.additionEventCount();
    console.log(`TT02 addition event count is ${oldCount.toString()}`);

    // Init TokenTransferProxy
    logger.color('blue').bold().log("Init TokenTransferProxy ...");
    let tokenName = (config.get("test_contracts.token_transfer_proxy.token_name") as string).trim();
    if (tokenName.length > 0) {
        const tokenInst = await getContractInst(deployments, "", tokenName, "");
        assert(tokenInst, `Invalid token name ${tokenName}`);

        const tx = await tokenTransferProxyInst!.setTokenAddress(tokenInst!.address);
        await tx.wait();
    }
    console.log(`TokenTransferProxy logic token is ${await tokenTransferProxyInst!.tokenAddress()}`)

    // Init configuration
    logger.color('blue').bold().log("Init Fee Market Configuration ...");
    const feeConfigContract = new Configuration();
    let ok = await feeConfigContract.init();
    assert(ok, `Fee configuration init failed!`);

    ok = await feeConfigContract.initAdmin();
    assert(ok, `Fee configuration init admin failed!`);

    await feeConfigContract.log();
};

export default func;
func.tags = ["USDT"];
