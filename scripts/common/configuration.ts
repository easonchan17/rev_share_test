import { BigNumber } from "ethers";
import { isAddress } from "ethers/lib/utils";
import { assert } from 'console';
import { ethers } from "hardhat";
import { Provider } from "./provider";
import { AccountMgr } from "./accountMgr";
import config from 'config';
import { AdaptConfig, AdaptEvent, AdaptFunction, Config, RewardRule } from "./rewardRule";
import util from "util"

export class Configuration {
    // readonly jsonFile:string = `db/${process.env.NETWORK}/configs.json`;

    address: string;
    abi: string;
    deployer: any;
    providerInst: any;
    contract: any;

    configs: Record<string, AdaptConfig> = {};

    constructor() {
        this.address = config.get("system_contracts.configuration.address");
        assert(isAddress(this.address), "Invalid Configuration Address!");
        this.abi = config.get("system_contracts.configuration.abi");

        this.providerInst = new Provider().getProviderInst();

        this.deployer = new AccountMgr().getDeployer();
        assert(this.deployer != null, `Invalid deployer`);

        const wallet = new ethers.Wallet(this.deployer?.privateKey!, this.providerInst);
        this.contract = new ethers.Contract(this.address, this.abi, wallet);
    }

    async log() {
        console.log({
            admin: await this.getAdmin(),
            maxGas: (await this.getMaxGas()).toString(),
            totalShare: (this.getTotalShare()).toString(),
            maxBeneficiaryNum: (await this.getMaxBeneficiaryNum()).toString(),
            maxEventNum: (await this.getMaxEventNum()).toString(),
            maxFunctionNum: (await this.getMaxFunctionNum()).toString()
        });
    }

    async isInited(): Promise<boolean> {
        return await this.contract.alreadyInit();
    }

    async getAdmin(): Promise<string> {
        return await this.contract.daoAddress();
    }

    getTotalShare(): number {
        return 10000;
    }

    async getMaxGas(): Promise<BigNumber> {
        return await this.contract.MAX_GAS();
    }

    async getMaxBeneficiaryNum(): Promise<number> {
        return await this.contract.MAX_REWARDS();
    }

    async getMaxEventNum(): Promise<number> {
        return await this.contract.MAX_EVENTS();
    }

    async getMaxFunctionNum(): Promise<number> {
        return await this.contract.MAX_FUNCTIONS();
    }

    async init(): Promise<boolean> {
        let inited: boolean = await this.isInited();

        if (!inited) {
            const tx = await this.contract.init();
            const receipt = await tx.wait();
            console.log(`Init tx hash: ${receipt.transactionHash}`);
            inited = true;
        }

        console.log(`Init Configuration ${inited? 'success' : 'failed'}`);
        return inited;
    }

    async addConfig(config: Config): Promise<boolean> {
        const adaptedConfig: AdaptConfig = RewardRule.adaptConfig(config);
        console.log(util.inspect(adaptedConfig, {
            depth: null,
            colors: true
        }));

        let ok = false;

        try {
            const tx = await this.contract.addConfig(
                adaptedConfig.configAddress,
                adaptedConfig.events,
                adaptedConfig.functionSignatures,
                adaptedConfig.isActive
            );
            await tx.wait();
            ok = true;

            // this.configs = this.loadConfigs();
            // this.configs[adaptedConfig.configAddress] = adaptedConfig;
            // this.saveConfigs();

        } catch (error) {
            this.showCustomerError(error);
        }

        return ok;
    }

    async updateConfig(config: Config): Promise<boolean> {
        const adaptedConfig: AdaptConfig = RewardRule.adaptConfig(config);
        console.log(util.inspect(adaptedConfig, {
            depth: null,
            colors: true
        }));

        let ok = false;

        try {
            const tx = await this.contract.updateConfig(
                adaptedConfig.configAddress,
                adaptedConfig.events,
                adaptedConfig.functionSignatures
            );

            await tx.wait();
            ok = true;

            // this.configs = this.loadConfigs();
            // this.configs[adaptedConfig.configAddress] = adaptedConfig;
            // this.saveConfigs();
        } catch (error) {
            this.showCustomerError(error);
        }

        return ok;
    }

    async removeConfig(address: string): Promise<boolean> {
        let ok = false;
        if (!ethers.utils.isAddress(address)) return ok;

        try {
            const tx = await this.contract.removeConfig(
                address
            );

            await tx.wait();
            ok = true;

            // this.configs = this.loadConfigs();
            // delete this.configs[address];
            // this.saveConfigs();
        } catch (error) {
            this.showCustomerError(error);
        }

        return ok;
    }

    // async removeIssuer(address: string, issuer: string): Promise<boolean> {
    //     let ok = false;
    //     if (!ethers.utils.isAddress(address)) return ok;
    //     if (!ethers.utils.isAddress(issuer)) return ok;

    //     try {
    //         const tx = await this.contract.removeIssuer(
    //             address,
    //             issuer
    //         );

    //         await tx.wait();
    //         ok = true;

    //         // Update cache
    //         this.configs = this.loadConfigs();
    //         for (const event of this.configs[address].events) {
    //             const rewards = event.rewards;
    //             const count = rewards.length
    //             for (let i = count-1; i >= 0; --i) {
    //                 if (rewards[i].rewardAddr === issuer) {
    //                     rewards[i] = rewards[count-1];
    //                     rewards.pop();
    //                 }
    //             }
    //         }
    //         this.saveConfigs();

    //     } catch (error) {
    //         this.showError(error);
    //     }

    //     return ok;
    // }

    async setConfigStatus(address: string, status: boolean): Promise<boolean> {
        let ok: boolean = false;
        if (!ethers.utils.isAddress(address)) return ok;

        try {
            const tx = await this.contract.setConfigStatus(
                address,
                status
            );

            await tx.wait();
            ok = true;

            // this.configs = this.loadConfigs();
            // this.configs[address].isActive = status;
            // this.saveConfigs();

        } catch (error) {
            this.showCustomerError(error);
        }

        return ok;
    }

    async getConfig(address: string, isShow=true): Promise<AdaptConfig|null> {
        let adaptedConfig: AdaptConfig|null = null;

        if (!ethers.utils.isAddress(address)) return adaptedConfig;

        try {
            const data = await this.contract.getConfig(address);
            assert(data.length === 4);
            adaptedConfig = {
                configAddress: data[0],
                isActive: data[1],
                events: [],
                functionSignatures: []
            }

            for (const event of data[2]) {
                assert(event.length === 3);
                let adaptedEvent: AdaptEvent = {
                    eventSignature: event[0],
                    gas: event[1],
                    rewards: []
                };

                for (const rewards of event[2]) {
                    assert(rewards.length === 2);
                    adaptedEvent.rewards.push({
                        rewardAddr: rewards[0],
                        rewardPercentage: rewards[1]
                    });
                }

                adaptedConfig.events.push(adaptedEvent);
            }

            for (const func of data[3]) {
                assert(func.length === 3);
                let adaptedFunc: AdaptFunction = {
                    functionSignature: func[0],
                    gas: func[1],
                    rewards: []
                }

                for (const rewards of func[2]) {
                    assert(rewards.length === 2);
                    adaptedFunc.rewards.push({
                        rewardAddr: rewards[0],
                        rewardPercentage: rewards[1]
                    });
                }

                adaptedConfig.functionSignatures.push(adaptedFunc);
            }

            if (isShow) {
                console.log(util.inspect(adaptedConfig, {
                    depth: null,
                    colors: true
                }));
            }
        } catch (error) {
            console.error(`Target config ${address}:`, error);
        }

        return adaptedConfig;
    }

    async getRevShareList(contractInst: any, eventName: string): Promise<AdaptEvent|null> {
        const rewardRule = new RewardRule(contractInst, this);
        const topic = rewardRule.getEventTopic(eventName)
        if (!topic) return null;

        const adaptedConfig = await this.getConfig(contractInst.address, false);
        if (!adaptedConfig ||
            adaptedConfig.events.length === 0) return null;

        for (const event of adaptedConfig.events) {
            if (event.eventSignature === topic) {
                return event;
            }
        }

        return null;
    }

    async initAdmin(): Promise<boolean> {
        const oldAdmin = await this.getAdmin();
        const newAddress = this.deployer.address;

        assert(ethers.utils.isAddress(newAddress), `Invalid address!`);
        if (oldAdmin != newAddress) {
            const data = ethers.utils.RLP.encode([newAddress]);
            const method = "setDAOAddress";
            const tx = await this.contract.updateParam(
                method,
                data
            );

            const receipt = await tx.wait();
            console.log(`InitAdmin tx hash: ${receipt.transactionHash}`);
        }

        console.log(`Init Admin success`);
        return true;
    }

    // loadConfigs(): Record<string, AdaptConfig> {
    //     console.log(process.env.NETWORK)
    //     let configs: Record<string, AdaptConfig> = {};
    //     try {
    //         const ok = createDirIfNotExist(this.jsonFile);
    //         assert(ok);

    //         if (fs.existsSync(this.jsonFile)) {
    //             let content = fs.readFileSync(this.jsonFile, "utf-8");
    //             configs = JSON.parse(content.trim()) as Record<string, AdaptConfig>;
    //             console.log(`Load ${Object.keys(configs).length} configs from file`);
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }

    //     return configs;
    // }

    // private saveConfigs(): boolean {
    //     let ok = false;

    //     try {
    //         fs.writeFileSync(this.jsonFile, JSON.stringify(this.configs, null, 2));
    //         const count = Object.keys(this.configs).length
    //         console.log(`Save ${count} configs to file`);

    //         ok = true;
    //     } catch(error) {
    //         console.error(error);
    //     }

    //     return ok;
    // }

    private showCustomerError(error:any) {
        const reasonData = error.data || error.error?.data || error.error?.error?.data || error.error?.error?.error?.data;
        if (!reasonData) {
            console.error(error);
            return;
        }

        try {
            const iface = new ethers.utils.Interface(this.abi);
            const decoded = iface.parseError(reasonData);
            console.error('Custom Error:', decoded.name);
            console.error('Error args:', decoded.args);
        } catch (decodeErr) {
            console.error(decodeErr);
        }
    }
}