const Connection = require('../config/Database');

exports.index = async (req, res) => {
  try {
    const ip = req.ip;
    const [rows] = await Connection.query(
      `SELECT * FROM downloads_guest WHERE ip = ? ORDER BY created_at DESC`,
      [ip]
    );
	
	const [packages] = await Connection.query(
      `SELECT * FROM packages WHERE name <> 'ADMIN' AND price <> 0.00 ORDER BY price ASC`
    );

    res.render('home', {
	  session: req.session,
      downloads: rows || [],
      packages: packages || []
    });
  } catch (err) {
    console.error('Error', err);
    res.render('home', {
	  session: req.session,
      downloads: [],
      packages: []
    });
  }
};
