import { Injectable } from '@nestjs/common';
import { Alchemy, AssetTransfersCategory, AssetTransfersWithMetadataResult, Network } from 'alchemy-sdk';
import { ethers } from 'ethers';

@Injectable()
export class AppService {
  private readonly ALCHEMY_APIKEY = process.env.ALCHEMY_API_KEY;
  private readonly BAYC_CONTRACT_ADDRESS = process.env.BAYC_CONTRACT_ADDRESS;

  private readonly alchemy: Alchemy;

  constructor() {
    this.alchemy = new Alchemy({
      apiKey: this.ALCHEMY_APIKEY,
      network: Network.ETH_MAINNET
    });
  }

  async run() {
    const epochTimes = await this.getEpochTimeInput();
    console.log(`get ETH value for epoch time: ${epochTimes}`);
    await this.getETHBalancesByEpochTime(epochTimes);
  }

  async getEpochTimeInput(): Promise<number[]> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 1738627200
    const query: string = 'Enter epoch times with a range (separated by spaces) or a single value (will get data on that date): ';
    return new Promise((resolve) => {
      rl.question(query, (answer: string) => {
        if (answer.includes(' ')) {
          const epochTimes = answer.split(' ').map((value: string) => parseInt(value, 10));
          resolve(epochTimes);
        } else {
          const epochTime = parseInt(answer, 10);
          resolve([epochTime]);
          }
      });
    });
  }

  async getHoldersByBlockRange(startBlockNumber: string, endBlockNumber: string): Promise<AssetTransfersWithMetadataResult[]> {
    try {
      const assetTransfers = await this.alchemy.core.getAssetTransfers({
        fromBlock: startBlockNumber,
        toBlock: endBlockNumber,
        category: [AssetTransfersCategory.ERC721, AssetTransfersCategory.EXTERNAL],
        contractAddresses: [this.BAYC_CONTRACT_ADDRESS],
        withMetadata: true,
      });
  
      return assetTransfers.transfers; 
    } catch (error) {
      console.error(`Failed to get holders`, error);
      throw error;
    }
  }

  async getBlockByTimestamp(timestamp: number): Promise<number> {
    const latestBlock = await this.alchemy.core.getBlock("latest");
    let low = 0;
    let high = latestBlock.number;
    console.log(`latest block : ${high}`);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = await this.alchemy.core.getBlock(mid);

      console.log(`retrieved block: ${block.timestamp}`);

      if (block.timestamp === timestamp) {
          return block.number;
      }

      if (block.timestamp < timestamp) {
          low = mid + 1;
      } else {
          high = mid - 1;
      }
    }

    return null;
  }

  async getETHBalancesByEpochTime(epochTimes: number[]) {
    try {
      let totalBalance = 0;
      
      const { startBlockNumber, endBlockNumber } = await this.getBlockRange(epochTimes);
      if (startBlockNumber && endBlockNumber) {
        const holders = await this.getHoldersByBlockRange(startBlockNumber, endBlockNumber);
        
        totalBalance = holders.reduce((sum, holder) => sum + (holder.value || 0), 0);
      }

      console.log(`ETH value: ${totalBalance}`);
    } catch (error) {
      console.error('Failed to get ETH wallet values')
      throw error;
    }
  }

  async getBlockRange(epochTimes: number[]): Promise<{startBlockNumber: string, endBlockNumber: string}> {
    const { startEpochTime, endEpochTime } = await this.getRangeDateTime(epochTimes);

    return {
      startBlockNumber: `0x${startEpochTime.toString(16)}`,
      endBlockNumber: `0x${endEpochTime.toString(16)}`
    }
  }

  async getRangeDateTime(epochTimes: number[]): Promise<{startEpochTime: number, endEpochTime: number}> {
    if (epochTimes.length > 1) {
      return {
        startEpochTime: epochTimes[0],
        endEpochTime: epochTimes[1]
      }
    } else {
      const date = new Date(epochTimes[0] * 1000);
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      return {
        startEpochTime: Math.floor(startDate.getTime() / 1000),
        endEpochTime: Math.floor(endDate.getTime() / 1000)
      }
    }
  }
}
