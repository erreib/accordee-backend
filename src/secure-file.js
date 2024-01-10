const crypto = require('crypto');
const fs = require('fs').promises;
const algorithm = 'aes-256-gcm';

const SECRET_SALT = process.env.SECRET_SALT || "Secret Salt You Should Update"
const SECRET_PASSPHRASE = process.env.SECRET_PASSPHRASE || "Secret Key You Should Update"

const secretKey = crypto.scryptSync(SECRET_PASSPHRASE, SECRET_SALT, 32); // salt can be random, but in this case we are just using a string

async function encryptFile(inputPath, key=secretKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const input = await fs.readFile(inputPath, 'utf8');

  const encrypted = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const result = {
    iv: iv.toString('hex'),
    auth_tag: authTag.toString('hex'),
    data: encrypted.toString('base64'),
  };

  await fs.writeFile(`${inputPath}.secure`, JSON.stringify(result));

  console.log(`Encrypted file written to ${inputPath}.secure!`);
}

async function decryptToString(inputPath, key=secretKey) {
  console.log(`Decrypting ${inputPath}...`);
  const encryptedData = JSON.parse(await fs.readFile(inputPath, 'utf8'));

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(encryptedData.iv, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(encryptedData.auth_tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// await encryptFile('test.txt', 'test.encrypted');
// decryptFile('test.encrypted', 'test.decrypted', 'iv.txt');


module.exports = {
  encryptFile,
  decryptToString
}
