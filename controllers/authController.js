const Connection = require('../config/Database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { admin, Config } = require('../config/firebase');

exports.indexLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { 
	firebaseConfig: Config,
	useGoogleAuth: Config.useGoogleAuth
  });
};

exports.indexRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('register');
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await Connection.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
	
	if (req.recaptcha && req.recaptcha.error) {
      req.flash('error', 'reCAPTCHA verification failed, please try again');
      return res.redirect('/login');
	}

    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }
	
	if (user.status !== 'active') {
      req.flash('error', 'Your account is inactive. Please contact admin.');
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }
	
	if (!user.password) {
      req.flash('error', 'Please login using Google sign-in');
      return res.redirect('/login');
    }

    req.session.user = { 
	  id: user.id, 
	  name: user.name, 
	  email: user.email, 
	  role: user.role, 
	  token: user.token, 
	  status: user.status
	};
	
    if (user.role === 'superadmin' || user.role === 'admin') {
      return res.redirect('/administrator');
    } else {
      return res.redirect('/dashboard');
    }
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/login');
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
	
	if (req.recaptcha && req.recaptcha.error) {
      req.flash('error', 'reCAPTCHA verification failed, please try again');
      return res.redirect('/login');
	}

	if (!name || !email || !password || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/register');
    }
	
	if (!/^[a-zA-Z\s]{1,25}$/.test(name)) {
      req.flash('error', 'Name must contain only letters and spaces, max 25 characters');
      return res.redirect('/register');
    }
	
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash('error', 'Invalid email format');
      return res.redirect('/register');
    }
	
	if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters');
      return res.redirect('/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/register');
    }

    const [existing] = await Connection.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      req.flash('error', 'Email already exists');
      return res.redirect('/register');
    }

    const role = 'user';
    const status = 'active';
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

    const [result] = await Connection.query(
      'INSERT INTO users (name, email, password, role, token, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [name, email, hashedPassword, role, token, status]
    );

    const userId = result.insertId;

    const [packages] = await Connection.query('SELECT * FROM packages WHERE price = 0.00');
    if (packages.length > 0) {
      const pkg = packages[0];
      let expiredAt = null;

      if (pkg.duration > 0) {
        expiredAt = new Date();
        expiredAt.setDate(expiredAt.getDate() + pkg.duration);
      }

      await Connection.query(
        'INSERT INTO subscribe (user_id, package_id, quote, create_at, expired_at) VALUES (?, ?, ?, NOW(), ?)',
        [userId, pkg.id, pkg.quote, expiredAt]
      );
    }

    req.flash('success', 'Register successful. Please login.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/register');
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/login');
};

exports.googleLogin = async (req, res) => {
  if (!Config.useGoogleAuth) {
    req.flash('error', 'Google authentication is disabled');
    return res.redirect('/login');
  }

  const { idToken } = req.body;
  if (!idToken) {
    req.flash('error', 'Token is required');
    return res.redirect('/login');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, uid } = decodedToken;

    const [existingUsers] = await Connection.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    let user;
    if (existingUsers.length === 0) {
      const [packages] = await Connection.query('SELECT * FROM packages WHERE price = 0.00');
      if (packages.length === 0) {
        req.flash('error', 'Default package not found');
        return res.redirect('/login');
      }

      const pkg = packages[0];
      let expiredAt = null;
      if (pkg.duration > 0) {
        expiredAt = new Date();
        expiredAt.setDate(expiredAt.getDate() + pkg.duration);
      }

      const token = crypto.randomBytes(32).toString('hex');
      const role = 'user';
      const status = 'active';

      const [result] = await Connection.query(
        'INSERT INTO users (name, email, password, role, token, status, google_uid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [name, email.toLowerCase(), null, role, token, status, uid]
      );

      const userId = result.insertId;

      await Connection.query(
        'INSERT INTO subscribe (user_id, package_id, quote, create_at, expired_at) VALUES (?, ?, ?, NOW(), ?)',
        [userId, pkg.id, pkg.quote, expiredAt]
      );

      user = {
        id: userId,
        name,
        email: email.toLowerCase(),
        token,
        role,
        status,
      };
    } else {
      user = existingUsers[0];

      if (!user.google_uid) {
        await Connection.query('UPDATE users SET google_uid = ? WHERE email = ?', [uid, email.toLowerCase()]);
        user.google_uid = uid;
      }
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      token: user.token,
      role: user.role,
      status: user.status,
    };

    if (user.status.toLowerCase() === 'inactive') {
      req.flash('error', 'Your account is inactive');
      return res.redirect('/login');
    }
    if (user.status.toLowerCase() === 'suspended') {
      req.flash('error', 'Your account is suspended');
      return res.redirect('/login');
    }

    if (user.role === 'admin' || user.role === 'superadmin') {
      return res.redirect('/administrator');
    } else if (user.role === 'user') {
      return res.redirect('/dashboard');
    } else {
      req.session.destroy(() => res.redirect('/login'));
    }
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    req.flash('error', 'Invalid Token');
    return res.redirect('/login');
  }
};
