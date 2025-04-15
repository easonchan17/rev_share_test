import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { BigNumber } from 'ethers';
import { checkDeployerSufficientBalance } from '../common/utils';
import { AccountMgr } from '../common/accountMgr';
import logger from 'node-color-log';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, network } = hre;
    const { deploy } = deployments;
    const deployer = new AccountMgr().getDeployer()?.address!;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Deploy TokenTransferProxy ...");

    await checkDeployerSufficientBalance(BigNumber.from(10).pow(18));

    const deployedContract = await deploy("TokenTransferProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true
    });
};

export default func;
func.tags = ["TokenTransferProxy"];
