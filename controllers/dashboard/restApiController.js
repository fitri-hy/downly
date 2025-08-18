const Connection = require('../../config/Database');
const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');
const crypto = require('crypto');

module.exports = (YtdlService) => ({

  index: async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
	
	try {
     const mdPath = path.join(__dirname, '..', '..', 'config', 'data', 'Rest_API.md');
      const markdown = await fs.readFile(mdPath, 'utf-8');

      const htmlContent = marked.parse(markdown);

      res.render('dashboard/rest-api', {
        docs: htmlContent,
		user_token: req.session.user.token
      });

    } catch (err) {
      console.error('Failed to load Rest_API.md:', err);
      req.flash('error', 'Failed to load API documentation. Please try again later.');
      return res.redirect('/dashboard');
	}
  },
  
  // Subscribe
  subscribe: async (req, res) => {
    const token = req.headers['token'];
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token is required.',
        hint: 'Include a valid Authorization token in the request headers.'
      });
    }

    try {
      const [users] = await Connection.query(
        'SELECT * FROM users WHERE token = ? LIMIT 1',
       [token]
      );
      if (!users.length) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid authentication token.',
          hint: 'Use a valid token associated with your account.'
        });
      }
      const user = users[0];

      const [subs] = await Connection.query(`
        SELECT s.*, p.name AS package_name, p.quote AS total_package_quote, p.duration, p.file_expired
        FROM subscribe s
        JOIN packages p ON s.package_id = p.id
        WHERE s.user_id = ? AND (s.expired_at IS NULL OR s.expired_at > NOW())
        ORDER BY expired_at DESC LIMIT 1
      `, [user.id]);

      if (!subs.length) {
        return res.json({
          status: 'success',
          message: 'No active subscription found.'
        });
      }

      const subscription = subs[0];

      return res.json({
        status: 'success',
        message: 'Active subscription found.',
        data: {
          package_name: subscription.package_name,
          quota_remaining: subscription.quote,
          quota_total: subscription.total_package_quote === -1 ? 'Unlimited' : subscription.total_package_quote,
          file_expired: subscription.file_expired === -1 ? 'Unlimited' : `${subscription.file_expired} minute`,
          duration: subscription.duration === -1 ? 'Unlimited' : `${subscription.duration} days`,
          expired_at: subscription.expired_at === null ? 'Lifetime' : subscription.expired_at
        }
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch subscription.',
        hint: 'Try again later or contact support if the problem persists.'
      });
    }
  },

  // Downloader
  download: async (req, res) => {
    const token = req.headers['token'];

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token is required.',
        hint: 'Include a valid Authorization token in the request headers.'
      });
    }

    try {
      const [users] = await Connection.query(
        'SELECT * FROM users WHERE token = ? LIMIT 1', [token]
      );

      if (!users.length) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid authentication token.',
          hint: 'Use a valid token associated with your account.'
        });
      }

      const user = users[0];
      const { url, type } = req.body;

      const [subs] = await Connection.query(
        `SELECT s.*, p.quote AS total_package_quote, p.duration, p.file_expired
         FROM subscribe s
         JOIN packages p ON s.package_id = p.id
         WHERE s.user_id = ? AND (s.expired_at IS NULL OR s.expired_at > NOW())
         ORDER BY expired_at DESC LIMIT 1`,
        [user.id]
      );

      if (!subs.length) {
        return res.status(403).json({
          status: 'error',
          message: 'No active package found.',
          hint: 'Subscribe to a package to access download features.'
        });
      }

      const subscription = subs[0];

      let isUnlimited = false;

      if (
        subscription.quote === -1 ||
        subscription.quote === null ||
        subscription.expired_at === null
      ) {
        isUnlimited = true;
      }

      if (!isUnlimited) {
        if (subscription.quote <= 0) {
          return res.status(403).json({
            status: 'error',
            message: 'Download quota exceeded.',
            hint: 'Upgrade your package.'
          });
        }
      }

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

      let platform = '';
      for (let p of platforms) {
        if (p.regex.test(url)) {
          platform = p.name;
          break;
        }
      }
	  
	  if (!platform) {
        const supportedPlatforms = platforms.map(p => p.name).join(', ');
        return res.status(400).json({
          status: 'error',
          message: 'Invalid URL. Platform not supported.',
          hint: `Provide a valid video/audio URL from supported platforms: ${supportedPlatforms}.`
        });
      }

      if (!['video', 'audio'].includes(type)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid download type.',
          hint: 'Supported types: video, audio.'
        });
      }

      let filePath = '';

      if (type === 'video') {
        filePath = await YtdlService.downloadVideo(url, user.id, subscription.file_expired);
      } else {
        filePath = await YtdlService.downloadAudio(url, user.id, subscription.file_expired);
      }

      if (!isUnlimited) {
        await Connection.query(
          'UPDATE subscribe SET quote = quote - 1 WHERE id = ?',
          [subscription.id]
        );
      }

      const filename = path.basename(filePath);
      const [rows] = await Connection.query(
        'SELECT * FROM downloads WHERE user_id = ? AND filename = ? LIMIT 1',
        [user.id, filename]
      );

      if (!rows.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Download data not found.',
          hint: 'Ensure the requested file exists before attempting to download.'
        });
      }

      const data = rows[0];
      const protocol = req.protocol;
      const host = req.get('host');

      return res.json({
        status: 'success',
        platform: platform,
        type: data.type,
        duration: data.duration,
        filename: data.filename,
        title: data.title,
        url: data.url,
        download: `${protocol}://${host}${data.filepath}`,
        created_at: data.created_at,
		expired_at: data.expired_at === null ? 'Lifetime' : data.expired_at
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({
        status: 'error',
        message: 'Download failed due to a server error.',
        hint: 'Try again later or contact support if the problem persists.'
      });
    }
  },
  
  // Regenerate Token
  regenerateToken: async (req, res) => {
    const userId = req.session?.user?.id;
    if (!userId) return res.redirect('/login');

    const newToken = crypto.randomBytes(32).toString('hex');

  try {
    await Connection.query(
      'UPDATE users SET token = ? WHERE id = ?',
      [newToken, userId]
    );

      req.session.user.token = newToken;

      req.flash('success', 'Token regenerated successfully');
      return res.redirect('/dashboard/rest-api');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Failed to regenerate token');
     return res.redirect('/dashboard/rest-api');
    }
  }

});
