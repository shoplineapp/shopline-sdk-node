const axios = require('axios');

class OpenApiClient {
  constructor(baseURL, accessToken) {
    this.client = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async getCurrentMerchant() {
    const result = await this.client.request({
      method: 'GET',
      url: '/my/merchant',
    });

    return result.data;
  }

  async getCurrentStaff() {
    const result = await this.client.request({
      method: 'GET',
      url: '/my/staff',
    });

    return result.data;
  }

  async getStaffPermission() {
    const result = this.client.request({
      method: 'GET',
      url: '/my/staff/permissions',
    });

    return result.data;
  }
}

module.exports = OpenApiClient;
