class MemorySessionStore {
  constructor() {
    this.store = {}
  }

  async fetch(sessionId) {
    return this.store[sessionId] || {};
  }

  async save(sessionId, data) {
    this.store[sessionId] = data;
    return true;
  }
}

module.exports = MemorySessionStore;
