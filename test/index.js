const { execFile } = require('child_process');
const path = require('path');

const YTDLP_PATH = path.resolve(__dirname, '../plugins/yt-dlp'); // portable binary
const PYTHON_CMD = 'python'; // pastikan Python terinstall

const args = [
  YTDLP_PATH,
  'https://www.tiktok.com/@tokoakimobil/video/7538970602300886289',
  '-o', 'downloads/%(title)s.%(ext)s'
];

execFile(PYTHON_CMD, args, (err, stdout, stderr) => {
  if (err) return console.error(err);
  console.log(stdout);
});
