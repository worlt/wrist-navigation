// Literal module names are required by aiot-toolkit; dynamic require(name) is not compiled.
function loadNative(name) {
  if (name === '@system.interconnect') return require('@system.interconnect');
  if (name === '@system.vibrator') return require('@system.vibrator');
  if (name === '@system.app') return require('@system.app');
  if (name === '@system.storage') return require('@system.storage');
  throw new Error('Unsupported navigation API: ' + name);
}
module.exports = { loadNative };
