const Connection = require('../config/Database');
const fs = require('fs').promises;
const path = require('path');

function cleanupExpiredDownloads(wss) {
  setInterval(async () => {
    try {
      const now = new Date();

      const [rows] = await Connection.query(
        'SELECT * FROM downloads WHERE expired_at IS NOT NULL AND expired_at <= ?',
        [now]
      );

      if (rows.length === 0) return;

      const userIds = new Set();

      for (const row of rows) {
        const filePath = path.join(__dirname, '../public', row.filepath);

        try {
          await fs.unlink(filePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.error(`Error ${filePath}:`, err);
          } else {
            console.warn(`Error: ${filePath}`);
          }
        }

        await Connection.query('DELETE FROM downloads WHERE id = ?', [row.id]);
        userIds.add(row.user_id);
      }

      for (const userId of userIds) {
        const [downloadsRows] = await Connection.query(
          'SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC',
          [userId]
        );

        const downloads = downloadsRows.map(d => ({
          ...d,
          filepath: d.filepath
        }));

        if (wss && wss.clientsSet) {
          const payload = JSON.stringify({ type: 'downloads', data: downloads, userId });
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

module.exports = cleanupExpiredDownloads;
