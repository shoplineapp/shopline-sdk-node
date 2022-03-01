const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
const fileExists = util.promisify(fs.exists)


class FileSystemTokenStore {
  constructor({
    path = './.tokens'
  } = {}) {
    if (!fs.existsSync(path)){
      fs.mkdirSync(path);
    }
  }

  async fetch(clientId, merchantId, staffId) {
    const fileName = `./.tokens/${clientId}-${merchantId}-${staffId}.json`;
    const exists = await fileExists(fileName)
    if (!exists) {
      return undefined;
    }
    const data = await readFile(fileName, { flag: 'r' });
    return JSON.parse(data.toString())
  }

  async save(clientId, merchantId, staffId, tokenData) {
    const fileName = `./.tokens/${clientId}-${merchantId}-${staffId}.json`;
    await writeFile(fileName, JSON.stringify(tokenData), { flag: 'w' })
    return true;
  }
}

module.exports = FileSystemTokenStore;
