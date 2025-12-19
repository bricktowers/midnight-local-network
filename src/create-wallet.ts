// Copyright 2025 Brick Towers

import { TestWallet } from './commons';
import { type Config, StandaloneConfig, TestnetRemoteConfig } from './config';
import type { Wallet } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';

import pino from 'pino';
import pinoPretty from 'pino-pretty';

const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

type NetworkType = 'standalone' | 'testnet';

function getNetworkFromArgs(): NetworkType {
    const [, , network] = process.argv;

    if (!network) {
        console.log('Usage: yarn create-wallet <network>');
        console.log('  network: standalone | testnet');
        console.log('');
        console.log('Examples:');
        console.log('  yarn create-wallet standalone  # Create wallet for local development');
        console.log('  yarn create-wallet testnet     # Create wallet for TestNet');
        process.exit(1);
    }

    if (network !== 'standalone' && network !== 'testnet') {
        console.error(`Invalid network: ${network}`);
        console.error('Valid options: standalone, testnet');
        process.exit(1);
    }

    return network;
}

function getConfigForNetwork(network: NetworkType): Config {
    switch (network) {
        case 'standalone':
            return new StandaloneConfig();
        case 'testnet':
            return new TestnetRemoteConfig();
    }
}

function createLogger() {
    const pretty = pinoPretty({
        colorize: true,
        sync: true,
    });

    return pino(
        {
            level: DEFAULT_LOG_LEVEL,
        },
        pretty,
    );
}

async function main(): Promise<void> {
    const logger = createLogger();
    const network = getNetworkFromArgs();
    const config = getConfigForNetwork(network);

    logger.info({ network }, 'Creating new wallet');

    const testWallet = new TestWallet(logger);

    let wallet: (Wallet & Resource) | null = null;

    try {
        const result = await testWallet.buildFreshWallet(config);
        wallet = result.wallet;

        console.log('');
        console.log('='.repeat(60));
        console.log('  NEW WALLET CREATED');
        console.log('='.repeat(60));
        console.log('');
        console.log(`  Network: ${network}`);
        console.log(`  Seed: ${result.seed}`);
        console.log('');
        console.log('  ⚠️  IMPORTANT: Save your seed securely!');
        console.log('  You will need it to restore your wallet.');
        console.log('');
        console.log('='.repeat(60));

    } catch (err) {
        logger.error(
            { err },
            'Error while creating wallet',
        );
        process.exitCode = 1;
    } finally {
        if (wallet) {
            try {
                await wallet.close();
                logger.info('Wallet closed');
            } catch (closeErr) {
                logger.warn({ closeErr }, 'Failed to close wallet cleanly');
            }
        }
    }
}

main().catch((err) => {
    console.error('Unhandled error in main:', err);
    process.exit(1);
});

