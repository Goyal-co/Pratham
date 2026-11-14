/** Metro require.context shim for expo-router in npm workspaces. */
module.exports = require.context("./app", true, /.*/);
