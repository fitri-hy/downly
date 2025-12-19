const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole, checkGuest } = require('../middlewares/authMiddleware');
const { recaptchaMiddleware } = require('../middlewares/recaptchaMiddleware');

module.exports = (YtdlService, YtdlGuestService ) => {

  // Auth
  const Auth = require('../controllers/authController');
  router.get('/login', checkGuest, Auth.indexLogin);
  router.post('/login', recaptchaMiddleware, Auth.login);
  router.get('/register', checkGuest, Auth.indexRegister);
  router.post('/register', recaptchaMiddleware, Auth.register);
  router.get('/logout', Auth.logout);
  router.post('/login-google', Auth.googleLogin);

  // Landing
  const Home = require('../controllers/homeController');
  router.get('/', Home.index);

  // Dashboard
  const Dashboard = require('../controllers/dashboard/dashboardController');
  router.get('/dashboard', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Dashboard.index);

  // Setting
  const Setting = require('../controllers/dashboard/settingController');
  router.get('/dashboard/setting', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Setting.index);
  router.post('/dashboard/setting/update', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Setting.update);
  router.post('/dashboard/setting/cahnge-password', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Setting.changePassword);

  // Rest Api
  const RestApi = require('../controllers/dashboard/restApiController')(YtdlService);
  router.get('/dashboard/rest-api', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), RestApi.index);
  router.post('/dashboard/rest-api/re-token', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), RestApi.regenerateToken);
  router.get('/api/subscribe', RestApi.subscribe);
  router.post('/api/downloader', RestApi.download);

  // Youtube
  const Youtube = require('../controllers/dashboard/youtubeController')(YtdlService);
  router.get('/dashboard/youtube', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Youtube.index);
  router.post('/dashboard/youtube', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Youtube.download);
  router.post('/dashboard/youtube/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Youtube.deleteDownload);

  // Facebook
  const Facebook = require('../controllers/dashboard/facebookController')(YtdlService);
  router.get('/dashboard/facebook', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Facebook.index);
  router.post('/dashboard/facebook', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Facebook.download);
  router.post('/dashboard/facebook/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Facebook.deleteDownload);

  // Instagram
  const Instagram = require('../controllers/dashboard/instagramController')(YtdlService);
  router.get('/dashboard/instagram', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Instagram.index);
  router.post('/dashboard/instagram', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Instagram.download);
  router.post('/dashboard/instagram/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Instagram.deleteDownload);

  // Twitter
  const Twitter = require('../controllers/dashboard/twitterController')(YtdlService);
  router.get('/dashboard/twitter', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Twitter.index);
  router.post('/dashboard/twitter', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Twitter.download);
  router.post('/dashboard/twitter/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Twitter.deleteDownload);

  // Tiktok
  const Tiktok = require('../controllers/dashboard/tiktokController')(YtdlService);
  router.get('/dashboard/tiktok', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Tiktok.index);
  router.post('/dashboard/tiktok', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Tiktok.download);
  router.post('/dashboard/tiktok/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Tiktok.deleteDownload);

  // Vimeo
  const Vimeo = require('../controllers/dashboard/vimeoController')(YtdlService);
  router.get('/dashboard/vimeo', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Vimeo.index);
  router.post('/dashboard/vimeo', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Vimeo.download);
  router.post('/dashboard/vimeo/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Vimeo.deleteDownload);

  // VKontakte
  const VKontakte = require('../controllers/dashboard/vkController')(YtdlService);
  router.get('/dashboard/vk', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), VKontakte.index);
  router.post('/dashboard/vk', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), VKontakte.download);
  router.post('/dashboard/vk/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), VKontakte.deleteDownload);

  // Dailymotion
  const Dailymotion = require('../controllers/dashboard/dailymotionController')(YtdlService);
  router.get('/dashboard/dailymotion', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Dailymotion.index);
  router.post('/dashboard/dailymotion', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Dailymotion.download);
  router.post('/dashboard/dailymotion/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), Dailymotion.deleteDownload);

  // SoundCloud
  const SoundCloud = require('../controllers/dashboard/soundcloudController')(YtdlService);
  router.get('/dashboard/soundcloud', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), SoundCloud.index);
  router.post('/dashboard/soundcloud', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), SoundCloud.download);
  router.post('/dashboard/soundcloud/delete/:id', isAuthenticated, hasRole(['user', 'admin', 'superadmin']), SoundCloud.deleteDownload);

  // Guest Download
  const GuestDownload = require('../controllers/dashboard/guestDownloadController')(YtdlGuestService);
  router.post('/downloads', GuestDownload.download);
  router.post('/downloads/delete/:id', GuestDownload.deleteDownload);
  
  // Administrator
  const Administrator = require('../controllers/dashboard/administratorController');
  router.get('/administrator', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.index);
  router.get('/administrator/user-downloads', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.userDownload);
  router.post('/administrator/user-downloads/delete/:id', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.userDownloadDelete);
  router.get('/administrator/guest-downloads', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.guestDownload);
  router.post('/administrator/guest-downloads/delete/:id', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.guestDownloadDelete);
  router.get('/administrator/users', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.users);
  router.post('/administrator/users/update', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.usersUpdate);
  router.post('/administrator/users/delete/:id', isAuthenticated, hasRole(['admin', 'superadmin']), Administrator.usersDelete);

  return router;
};
