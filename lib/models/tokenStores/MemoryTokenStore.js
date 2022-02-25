class MemoryTokenStore {
  constructor() {
    this.store = {}
  }

  async fetch(staffId) {
    return this.store[staffId];
  }

  async save(staffId, tokenInfo) {
    this.store[staffId] = tokenInfo;
    return true;
  }
}

module.exports = MemoryTokenStore;
