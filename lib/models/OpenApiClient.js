const axios = require('axios');

class OpenApiClient {
  constructor({ baseURL, accessToken }) {
    this.client = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    this.config = {
      baseURL,
      accessToken,
    };
  }

  async getMerchant(merchantId) {
    const result = await this.client.request({
      method: 'GET',
      url: `/my/merchant/${merchantId}`,
    });

    return result.data;
  }

  async getStaff(staffId) {
    const result = await this.client.request({
      method: 'GET',
      url: `/merchants/${staffId}`,
    });

    return result.data;
  }

  async getStaffPermission(staffId) {
    const result = this.client.request({
      method: 'GET',
      url: `/staff/${staffId}/permissions`,
    });

    return result.data;
  }
}

module.exports = OpenApiClient;
