const base = 'http://livebox.pro';
const mac = '00:1A:79:BE:B2:2A';

const cookie = `mac=${mac}; stb_lang=en; timezone=UTC`;

const tokenUrl = `${base}/portal.php?type=stb&action=handshake&JsHttpRequest=1-xml`;
const headers = {
  'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
  'Cookie': cookie
};

fetch(tokenUrl, { headers })
  .then(response => response.json())
  .then(data => {
    const token = data.js.token;

    const playlistUrl = `${base}/portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
    const playlistHeaders = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
      'Cookie': cookie,
      'Authorization': `Bearer ${token}`
    };

    fetch(playlistUrl, { headers: playlistHeaders })
      .then(response => response.json())
      .then(data => {
        const channels = data.js.data;

        const m3uPlaylist = channels.map(channel => {
          const name = channel.name || 'Unknown';
          const logo = channel.logo || '';
          const cmd = channel.cmds?.[0]?.url || '';
          return `#EXTINF:-1 tvg-id="${channel.id || ''}" tvg-name="${name.replace(/,/g, '')}" tvg-logo="${logo}",${name}\n${cmd}\n`;
        }).join('\n');

        console.log(`#EXTM3U\n${m3uPlaylist}`);
      });
  });
