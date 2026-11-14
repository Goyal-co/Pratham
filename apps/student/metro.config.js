const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  "@pratham/shared": path.resolve(workspaceRoot, "packages/shared"),
};

const ctxShim = path.resolve(projectRoot, "router-ctx.js");
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "expo-router/_ctx" ||
    moduleName === "expo-router/_ctx.android" ||
    moduleName === "expo-router/_ctx.ios" ||
    moduleName === "expo-router/_ctx.web" ||
    moduleName.endsWith("expo-router/_ctx") ||
    moduleName.endsWith("expo-router/_ctx.js") ||
    moduleName.endsWith("expo-router/_ctx.web.js")
  ) {
    return { filePath: ctxShim, type: "sourceFile" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
