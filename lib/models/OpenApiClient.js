const axios = require('axios');
const DEFAULT_STAFF_FIELDS = [
  'id',
  'merchant_ids',
  'organization_ids',
  'email',
  'name',
  'locale_code',
  'channel_ids',
];

const DEFAULT_MERCHANT_FIELDS = [
  'id',
  'base_country_code',
  'base_currency_code',
  'name',
  'email',
  'handle',
  'custom_domain',
  'rollout_keys',
  'default_language_code',
  'supported_languages',
  'staff_id',
];

class OpenApiClient {
  constructor({ baseURL, accessToken }) {
    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.config = {
      baseURL,
      accessToken,
    };
  }

  async getMerchant(merchantId, fields = DEFAULT_MERCHANT_FIELDS) {
    const result = await this.client.request({
      method: 'GET',
      url: `merchant/${merchantId}`,
      params: {
        strategy: 'app_token',
        fields,
      },
    });

    return result.data;
  }

  async getStaff(staffId, fields = DEFAULT_STAFF_FIELDS) {
    const result = await this.client.request({
      method: 'GET',
      url: `staffs/${staffId}`,
      params: {
        strategy: 'app_token',
        fields,
      },
    });

    return result.data;
  }

  async getStaffPermission(staffId) {
    const result = this.client.request({
      method: 'GET',
      url: `staffs/${staffId}/permissions`,
      params: { scope: 'sc', strategy: 'app_token' },
    });

    return result.data;
  }
}

module.exports = OpenApiClient;
