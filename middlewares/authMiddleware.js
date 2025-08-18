function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

function hasRole(roles = []) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }

    const roleArray = Array.isArray(roles) ? roles : [roles];

    if (roleArray.includes(req.session.user.role)) {
      return next();
    } else {
	  req.flash('error', 'Access Denied. Your role is not allowed!!');
      return res.redirect('/');
      //return res.status(403).send('Access denied');
    }
  };
}

function checkGuest (req, res, next) {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

module.exports = { isAuthenticated, hasRole, checkGuest };
