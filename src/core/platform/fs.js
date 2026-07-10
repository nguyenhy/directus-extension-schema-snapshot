const fs = require('fs');

/** @param {string} p @returns {boolean} */
function exists(p) {
  return fs.existsSync(p);
}

/** @param {string} p @param {object} [opts] */
function mkdir(p, opts = { recursive: true }) {
  fs.mkdirSync(p, opts);
}

/** @param {string} p @param {object} [opts] */
function remove(p, opts = { recursive: true, force: true }) {
  fs.rmSync(p, opts);
}

/** @param {string} p @returns {string} */
function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

/** @param {string} p @param {string} content */
function writeFile(p, content) {
  fs.writeFileSync(p, content);
}

/** @param {string} p @param {string} content */
function appendFile(p, content) {
  fs.appendFileSync(p, content);
}

/** @param {string} src @param {string} dest */
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

/** @param {string} p @returns {string[]} */
function readdir(p) {
  return fs.readdirSync(p);
}

/** @param {string} p @returns {boolean} */
function isDirectory(p) {
  return fs.statSync(p).isDirectory();
}

module.exports = { exists, mkdir, remove, readFile, writeFile, appendFile, copyFile, readdir, isDirectory };
