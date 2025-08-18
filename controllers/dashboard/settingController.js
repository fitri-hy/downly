const Connection = require('../../config/Database');
const bcrypt = require('bcryptjs');

exports.index = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user.id;

        // Ambil data user
        const [rows] = await Connection.execute(
            'SELECT id, name, email, role, token, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.redirect('/login');
        }

        const user = rows[0];

        // Ambil data subscribe + packages
        const [subscriptions] = await Connection.execute(
            `SELECT s.id AS subscribe_id, s.user_id, s.package_id, s.quote, s.create_at, s.expired_at,
                    p.id AS package_id, p.name AS package_name, p.desc, p.price, p.duration, p.quote AS package_quote, p.file_expired
             FROM subscribe s
             JOIN packages p ON s.package_id = p.id
             WHERE s.user_id = ?`,
            [userId]
        );

        res.render('dashboard/setting', { 
            user,
            subscriptions // array hasil join
        });

    } catch (err) {
        console.error('Failed to load subscriptions:', err);
        req.flash('error', 'Error while retrieving settings data');
        return res.redirect('/dashboard');
    }
};


exports.update = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user.id;
        const { name } = req.body;

        await Connection.execute(
            'UPDATE users SET name = ? WHERE id = ?',
            [name, userId]
        );

        req.session.user.name = name;

        req.flash('success', 'Profile updated successfully');
        return res.redirect('/dashboard/setting');
    } catch (err) {
        console.error('Failed to update user:', err);
        req.flash('error', 'An error occurred while updating data');
        return res.redirect('/dashboard/setting');
    }
};

exports.changePassword = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user.id;
        const { password, 're-password': rePassword } = req.body;

        if (password !== rePassword) {
            req.flash('error', 'Passwords are not the same');
            return res.redirect('/dashboard/setting');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await Connection.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        req.flash('success', 'Password changed successfully, please log in again');
		req.session.destroy();
        return res.redirect('/login');
    } catch (err) {
        console.error('Failed to change password:', err);
        req.flash('error', 'An error occurred while changing the password');
        return res.redirect('/dashboard/setting');
    }
};