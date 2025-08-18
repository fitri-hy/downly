const path = require('path');
const fs = require('fs');
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
         WHERE url REGEXP ?`,
        [userId, platform.regex]
      );
      totals[platform.name] = rows[0].total;
    }

    res.render('administrator/index', {
      user: req.session.user,
      totals
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.userDownload = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const [downloadsRows] = await Connection.query(
      `SELECT 
         d.id, 
         u.name AS owner_name, 
         d.title COLLATE utf8mb4_general_ci AS title, 
         d.url COLLATE utf8mb4_general_ci AS url, 
         d.filename COLLATE utf8mb4_general_ci AS filename, 
         d.filepath COLLATE utf8mb4_general_ci AS filepath, 
         d.type COLLATE utf8mb4_general_ci AS type, 
         d.duration, 
         d.created_at, 
         d.expired_at
       FROM downloads d
       LEFT JOIN users u ON u.id = d.user_id
       ORDER BY d.created_at DESC`
    );

    const downloads = downloadsRows.map(d => ({
      ...d,
      filepath: d.filepath.replace(/.*public/, '')
    }));

    res.render('administrator/user-downloads', {
      user: req.session.user,
      downloads
    });

  } catch (err) {
    console.error('Error fetching downloads:', err);
    res.render('administrator/user-downloads', {
      user: req.session.user,
      downloads: [],
      error: 'Failed to get data.'
    });
  }
};

exports.userDownloadDelete = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const downloadId = req.params.id;

  try {
    const [rows] = await Connection.query(
      'SELECT * FROM downloads WHERE id = ?',
      [downloadId]
    );

    if (!rows.length) {
      req.flash('error', 'Download history not found');
      return res.redirect('/administrator/user-downloads');
    }

    const filePath = path.join(__dirname, '../../public', rows[0].filepath);

    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err);
    }

    await Connection.query('DELETE FROM downloads WHERE id = ?', [downloadId]);

    req.flash('success', 'Download history deleted successfully');
    res.redirect('/administrator/user-downloads');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete');
    res.redirect('/administrator/user-downloads');
  }
};

exports.guestDownload = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

	const [downloadsRows] = await Connection.query(
	  `SELECT 
		 d.id, 
		 d.ip, 
		 d.title COLLATE utf8mb4_general_ci AS title, 
		 d.url COLLATE utf8mb4_general_ci AS url, 
		 d.filename COLLATE utf8mb4_general_ci AS filename, 
		 d.filepath COLLATE utf8mb4_general_ci AS filepath, 
		 d.type COLLATE utf8mb4_general_ci AS type, 
		 d.duration, 
		 d.created_at, 
		 d.expired_at
	   FROM downloads_guest d
	   ORDER BY d.created_at DESC`
	);

    const downloads = downloadsRows.map(d => ({
      ...d,
      filepath: d.filepath.replace(/.*public/, '')
    }));

    res.render('administrator/guest-downloads', {
      user: req.session.user,
      downloads
    });

  } catch (err) {
    console.error('Error fetching downloads:', err);
    res.render('administrator/guest-downloads', {
      user: req.session.user,
      downloads: [],
      error: 'Failed to get data.'
    });
  }
};

exports.guestDownloadDelete = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const downloadId = req.params.id;

  try {
    const [rows] = await Connection.query(
      'SELECT * FROM downloads_guest WHERE id = ?',
      [downloadId]
    );

    if (!rows.length) {
      req.flash('error', 'Download history not found');
      return res.redirect('/administrator/guest-downloads');
    }

    const filePath = path.join(__dirname, '../../public', rows[0].filepath);

    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err);
    }

    await Connection.query('DELETE FROM downloads_guest WHERE id = ?', [downloadId]);

    req.flash('success', 'Download history deleted successfully');
    res.redirect('/administrator/guest-downloads');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete');
    res.redirect('/administrator/guest-downloads');
  }
};

exports.users = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const [usersRows] = await Connection.query(
      `SELECT 
         u.id,
         u.name,
         u.email,
         u.role,
         u.token,
         u.status,
         u.created_at,
         s.id AS subscribe_id,
         s.package_id,
         s.quote AS subscribe_quote,
         s.create_at AS subscribe_created_at,
         s.expired_at AS subscribe_expired_at,
         p.name AS package_name,
         p.desc AS package_desc,
         p.price AS package_price,
         p.duration AS package_duration,
         p.quote AS package_quote,
         p.file_expired AS package_file_expired
       FROM users u
       LEFT JOIN subscribe s ON s.user_id = u.id
       LEFT JOIN packages p ON p.id = s.package_id
       ORDER BY u.created_at DESC`
    );

    const [packagesRows] = await Connection.query(
      `SELECT id, name, duration FROM packages ORDER BY name ASC`
    );

    res.render('administrator/users', {
      user: req.session.user,
      users: usersRows,
      packages: packagesRows
    });

  } catch (err) {
    console.error('Error fetching users with subscription & package:', err);
    res.render('administrator/users', {
      user: req.session.user,
      users: [],
      packages: [],
      error: 'Failed to get users data.'
    });
  }
};

exports.usersUpdate = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    let { id, name, role, status, package_id } = req.body;

    if (!id || !name || !role || !status || !package_id) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/administrator/users');
    }

    const [userRows] = await Connection.query(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );

    if (userRows.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/administrator/users');
    }

    const currentUser = userRows[0];

    if (currentUser.role === 'superadmin') {
      await Connection.query(
        `UPDATE users SET name = ? WHERE id = ?`,
        [name, id]
      );

      req.flash('success', 'Superadmin name updated successfully. You can only change the name');
      return res.redirect('/administrator/users');
    }

    if (role === 'superadmin') {
      req.flash('error', 'Cannot assign superadmin role to a regular user.');
      return res.redirect('/administrator/users');
    }

    await Connection.query(
      `UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?`,
      [name, role, status, id]
    );

    const [subscribeRows] = await Connection.query(
      `SELECT package_id FROM subscribe WHERE user_id = ?`,
      [id]
    );

    const [pkgRows] = await Connection.query(
      `SELECT * FROM packages WHERE id = ?`,
      [package_id]
    );

    if (pkgRows.length === 0) {
      req.flash('error', 'Selected package not found.');
      return res.redirect('/administrator/users');
    }

    const pkg = pkgRows[0];
    let expiredAt = null;
    if (pkg.duration !== -1) {
      expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + pkg.duration);
    }

    if (subscribeRows.length > 0) {
      const currentPackageId = subscribeRows[0].package_id;

      if (parseInt(currentPackageId) !== parseInt(package_id)) {
        await Connection.query(
          `UPDATE subscribe SET package_id = ?, quote = ?, create_at = NOW(), expired_at = ? WHERE user_id = ?`,
          [package_id, pkg.quote, expiredAt, id]
        );
      }
    } else {
      await Connection.query(
        `INSERT INTO subscribe (user_id, package_id, quote, create_at, expired_at) VALUES (?, ?, ?, NOW(), ?)`,
        [id, package_id, pkg.quote, expiredAt]
      );
    }

    req.flash('success', 'User updated successfully.');
    res.redirect('/administrator/users');

  } catch (err) {
    console.error('Error updating user and subscription:', err);
    req.flash('error', 'Failed to update user.');
    res.redirect('/administrator/users');
  }
};

exports.usersDelete = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const { id } = req.params;

    if (!id) {
      req.flash('error', 'User ID is required.');
      return res.redirect('/administrator/users');
    }

    const [userRows] = await Connection.query(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );

    if (userRows.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/administrator/users');
    }

    const user = userRows[0];

    if (user.role === 'superadmin') {
      req.flash('error', 'Superadmin cannot be deleted.');
      return res.redirect('/administrator/users');
    }

    await Connection.query(
      `DELETE FROM subscribe WHERE user_id = ?`,
      [id]
    );

    await Connection.query(
      `DELETE FROM users WHERE id = ?`,
      [id]
    );

    req.flash('success', 'User deleted successfully.');
    res.redirect('/administrator/users');

  } catch (err) {
    console.error('Error deleting user:', err);
    req.flash('error', 'Failed to delete user.');
    res.redirect('/administrator/users');
  }
};
