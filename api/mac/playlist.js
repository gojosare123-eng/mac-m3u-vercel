cd ~/m3u-proxy

cat > api/mac/playlist.m3u.js << 'ENDSCRIPT'
export default async function handler(req, res) {
  try {
    const base = 'http://livebox.pro';
    const mac = '00:1A:79:BE:B2:2A';
    const macEnc = mac.replace(/:/g, '%3A');

    // Step 1: Handshake to get token
    const hsResp = await fetch(`${base}/portal.php?type=stb&action=handshake&JsHttpRequest=1-xml`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
        'Cookie': `mac=${macEnc}; stb_lang=en; timezone=UTC`
      }
    });
    const hsData = await hsResp.json();
    const token = hsData?.js?.token;
    if (!token) throw new Error('No token');

    // Step 2: Get genres
    const genresResp = await fetch(`${base}/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
        'Cookie': `mac=${macEnc}; stb_lang=en; timezone=UTC`,
        'Authorization': `Bearer ${token}`
      }
    });
    const genresData = await genresResp.json();
    const genreMap = {};
    if (genresData?.js) {
      for (const g of genresData.js) {
        genreMap[g.id] = g.title;
      }
    }

    // Step 3: Get all channels
    const chResp = await fetch(`${base}/portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
        'Cookie': `mac=${macEnc}; stb_lang=en; timezone=UTC`,
        'Authorization': `Bearer ${token}`
      }
    });
    const chData = await chResp.json();
    const channels = chData?.js?.data || [];

    let m3u = '#EXTM3U\n';
    let count = 0;

    for (const ch of channels) {
      const name = ch.name || 'Unknown';
      const logo = ch.logo || '';
      const genreId = ch.tv_genre_id || '0';
      const group = genreMap[genreId] || 'General';
      const cmd = ch.cmds?.[0]?.url || '';

      if (!cmd) continue;

      // Clean the cmd URL
      let streamUrl = cmd.replace(/^ffmpeg\s+/, '').trim();

      if (streamUrl.includes('localhost') || streamUrl.includes('/ch/')) {
        // Use create_link to get real URL
        const linkResp = await fetch(`${base}/portal.php?type=itv&action=create_link&cmd=${encodeURIComponent(cmd)}&series=&forced_storage=undefined&disable_ad=0&download=0&JsHttpRequest=1-xml`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
            'Cookie': `mac=${macEnc}; stb_lang=en; timezone=UTC`,
            'Authorization': `Bearer ${token}`
          }
        });
        const linkData = await linkResp.json();
        const realCmd = linkData?.js?.cmd || '';
        streamUrl = realCmd.replace(/^ffmpeg\s+/, '').trim();
      }

      if (!streamUrl) continue;

      m3u += `#EXTINF:-1 tvg-id="${ch.id || ''}" tvg-name="${name.replace(/,/g, '')}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
      m3u += `${streamUrl}\n`;
      count++;
    }

    console.log(`Total channels: ${count}`);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(m3u);

  } catch (e) {
    console.error('Error:', e);
    res.status(500).send(`#EXTM3U\n#EXTINF:-1,Error: ${e.message}\n`);
  }
}
ENDSCRIPT

rm -f api/stream.js

cat > vercel.json << 'ENDSCRIPT'
{
  "rewrites": [
    { "source": "/api/mac/playlist.m3u", "destination": "/api/mac/playlist" }
  ]
}
ENDSCRIPT

cat > package.json << 'ENDSCRIPT'
{
  "name": "m3u-proxy",
  "type": "module"
}
ENDSCRIPT

npx vercel --prod
