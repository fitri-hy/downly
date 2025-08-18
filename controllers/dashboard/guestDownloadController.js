const Connection = require('../../config/Database');

module.exports = (YtdlGuestService) => ({
  download: async (req, res) => {
    const { url, type } = req.body;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const now = new Date();

    try {
      const platforms = [
        { name: 'YouTube', regex: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/ },
        { name: 'Facebook', regex: /^(https?:\/\/)?(www\.)?facebook\.com/ },
        { name: 'Dailymotion', regex: /^(https?:\/\/)?(www\.)?dailymotion\.com\/.+$/ },
        { name: 'Instagram', regex: /^(https?:\/\/)?(www\.)?instagram\.com\/.+$/ },
        { name: 'SoundCloud', regex: /^(https?:\/\/)?(www\.)?soundcloud\.com\/.+$/ },
        { name: 'TikTok', regex: /^(https?:\/\/)?(www\.)?tiktok\.com\/.+$/ },
        { name: 'Twitter/X', regex: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+$/ },
        { name: 'Vimeo', regex: /^(https?:\/\/)?(www\.)?vimeo\.com\/.+$/ },
        { name: 'VK', regex: /^(https?:\/\/)?(www\.)?vk\.com\/.+$/ }
      ];

      const platform = platforms.find(p => p.regex.test(url));
      if (!platform) {
        req.flash('error', 'Platform or URL not supported');
        return res.redirect('/');
      }

      const [guestRows] = await Connection.query('SELECT * FROM guest WHERE ip = ? LIMIT 1', [ip]);
      let guest;

      if (!guestRows.length) {
        const expiredAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const result = await Connection.query(
          'INSERT INTO guest (ip, quote, user_agent, created_at, expired_at) VALUES (?, ?, ?, ?, ?)',
          [ip, 3, userAgent, now, expiredAt]
        );
        const [newGuestRow] = await Connection.query('SELECT * FROM guest WHERE id = ?', [result[0].insertId]);
        guest = newGuestRow[0];
      } else {
        guest = guestRows[0];
        if (guest.expired_at && new Date(guest.expired_at) < now) {
          const newExpired = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          await Connection.query(
            'UPDATE guest SET quote = 3, expired_at = ?, user_agent = ? WHERE id = ?',
            [newExpired, userAgent, guest.id]
          );
          guest.quote = 3;
          guest.expired_at = newExpired;
          guest.user_agent = userAgent;
        }
      }

      if (guest.quote <= 0) {
        req.flash('error', 'Daily quota is used up, subscribe now.');
        return res.redirect('/');
      }

      if (!['video', 'audio'].includes(type)) {
        req.flash('error', 'Invalid type');
        return res.redirect('/');
      }

      let filePath;
      if (type === 'video') filePath = await YtdlGuestService.downloadVideo(url, ip, 1);
      else filePath = await YtdlGuestService.downloadAudio(url, ip, 1);

      await Connection.query('UPDATE guest SET quote = quote - 1 WHERE id = ?', [guest.id]);
      req.flash('success', `Download successful. Remaining quota ${guest.quote - 1}`);
      res.redirect('/');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Download failed');
      res.redirect('/');
    }
  },
});
