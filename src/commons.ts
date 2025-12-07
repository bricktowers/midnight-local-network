// Copyright 2025 Brick Towers

import {type Config, StandaloneConfig} from './config';
import * as Rx from 'rxjs';
import {nativeToken} from '@midnight-ntwrk/ledger';
import type {Logger} from 'pino';
import type {Wallet} from '@midnight-ntwrk/wallet-api';
import {type Resource, WalletBuilder} from '@midnight-ntwrk/wallet';
import {getZswapNetworkId} from '@midnight-ntwrk/midnight-js-network-id';

export const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

export interface TestConfiguration {
  seed: string;
  entrypoint: string;
  dappConfig: Config;
  psMode: string;
}

export class LocalTestConfig implements TestConfiguration {
  seed = GENESIS_MINT_WALLET_SEED;
  entrypoint = 'dist/standalone.js';
  dappConfig = new StandaloneConfig();
  psMode = 'undeployed';
}

export class TestWallet {
  private wallet: (Wallet & Resource) | undefined;
  logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  setup = async (testConfiguration: TestConfiguration) => {
    this.logger.info('Setting up wallet');
    this.wallet = await this.buildWalletAndWaitForFunds(testConfiguration.dappConfig, testConfiguration.seed);
    return this.wallet;
  };

  waitForFunds = (wallet: Wallet) =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(10_000),
        Rx.tap((state) => {
          const applyGap = state.syncProgress?.lag.applyGap ?? 0n;
          const sourceGap = state.syncProgress?.lag.sourceGap ?? 0n;
          this.logger.info(
            `Waiting for funds. Backend lag: ${sourceGap}, wallet lag: ${applyGap}, transactions=${state.transactionHistory.length}`,
          );
        }),
        Rx.filter((state) => {
          // Let's allow progress only if wallet is synced
          return state.syncProgress?.synced === true;
        }),
        Rx.map((s) => s.balances[nativeToken()] ?? 0n),
        Rx.filter((balance) => balance > 0n),
      ),
    );

  buildWalletAndWaitForFunds = async (
    { indexer, indexerWS, node, proofServer }: Config,
    seed: string,
  ): Promise<Wallet & Resource> => {
    const wallet = await WalletBuilder.buildFromSeed(
      indexer,
      indexerWS,
      proofServer,
      node,
      seed,
      getZswapNetworkId(),
      'warn',
    );
    wallet.start();
    const state = await Rx.firstValueFrom(wallet.state());
    this.logger.info(`Wallet seed is: ${seed}`);
    this.logger.info(`Wallet address is: ${state.address}`);
    let balance = state.balances[nativeToken()];
    if (balance === undefined || balance === 0n) {
      this.logger.info(`Wallet balance is: 0`);
      this.logger.info(`Waiting to receive tokens...`);
      balance = await this.waitForFunds(wallet);
    }
    this.logger.info(`Wallet balance is: ${balance}`);
    return wallet;
  };
}


