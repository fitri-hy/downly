const path = require('path');
const fs = require('fs');
const Connection = require('../../config/Database');

module.exports = (YtdlService) => ({
  index: async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
      const userId = req.session.user.id;

      const [downloadsRows] = await Connection.query(
        `SELECT * FROM downloads 
         WHERE user_id = ? AND url LIKE '%youtube%' 
         ORDER BY created_at DESC`,
        [userId]
      );

      const downloads = downloadsRows.map(d => ({
        ...d,
        filepath: d.filepath.replace(/.*public/, '')
      }));

      const [subsRows] = await Connection.query(
        `SELECT s.quote AS remaining_quote, 
                p.quote AS total_package_quote, 
                p.name AS package_name,
                p.duration,
				s.expired_at,
                s.package_id
         FROM subscribe s
         JOIN packages p ON s.package_id = p.id
         WHERE s.user_id = ? AND (s.expired_at IS NULL OR s.expired_at > NOW())`,
        [userId]
      );

      const subscriptions = subsRows.map(s => ({
        ...s,
        isUnlimited: s.total_package_quote === -1 && s.duration === -1
      }));

      const totalQuote = subscriptions.reduce((sum, s) => {
        if (s.isUnlimited) return sum;
        return sum + s.remaining_quote;
      }, 0);

      const hasUnlimited = subscriptions.some(s => s.isUnlimited);
	  
	  const [packagesRows] = await Connection.query(
		`SELECT * 
		FROM packages
		WHERE NOT (name = 'ADMIN' AND price = -1.00)
		AND price > 0
		ORDER BY price ASC`
      );
	  
      res.render('dashboard/youtube', {
        user: req.session.user,
        downloads,
        totalQuote,
        subscriptions,
		packages: packagesRows,
        hasUnlimited
      });

    } catch (err) {
      console.error(err);
      res.render('dashboard/youtube', {
        user: req.session.user,
        downloads: [],
        totalQuote: 0,
        subscriptions: [],
		packages: [],
        hasUnlimited: false,
        error: 'Failed to get data.'
      });
    }
  },

  download: async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { url, type } = req.body;
    const userId = req.session.user.id;

    try {
      const [subs] = await Connection.query(
        `SELECT s.*, p.quote AS total_package_quote, p.duration, p.file_expired
		FROM subscribe s
		JOIN packages p ON s.package_id = p.id
		WHERE s.user_id = ? AND (s.expired_at IS NULL OR s.expired_at > NOW())
		ORDER BY expired_at DESC LIMIT 1`,
        [userId]
      );

	  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

	  if (!youtubeRegex.test(url)) {
		req.flash('error', 'The URL entered is not a YouTube link');
		return res.redirect('/dashboard/youtube');
	  }

      if (!subs.length) {
        req.flash('error', 'You do not have an active subscription plan');
        return res.redirect('/dashboard/youtube');
      }

      const subscription = subs[0];
      const isUnlimited = (
		  subscription.quote === -1 || subscription.quote === null
		  || subscription.expired_at === null
	  );

      if (!isUnlimited && subscription.quote <= 0) {
		req.flash('error', 'Your download quota has been used up');
		return res.redirect('/dashboard/youtube');
	  }

      if (type === 'video') {
        await YtdlService.downloadVideo(url, userId, subscription.file_expired);
      } else if (type === 'audio') {
        await YtdlService.downloadAudio(url, userId, subscription.file_expired);
      } else {
		req.flash('error', 'Invalid download type');
		return res.redirect('/dashboard/youtube');
      }

      if (!isUnlimited) {
        await Connection.query(
          `UPDATE subscribe SET quote = quote - 1 WHERE id = ?`,
          [subscription.id]
        );
      }

      req.flash('success', 'Download successful');
      res.redirect('/dashboard/youtube');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Download failed');
      res.redirect('/dashboard/youtube');
    }
  },
  
  deleteDownload: async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const downloadId = req.params.id;
    const userId = req.session.user.id;

    try {
      const [rows] = await Connection.query(
        'SELECT * FROM downloads WHERE id = ? AND user_id = ?',
        [downloadId, userId]
      );

      if (!rows.length) {
        req.flash('error', 'Download history not found');
        return res.redirect('/dashboard/youtube');
      }

      const filePath = path.join(__dirname, '../../public', rows[0].filepath);

      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') console.error(err);
      }

      await Connection.query('DELETE FROM downloads WHERE id = ?', [downloadId]);

      req.flash('success', 'Download history deleted successfully');
	  res.redirect('/dashboard/youtube');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Failed to delete');
	  res.redirect('/dashboard/youtube');
    }
  }

});