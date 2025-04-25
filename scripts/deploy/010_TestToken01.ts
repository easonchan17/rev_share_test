import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { BigNumber } from 'ethers';
import { AccountMgr } from '../common/accountMgr';
import { checkDeployerSufficientBalance } from '../common/utils';
import logger from 'node-color-log';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, network } = hre;
    const { deploy } = deployments;
    const deployer = new AccountMgr().getDeployer()?.address!;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Deploy Test Token01 ...");

    await checkDeployerSufficientBalance(BigNumber.from(10).pow(18));

    const amount = BigNumber.from(10).pow(30);

    const args = [
        amount
    ];

    const deployedContract = await deploy("TT01", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args
    });
};

export default func;
func.tags = ["TT01"];
