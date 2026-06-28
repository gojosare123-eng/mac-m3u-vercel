const fetch = require('node-fetch');

class StalkerClient {
  constructor({
    baseUrl,
    mac,
    serial,
    devId1,
    devId2,
    deviceId
  }) {
    this.baseUrl = baseUrl'http://livebox.pro:80/c');
    this.mac = (mac || '00:1A:79:CE:5E:01').toUpperCase();
    this.serial = serial || '6BD46F6477D17';
    this.devId1 = devId1 || 'BAFFF2D04EA1A75B3F68C1A2AD96557C79C4024A1186605F617F34DD476CA73D';
    this.devId2 = devId2 || 'BAFFF2D04EA1A75B3F68C1A2AD96557C79C4024A1186605F617F34DD476CA73D';
    this.deviceId = deviceId || 'BAFFF2D04EA1A75B3F68C1A2AD96557C79C4024A1186605F617F34DD476CA73D';
    this.token = null;
    this.cookie = this._buildCookie();
    this.userAgent = 'Mozilla/5.0 (QtEmbedded; U; Linux; C)';
  }

  _buildCookie() {
    const parts = ['stb_lang=en', 'timezone=UTC'];
    if (this.mac) parts.unshift(`mac=${this.mac}`);
    if (this.serial) parts.unshift(`serial_cut=${this.serial}`);
    if (this.devId1) parts.unshift(`dev_id=${this.devId1}`);
    if (this.devId2) parts.unshift(`dev_id2=${this.devId2}`);
    if (this.deviceId) parts.unshift(`device_id=${this.deviceId}`);
    return parts.join('; ');
  }

  getHeaders(extra = {}) {
    return {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
      'Cookie': this.cookie,
      'X-Requested-With': 'XMLHttpRequest',
      ...extra
    };
  }

  async handshake() {
    let url = `${this.baseUrl}/portal.php?type=stb&action=handshake&JsHttpRequest=1-xml`;

    const params = new URLSearchParams();
    if (this.mac) params.set('mac', this.mac);
    if (this.serial) params.set('serial_cut', this.serial);
    if (this.devId1) params.set('dev_id', this.devId1);
    if (this.devId2) params.set('dev_id2', this.devId2);

    const queryString = params.toString();
    if (queryString) url += `&${queryString}`;

    console.log(`[Handshake] ${url.substring(0, 150)}...`);

    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Handshake failed: ${res.status} - ${text.substring(0, 200)}`);
    }

    const data = await res.json();
    console.log(`[Handshake Response]`, JSON.stringify(data).substring(0, 300));

    this.token = data?.js?.token || data?.token;
    return this.token;
  }

  async getChannels() {
    try {
      await this.handshake();
    } catch (e) {
      console.warn(`[WARN] Handshake failed, continuing anyway: ${e.message}`);
    }

    const url = `${this.baseUrl}/portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
    const headers = this.getHeaders();

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Some portals need device params in the channel request too
    const params = new URLSearchParams();
    if (this.mac) params.set('mac', this.mac);
    if (this.serial) params.set('serial_cut', this.serial);
    if (this.devId1) params.set('dev_id', this.devId1);
    if (this.devId2) params.set('dev_id2', this.devId2);

    const channelUrl = params.toString()
      ? `${url}&${params.toString()}`
      : url;

    console.log(`[Channels] Fetching...`);

    const res = await fetch(channelUrl, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Channel fetch failed: ${res.status} - ${text.substring(0, 200)}`);
    }

    const data = await res.json();
    const channels = data?.js?.data || data?.data || [];

    console.log(`[Channels] Got ${channels.length} channels`);
    return channels;
  }

  generateM3U(channels) {
    let m3u = '#EXTM3U\n';
    let count = 0;

    for (const ch of channels) {
      const name = ch.name || 'Unknown';
      const logo = ch.logo || '';
      const url = ch.cmds?.[0]?.url || '';

      if (!url) continue;

      const safeName = name.replace(/,/g, '');
      m3u += `#EXTINF:-1 tvg-id="${ch.id || ''}" tvg-name="${safeName}" tvg-logo="${logo}",${name}\n${url}\n`;
      count++;
    }

    console.log(`[M3U] Generated ${count} channels`);
    return { m3u, count };
  }

  async getPlaylist() {
    const channels = await this.getChannels();
    return this.generateM3U(channels);
  }
}

module.exports = { StalkerClient };
