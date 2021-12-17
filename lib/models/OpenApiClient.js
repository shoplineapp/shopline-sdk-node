const axios = require('axios');

const empty = () => {};

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
  constructor({ baseURL, accessToken, logger }) {
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

    this.log = logger || empty;
  }

  async getMerchant(merchantId, fields = DEFAULT_MERCHANT_FIELDS) {
    const opts = {
      method: 'GET',
      url: `v1/merchants/${merchantId}`,
      params: {
        strategy: 'app_token',
        fields,
      },
    };

    this.log('openApi', 'trace', {
      action: 'getMerchant',
      opts,
    });

    const result = await this.client.request(opts);

    return result.data;
  }

  async getStaff(staffId, fields = DEFAULT_STAFF_FIELDS, include_fields = []) {
    const opts = {
      method: 'GET',
      url: `v1/staffs/${staffId}`,
      params: {
        strategy: 'app_token',
        fields,
        include_fields,
      },
    };

    this.log('openApi', 'trace', {
      action: 'getStaff',
      opts,
    });

    const result = await this.client.request(opts);

    return result.data;
  }

  async getStaffPermission(staffId, scope) {
    const opts = {
      method: 'GET',
      url: `v1/staffs/${staffId}/permissions`,
      params: { scope, strategy: 'app_token' },
    };

    this.log('openApi', 'trace', {
      action: 'getStaffPermission',
      opts,
    });

    const result = await this.client.request(opts);

    return result.data;
  }

  async request(options) {
    const opts = {
      method: 'GET',
      ...options,
      params: { ...options.params, strategy: 'app_token' },
    };

    this.log('openApi', 'trace', {
      action: `${opts.method} ${opts.url}`,
      opts,
    });

    const result = await this.client.request(opts);

    return result.data;
  }
}

module.exports = OpenApiClient;
