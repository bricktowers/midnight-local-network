// Copyright 2025 Brick Towers

import * as rx from 'rxjs';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import type { Logger } from 'pino';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { UtxoWithMeta as UtxoWithMetaDust } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import type { UnshieldedWalletState } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import {
    createLogger,
    deriveReceiverFromMnemonic,
    fundFromGenesis,
    initGenesisSender,
    TRANSFER_AMOUNT,
} from './fund-lib';

interface Stoppable {
    stop(): Promise<void>;
}

function getMnemonicFromArgs(): string {
    const [, , arg] = process.argv;

    const printUsage = () => {
        console.error(`
Usage:
  yarn fund-and-register-dust "<mnemonic words>"

Accepted inputs:
  • BIP-39 mnemonic (space-separated words)

Example:
  yarn fund-and-register-dust "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
`);
    };

    if (!arg) {
        console.error('No mnemonic provided.');
        printUsage();
        process.exit(2);
    }

    return arg;
}

async function registerDustGeneration(
    logger: Logger,
    walletFacade: WalletFacade,
    unshieldedState: UnshieldedWalletState,
    dustReceiverAddress: string,
    unshieldedPublicKey: ledger.SignatureVerifyingKey,
    signWithUnshielded: (payload: Uint8Array) => ledger.Signature,
): Promise<string | undefined> {
    const ttlIn10min = new Date(Date.now() + 10 * 60 * 1000);
    await walletFacade.dust.waitForSyncedState();

    const utxos: UtxoWithMetaDust[] = unshieldedState.availableCoins
        .filter((coin) => !coin.meta.registeredForDustGeneration)
        .map((utxo) => ({ ...utxo.utxo, ctime: new Date(utxo.meta.ctime) }));

    if (utxos.length === 0) {
        logger.info('No unregistered UTXOs found for dust generation.');
        return undefined;
    }

    logger.info({ utxoCount: utxos.length }, 'Generating dust...');

    const registerForDustTransaction = await walletFacade.dust.createDustGenerationTransaction(
        new Date(),
        ttlIn10min,
        utxos,
        unshieldedPublicKey,
        dustReceiverAddress,
    );

    const intent = registerForDustTransaction.intents?.get(1);
    if (!intent) {
        throw new Error('Dust generation intent not found on transaction');
    }

    const signature = signWithUnshielded(intent.signatureData(1));
    const recipe = await walletFacade.dust.addDustGenerationSignature(registerForDustTransaction, signature);
    const transaction = await walletFacade.finalizeTransaction(recipe);
    const txId = await walletFacade.submitTransaction(transaction);

    const dustBalance = await rx.firstValueFrom(
        walletFacade.state().pipe(
            rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
            rx.map((s) => s.dust.walletBalance(new Date())),
        ),
    );

    logger.info({ txId }, 'Dust generation transaction submitted');
    logger.info({ dustBalance }, 'Receiver dust balance after generation');

    return txId;
}

async function main(): Promise<void> {
    const logger = createLogger();
    const mnemonic = getMnemonicFromArgs();
    const stoppable: Stoppable[] = [];

    try {
        const receiver = await deriveReceiverFromMnemonic(mnemonic);
        stoppable.push(receiver.walletBundle.wallet);

        logger.info(
            { shieldedAddress: receiver.shieldedAddress, unshieldedAddress: receiver.unshieldedAddress },
            'Derived receiver addresses from mnemonic',
        );

        const sender = await initGenesisSender();
        stoppable.push(sender.wallet);
        logger.info('Wallet setup complete');

        const outputs = [
            {
                type: 'unshielded' as const,
                outputs: [
                    {
                        amount: TRANSFER_AMOUNT,
                        receiverAddress: receiver.unshieldedAddress,
                        type: ledger.unshieldedToken().raw,
                    },
                ],
            },
        ];

        logger.info('Funding transaction recipe created');
        const txHash = await fundFromGenesis(sender, outputs);
        logger.info({ txHash }, 'Funding transaction submitted');

        const receiverState = await rx.firstValueFrom(
            receiver.walletBundle.wallet.state().pipe(
                rx.filter((s) => s.unshielded.availableCoins.length > 0),
            ),
        );

        logger.info(
            { availableUnshieldedUtxos: receiverState.unshielded.availableCoins.length },
            'Receiver unshielded UTXOs detected',
        );

        await registerDustGeneration(
            logger,
            receiver.walletBundle.wallet,
            receiverState.unshielded,
            receiverState.dust.dustAddress,
            receiver.walletBundle.unshieldedKeystore.getPublicKey(),
            (payload) => receiver.walletBundle.unshieldedKeystore.signData(payload),
        );
    } catch (err) {
        if (err instanceof Error && err.message === 'Invalid mnemonic provided.') {
            console.error('Invalid mnemonic provided.');
            console.error('Run with: yarn fund-and-register-dust "<mnemonic words>"');
            process.exitCode = 2;
        } else {
            logger.error({ err }, 'Error while funding and registering dust');
            process.exitCode = 1;
        }
    } finally {
        for (const wallet of stoppable) {
            await wallet.stop();
        }
    }
}

main().catch((err) => {
    console.error('Unhandled error in main:', err);
    process.exit(1);
});
