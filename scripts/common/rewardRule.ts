import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Configuration } from "./configuration";
import { assert } from "console";
import { Account, AccountMgr } from "./accountMgr";

// =============begin local type============
type Reward = {
    address: string;
    percentage: number
};

type Rule = {
    signature: string;
    gas: BigNumber;
    rewards: Reward[];
};

enum SourceType {
    Event = 1,
    Function
};

type SourceState = {
    signature: string;
    type: SourceType;
    enabled: boolean;
}

export type Config = {
    address: string;
    isActive: boolean;
    events: Rule[];
    functions: Rule[];
};
// ==============end local type=============

// =============begin contract type=========
export type AdaptReward = {
    rewardAddr: string;
    rewardPercentage: number;
}

export type AdaptEvent = {
    eventSignature: string;
    gas: BigNumber;
    rewards: AdaptReward[];
}

export type AdaptFunction = {
    functionSignature: string;
    gas: BigNumber;
    rewards: AdaptReward[];
}

export type AdaptConfig = {
    configAddress: string;
    isActive: boolean;
    events: AdaptEvent[];
    functionSignatures: AdaptFunction[];
}
// =============end contract type===========

export class RewardRule {
    // Contract inst
    private contract: any;

    // Event or function information that triggers reward distribution
    private sources: Record<string, SourceState> = {};

    // Relevant beneficiary addresses of the current contract
    private beneficiaries: Record<string, Account> = {};

    private feeConfig: Configuration;

    constructor(contract: any, config: Configuration) {
        this.contract = contract;
        this.feeConfig = config;
    }

    addEvent(source: string) {
        source = source.trim();
        if (!source) return;

        const topic = this.contract.interface.getEventTopic(source);

        this.sources[source] = {
            signature: topic,
            type: SourceType.Event,
            enabled: false
        }
    }

    addFunction(source: string) {
        source = source.trim();
        if (!source) return;

        // const selector = this.contract.interface.getSighash(source);
        const fragment = this.contract.interface.getFunction(source);
        const signature = ethers.utils.id(fragment.format());

        this.sources[source] = {
            signature: signature,
            type: SourceType.Function,
            enabled: false
        }
    }

    async initBeneficiaries(): Promise<boolean> {
        const maxNum = await this.feeConfig.getMaxBeneficiaryNum();
        assert(maxNum > 0, `Invalid max beneficiary num`);

        const accountMgr = new AccountMgr();
        this.beneficiaries = accountMgr.generateAccounts(maxNum);

        return Object.keys(this.beneficiaries).length == maxNum;
    }

    async generate(): Promise<Config> {
        const config: Config= {
            address: this.contract.address,
            isActive: false,
            events: [],
            functions: []
        }

        const maxGas = await this.feeConfig.getMaxGas();
        const totalShare = this.feeConfig.getTotalShare();

        // Generate reward configuration for each source
        Object.values(this.sources).forEach(state => {
            const rule: Rule = this.buildRule(maxGas, totalShare, state)

            if (state.type == SourceType.Event) {
                config.events.push(rule);
            } else if (state.type == SourceType.Function) {
                config.functions.push(rule);
            } else {
                assert(false, `Invalid source state type ${state.type}`);
            }
        })

        return config;
    }

    static adaptConfig(config: Config): AdaptConfig {
        let adaptedConfig: AdaptConfig = {
            configAddress: config.address,
            isActive: config.isActive,
            events:[],
            functionSignatures:[]
        };

        // Adapt events
        for (const event of config.events) {
            let adaptedEvent: AdaptEvent = {
                eventSignature: event.signature,
                gas: event.gas,
                rewards: [],
            };

            for (const reward of event.rewards) {
                let adaptedReward: AdaptReward = {
                    rewardAddr: reward.address,
                    rewardPercentage: reward.percentage
                };

                adaptedEvent.rewards.push(adaptedReward);
            }

            adaptedConfig.events.push(adaptedEvent);
        }

        // Adapt functions
        for (const func of config.functions) {
            let adaptedFunction: AdaptFunction = {
                functionSignature: func.signature,
                gas: func.gas,
                rewards: []
            };

            for (const reward of func.rewards) {
                let adaptedReward: AdaptReward = {
                    rewardAddr: reward.address,
                    rewardPercentage: reward.percentage
                };

                adaptedFunction.rewards.push(adaptedReward);
            }

            adaptedConfig.functionSignatures.push(adaptedFunction);
        }

        return adaptedConfig;
    }

    private buildRule(
        maxGas: BigNumber,
        totalShare: number,
        sourceState: SourceState
    ): Rule {
        const count = Object.keys(this.beneficiaries).length
        assert(count, `Invalid beneficiaries`);

        const avg = Math.floor(totalShare * 0.8 / count);
        let remain = totalShare - avg * count;

        let rewards: Reward[] = [];
        Object.keys(this.beneficiaries).forEach(beneficiary => {
            const addition = Math.floor(Math.random() * remain);

            let reward: Reward = {
                address: beneficiary,
                percentage: avg + addition
            }

            rewards.push(reward);
            remain -= addition;
        })

        if (remain > 0) {
            rewards[rewards.length-1].percentage += remain;
        }

        return {
            signature: sourceState.signature,
            gas: maxGas,
            rewards: rewards
        };
    }
};