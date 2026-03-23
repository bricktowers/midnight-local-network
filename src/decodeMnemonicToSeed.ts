import * as bip39 from 'bip39';
import { fileURLToPath } from 'url';
import { basename } from 'path';

export async function decodeMnemonic(
  mnemonic: string,
  passphrase: string = ''
): Promise<Buffer> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  return await bip39.mnemonicToSeed(mnemonic, passphrase);
}

// ✅ ESM-compatible "main" check
const isMain = basename(fileURLToPath(import.meta.url)) === basename(process.argv[1]);

if (isMain) {
  const mnemonic = process.argv[2];

  if (!mnemonic) {
    console.error('Provide mnemonic');
    process.exit(1);
  }

  decodeMnemonic(mnemonic)
    .then((seed) => {
      console.log(seed.toString('hex'));
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
