const Connection = require('../config/Database');
const fs = require('fs').promises;
const path = require('path');

function cleanupExpiredGuestsDownloads(wss) {
  setInterval(async () => {
    try {
      const now = new Date();

      const [expiredGuests] = await Connection.query(
        'SELECT id FROM guest WHERE expired_at IS NOT NULL AND expired_at <= ?',
        [now]
      );
      if (expiredGuests.length > 0) {
        const ids = expiredGuests.map(g => g.id);
        await Connection.query('DELETE FROM guest WHERE id IN (?)', [ids]);
      }

      const [rows] = await Connection.query(
        'SELECT * FROM downloads_guest WHERE expired_at IS NOT NULL AND expired_at <= ?',
        [now]
      );

      if (rows.length === 0) return;

      const ips = new Set();

      for (const row of rows) {
        const filePath = path.join(__dirname, '../public', row.filepath);

        try {
          await fs.unlink(filePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.error(`Error ${filePath}:`, err);
          } else {
            console.warn(`File ${filePath}`);
          }
        }

        await Connection.query('DELETE FROM downloads_guest WHERE id = ?', [row.id]);
        ips.add(row.ip);
      }

      for (const ip of ips) {
        const [downloadsRows] = await Connection.query(
          'SELECT * FROM downloads_guest WHERE ip = ? ORDER BY created_at DESC',
          [ip]
        );

        const downloads = downloadsRows.map(d => ({ ...d, filepath: d.filepath }));

        if (wss && wss.clientsSet) {
          const payload = JSON.stringify({ type: 'downloads', data: downloads, ip });
          wss.clientsSet.forEach(client => {
            if (client.readyState === 1) client.send(payload);
          });
        }
      }

    } catch (err) {
      console.error('Error:', err);
    }
  }, 10000);
}

module.exports = cleanupExpiredGuestsDownloads;
