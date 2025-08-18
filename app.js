require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const http = require('http');
const WebSocket = require('ws');
const cleanupExpiredDownloads = require('./middlewares/cleanupExpiredDownloads');
const cleanupExpiredGuestDownloads = require('./middlewares/cleanupExpiredGuestDownloads');
const { recaptcha } = require('./middlewares/recaptchaMiddleware');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const SERVER = process.env.SERVER || '127.0.0.1';

app.set('trust proxy', process.env.TRUST_PROXY === 'true');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fhylabs-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, httpOnly: true, secure: process.env.NODE_ENV === 'production' },
  })
);
app.use(flash());
app.use((req, res, next) => {
  const protocol = req.protocol;
  const host = req.get('host');
  res.locals.BASE_URL = `${protocol}://${host}`;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.recaptcha = recaptcha;
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.clientsSet = new Set();

wss.on('connection', (ws) => {
  wss.clientsSet.add(ws);
  ws.on('close', () => wss.clientsSet.delete(ws));
  ws.on('error', (err) => console.error('WebSocket error:', err));
});

const YtdlServiceClass = require('./services/YtdlService');
const YtdlService = new YtdlServiceClass(wss);

const YtdlGuestServiceClass = require('./services/YtdlGuestService');
const YtdlGuestService = new YtdlGuestServiceClass(wss);

const webRouter = require('./routes/web')(YtdlService, YtdlGuestService);
app.use('/', webRouter);

cleanupExpiredDownloads(wss);
cleanupExpiredGuestDownloads(wss);

module.exports = { app, server, wss, YtdlService, YtdlGuestService };

server.listen(PORT, SERVER, () => {
  console.log(`Server running at http://${SERVER}:${PORT}`);
});
