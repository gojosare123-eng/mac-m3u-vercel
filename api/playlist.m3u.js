const { StalkerClient } = require('./utils/stalker');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const {
    mac,
    base,
    serial,
    dev_id1,
    dev_id2,
    format = 'm3u'
  } = req.query;

  // Resolve config: query param > env var > hardcoded default
  const baseUrl    = base     || process.env.STALKER_BASE     || 'http://livebox.pro:80/c';
  const macAddr    = mac      || process.env.STALKER_MAC      || '00:1A:79:CE:5E:01';
  const serialNum  = serial   || process.env.STALKER_SERIAL   || '6BD46F6477D17';
  const d1         = dev_id1  || process.env.STALKER_DEV_ID1  || 'BAFFF2D04EA1A75B3F68C1A2AD96557C79C4024A1186605F617F34DD476CA73D';
  const d2         = dev_id2  || process.env.STALKER_DEV_ID2  || '59FC31A3CE15795E86B2A340310541733C0948A9528A10AC047927E5222D414F';

  if (!baseUrl) {
    return res.status(400).json({
      error: 'Missing base URL',
      message: 'Provide ?base=http://portal.example.com'
    });
  }

  try {
    console.log(`[Request] base=${baseUrl} mac=${macAddr} serial=${serialNum}`);

    const client = new StalkerClient({
      baseUrl,
      mac: macAddr,
      serial: serialNum,
      devId1: d1,
      devId2: d2
    });

    const { m3u, count } = await client.getPlaylist();

    if (format === 'json') {
      return res.json({
        success: true,
        count,
        config: {
          mac: macAddr,
          serial: serialNum,
          base: baseUrl
        },
        note: 'Use format=m3u to download playlist'
      });
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="playlist-${macAddr.replace(/:/g, '')}.m3u"`);
    return res.send(m3u);

  } catch (error) {
    console.error('[Error]', error);
    return res.status(500).json({
      error: 'Failed to fetch playlist',
      message: error.message
    });
  }
};
