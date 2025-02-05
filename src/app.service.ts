import { Injectable } from '@nestjs/common';
import { Alchemy, AssetTransfersCategory, AssetTransfersWithMetadataResult, Network } from 'alchemy-sdk';
import { ethers } from 'ethers';

@Injectable()
export class AppService {
  private readonly ALCHEMY_APIKEY = process.env.ALCHEMY_API_KEY;
  private readonly BAYC_CONTRACT_ADDRESS = process.env.BAYC_CONTRACT_ADDRESS;

  isExact: boolean = false;

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
    console.log('please wait');
    await this.getETHBalancesByEpochTime(epochTimes);
  }

  async getEpochTimeInput(): Promise<number[]> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

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

  async getBlockByTimestamp(timestamps: number[]): Promise<{ startBlockNumber: number | null, endBlockNumber: number | null }> {
    const latestBlock = await this.alchemy.core.getBlock("latest");
    
    const isUseClosest = timestamps.length > 1 && timestamps[0] !== timestamps[1];
  
    const binarySearchBlock = async (timestamp: number): Promise<number | null> => {
      let low = 0;
      let high = latestBlock.number;
      let closestBlockNumber: number | null = null;
  
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const block = await this.alchemy.core.getBlock(mid);
  
        if (block.timestamp === timestamp) {
          return block.number;
        }
  
        if (block.timestamp < timestamp) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
  
        if (isUseClosest) {
          if (closestBlockNumber === null || 
              (timestamp > timestamps[0] && timestamp < timestamps[1] && 
              Math.abs(block.timestamp - timestamp) < Math.abs((await this.alchemy.core.getBlock(closestBlockNumber)).timestamp - timestamp))) {
            closestBlockNumber = mid;
          }
        }
      }
  
      return closestBlockNumber;
    };
  
    const [startBlockNumber, endBlockNumber] = await Promise.all([
      binarySearchBlock(timestamps[0]),
      timestamps.length > 1 ? binarySearchBlock(timestamps[1]) : null,
    ]);
  
    return { startBlockNumber, endBlockNumber };
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
    const { startEpochTime, endEpochTime } = this.getRangeDateTime(epochTimes);

    const { startBlockNumber, endBlockNumber } = await this.getBlockByTimestamp([startEpochTime, endEpochTime]);
    
    return {
      startBlockNumber: startBlockNumber ? `0x${startBlockNumber.toString(16)}` : null,
      endBlockNumber: endBlockNumber ? `0x${endBlockNumber.toString(16)}` : null
    }
  }

  getRangeDateTime(epochTimes: number[]): {startEpochTime: number, endEpochTime: number} {
    if (epochTimes.length > 1) {
      if (epochTimes[0] > epochTimes[1]) {
        throw new Error('first value should be less than second value');
      }

      return {
        startEpochTime: epochTimes[0],
        endEpochTime: epochTimes[1]
      }
    } else {
      return {
        startEpochTime: epochTimes[0],
        endEpochTime: epochTimes[0]
      }
    }
  }
}

enum ClosestDirection {
  UP = 'UP',
  DOWN = 'DOWN',
}
