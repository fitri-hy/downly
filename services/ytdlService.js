const Connection = require('../config/Database');
const { spawn, spawnSync, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const slugify = require('slugify');

const DOWNLOADS_DIR = path.resolve(__dirname, '../public/downloads');
const YTDLP_PATH = path.resolve(__dirname, '../plugins/yt-dlp');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function getUniqueFilename(basePath, filename, ext) {
  let finalName = `${filename}.${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(basePath, finalName))) {
    finalName = `${filename}-${counter}.${ext}`;
    counter++;
  }
  return finalName;
}

function detectPython() {
  const platform = os.platform();
  const pythonCmd = platform === 'win32' ? 'python' : 'python3';
  const check = spawnSync(pythonCmd, ['--version']);
  if (check.error) {
    console.warn('Python not found!');
    return null;
  }
  return pythonCmd;
}

const PYTHON_PATH = detectPython();
if (!PYTHON_PATH) process.exit(1);

try {
  execSync(`${PYTHON_PATH} ${YTDLP_PATH} -U`, { stdio: 'inherit' });
} catch (e) {
  console.warn('Failed to update yt-dlp automatically.');
}

class YtdlService {
  constructor(wss) {
    this.wss = wss;
  }

  broadcastDownloads(data) {
    if (!this.wss || !this.wss.clientsSet) return;
    const payload = JSON.stringify({ type: 'downloads', data });
    this.wss.clientsSet.forEach(client => {
      if (client.readyState === 1) client.send(payload);
    });
  }

  async downloadVideo(url, user_id, fileExpiredMinutes) {
    const info = await this.getInfo(url);
    const tempOutput = path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s');

    const args = [
      '-f', '(mp4[vcodec!*=none]+bestaudio/best)[ext=mp4]/bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '-o', tempOutput
    ];

    await this._spawnYtdlp(url, args);

    const allFiles = fs.readdirSync(DOWNLOADS_DIR)
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (!allFiles.length) throw new Error('Video file not found after download');

    const downloadedFile = allFiles[0].name;
    const ext = path.extname(downloadedFile).slice(1);

    const baseName = path.basename(downloadedFile, path.extname(downloadedFile));
    const slugName = slugify(baseName, { lower: true, strict: true });

    const fileName = getUniqueFilename(DOWNLOADS_DIR, slugName, ext);
    const output = path.join(DOWNLOADS_DIR, fileName);
    fs.renameSync(path.join(DOWNLOADS_DIR, downloadedFile), output);

    const relativeFilePath = `/downloads/${fileName}`;
    const now = new Date();
    const expired = (fileExpiredMinutes === -1) ? null : new Date(now.getTime() + fileExpiredMinutes * 60 * 1000);

    await Connection.query(
      `INSERT INTO downloads 
       (user_id, title, url, filename, filepath, type, duration, created_at, expired_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        info.title,
        url,
        fileName,
        relativeFilePath,
        'video',
        info.duration || 0,
        now,
        expired
      ]
    );

    const [rows] = await Connection.query(
      `SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC`,
      [user_id]
    );
    const downloads = rows.map(d => ({ ...d, filepath: d.filepath }));
    this.broadcastDownloads(downloads);

    return relativeFilePath;
  }

  async downloadAudio(url, user_id, fileExpiredMinutes) {
    const info = await this.getInfo(url);
    const tempOutput = path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s');

    const args = [
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', tempOutput
    ];

    await this._spawnYtdlp(url, args);

    const allFiles = fs.readdirSync(DOWNLOADS_DIR)
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (!allFiles.length) throw new Error('Audio file not found after download');

    const downloadedFile = allFiles[0].name;
    const ext = path.extname(downloadedFile).slice(1);

    const baseName = path.basename(downloadedFile, path.extname(downloadedFile));
    const slugName = slugify(baseName, { lower: true, strict: true });

    const fileName = getUniqueFilename(DOWNLOADS_DIR, slugName, ext);
    const output = path.join(DOWNLOADS_DIR, fileName);
    fs.renameSync(path.join(DOWNLOADS_DIR, downloadedFile), output);

    const relativeFilePath = `/downloads/${fileName}`;
    const now = new Date();
    const expired = (fileExpiredMinutes === -1) ? null : new Date(now.getTime() + fileExpiredMinutes * 60 * 1000);

    await Connection.query(
      `INSERT INTO downloads 
        (user_id, title, url, filename, filepath, type, duration, created_at, expired_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        info.title,
        url,
        fileName,
        relativeFilePath,
        'audio',
        info.duration || 0,
        now,
        expired
      ]
    );

    const [rows] = await Connection.query(
      `SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC`,
      [user_id]
    );
    const downloads = rows.map(d => ({ ...d, filepath: d.filepath }));
    this.broadcastDownloads(downloads);

    return relativeFilePath;
  }

  getInfo(url) {
    return new Promise((resolve, reject) => {
      const args = [YTDLP_PATH, url, '-j'];
      const process = spawn(PYTHON_PATH, args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => { stdout += data.toString(); });
      process.stderr.on('data', data => { stderr += data.toString(); });

      process.on('close', code => {
        if (code !== 0) {
          console.error('Error:', stderr);
          return reject(new Error(`Get info failed: ${stderr}`));
        }

        try {
          const cleaned = stdout.trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          console.error('Error:', stdout);
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
  }

  _spawnYtdlp(url, args) {
    return new Promise((resolve, reject) => {
      const finalArgs = [YTDLP_PATH, url, '--no-warnings', '--quiet', '--restrict-filenames', ...args];
      const process = spawn(PYTHON_PATH, finalArgs);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => stdout += data.toString());
      process.stderr.on('data', data => stderr += data.toString());

      process.on('close', code => {
        if (code !== 0) return reject(new Error(stderr));
        resolve(stdout.trim());
      });
    });
  }
}

module.exports = YtdlService;
