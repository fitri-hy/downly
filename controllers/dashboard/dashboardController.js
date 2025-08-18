const Connection = require('../../config/Database');

exports.index = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const userId = req.session.user.id;

  const platforms = [
    { name: 'YouTube', regex: 'youtube\\.com|youtu\\.be' },
    { name: 'Facebook', regex: 'facebook\\.com' },
    { name: 'Dailymotion', regex: 'dailymotion\\.com' },
    { name: 'Instagram', regex: 'instagram\\.com' },
    { name: 'SoundCloud', regex: 'soundcloud\\.com' },
    { name: 'TikTok', regex: 'tiktok\\.com' },
    { name: 'Twitter/X', regex: 'twitter\\.com|x\\.com' },
    { name: 'Vimeo', regex: 'vimeo\\.com' },
    { name: 'VK', regex: 'vk\\.com' }
  ];

  try {
    const totals = {};

    for (const platform of platforms) {
      const [rows] = await Connection.execute(
        `SELECT COUNT(*) as total 
         FROM downloads 
         WHERE user_id = ? AND url REGEXP ?`,
        [userId, platform.regex]
      );
      totals[platform.name] = rows[0].total;
    }

    res.render('dashboard/index', {
      user: req.session.user,
      totals
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};