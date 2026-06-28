const express = require('express');
const app = express();
const fetch = require('node-fetch');

const macAddress = process.env.MAC_ADDRESS;
const baseUrl = 'http://livebox.pro';

app.get('/api/mac/playlist.m3u', async (req, res) => {
  try {
    const token = await getToken();
    const genres = await getGenres(token);
    const channels = await getChannels(token);
    const m3uPlaylist = generateM3UPlaylist(channels, genres);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.send(m3uPlaylist);
  } catch (error) {
    console.error(error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

async function getToken() {
  const response = await fetch(`${baseUrl}/portal.php?type=stb&action=handshake&JsHttpRequest=1-xml`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
      'Cookie': `mac=${macAddress}; stb_lang=en; timezone=UTC`
    }
  });
  const data = await response.json();
  return data.js.token;
}

async function getGenres(token) {
  const response = await fetch(`${baseUrl}/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
      'Cookie': `mac=${macAddress}; stb_lang=en; timezone=UTC`,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.js;
}

async function getChannels(token) {
  const response = await fetch(`${baseUrl}/portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
      'Cookie': `mac=${macAddress}; stb_lang=en; timezone=UTC`,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.js.data;
}

function generateM3UPlaylist(channels, genres) {
  let m3uPlaylist = '#EXTM3U\n';
  channels.forEach((channel) => {
    const name = channel.name || 'Unknown';
    const logo = channel.logo || '';
    const genreId = channel.tv_genre_id || '0';
    const group = genres.find((genre) => genre.id === genreId)?.title || 'General';
    const cmd = channel.cmds?.[0]?.url || '';
    if (cmd) {
      m3uPlaylist += `#EXTINF:-1 tvg-id="${channel.id || ''}" tvg-name="${name.replace(/,/g, '')}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
      m3uPlaylist += `${cmd}\n`;
    }
  });
  return m3uPlaylist;
}

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
