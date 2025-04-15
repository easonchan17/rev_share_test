import * as readline from "readline";
import { assert } from 'console';
import { isAddress } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { AccountMgr } from "./accountMgr";
import { BigNumber, Contract } from "ethers";
import chalk from 'chalk';
import fs from "fs";
import path from "path";

export async function waitForInput(message:string): Promise<string> {
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
  });
  return new Promise((resolve) => {
      rl.question(chalk.blue(message), (input) => {
          rl.close();
          input = input.trim();
          resolve(input);
      });
  });
}

export async function promptPositiveInteger(prompt: string): Promise<number> {
  const input = await waitForInput(prompt);
  const value = parseInt(input, 10);
  if (isNaN(value) || value <= 0) {
      console.error("Invalid input. Please enter a positive integer.");
      return -1;
  }
  return value;
}


export async function getContractInst<T extends Contract>(
  component: any,
  proxyName: any,
  logicName: any,
  libName: any
):Promise<T|undefined> {
  let libraries:{[key:string]: string} = {};
  if (libName && libName.length > 0) {
    const libAddress = await checkComponentAddress(component, libName);
    assert(isAddress(libAddress), "Library address is invalid");

    if (isAddress(libAddress)) {
      libraries[libName as string] = libAddress as string;
    }
  }

  const logicFactory = await ethers.getContractFactory(
    logicName, {
        libraries: libraries
    }
  );

  let attachAddress: any;
  if (!proxyName || proxyName.length === 0) {
    attachAddress = await checkComponentAddress(component, logicName);
  } else {
    attachAddress = await checkComponentAddress(component, proxyName);
  }

  assert(isAddress(attachAddress), "Instance address is invalid");
  if (!isAddress(attachAddress)) return;

  return logicFactory.attach(attachAddress) as unknown as T;
}

export async function checkDeployerSufficientBalance(requiredAmount: BigNumber) {
  const accountMgr = new AccountMgr();
  await accountMgr.waitUntilSufficientBalance(
    accountMgr.getDeployer()!,
    requiredAmount
  );
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createDirIfNotExist(file:string) {
  let ok: boolean = false;

  const filePath = path.dirname(file);
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, {recursive: true});
    }

    ok = true;
  } catch (error) {
    console.error(error);
  }

  return ok;
}

export class ExecutionErrorMatcher {
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  update() {
    this.startTime = performance.now();
  }

  getElapsedTime(): string {
    return `${performance.now() - this.startTime} ms`;
  }

  filter(name: string, error: any) {
    console.error(`${name} ${performance.now()-this.startTime}ms:`, error);
  }
}

async function checkComponentAddress(deployments:any, libOrCotractName: string) {
  let componentAddress: any = '0x';

  const component = await deployments.get(libOrCotractName);
  if (component && isAddress(component.address)) {
    componentAddress = component.address;
  }

  // let ans = await waitForInput(`${libOrCotractName} default address is ${componentAddress}, need replace? (y/n):`);
  // if (ans === 'y') {
  //     componentAddress = await waitForInput(`Enter new ${libOrCotractName} address:`);
  // }

  assert(isAddress(componentAddress), `${libOrCotractName} address is invalid!`);
  return componentAddress;
}