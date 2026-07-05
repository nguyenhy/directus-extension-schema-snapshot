const path = require('path');

// Single source of truth for "this package's own root dir" — anywhere
// that needs a file bundled with the package (not the user's cwd/target
// dir) requires this instead of climbing __dirname with '..' segments,
// which silently breaks if that file ever moves a directory deeper/shallower.
const PACKAGE_ROOT = path.dirname(require.resolve('../package.json'));

module.exports = { PACKAGE_ROOT };
