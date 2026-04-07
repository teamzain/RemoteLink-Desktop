const path = require("path");
const Module = require("module");

// Fix for npm workspace hoisting on Windows/Node 24:
// nativewind is hoisted to repo root but react-native lives in apps/mobile/node_modules.
// Setting NODE_PATH before any require() lets nativewind's sub-dependencies find react-native,
// and prevents Metro from falling back to import() which breaks on Windows non-C drives.
process.env.NODE_PATH = [
  path.join(__dirname, "node_modules"),
  process.env.NODE_PATH,
]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const mobileNodeModules = path.resolve(projectRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so hoisted packages in root node_modules are visible to Metro
config.watchFolders = [workspaceRoot];

// Exclude non-React Native apps to prevent watching massive/unrelated build folders
config.resolver.blockList = [
  ...config.resolver.blockList,
  /.*[/\\]apps[/\\]flutter_client[/\\].*/,
  /.*[/\\]apps[/\\]desktop[/\\]release[/\\].*/,
];

// Search mobile's node_modules first, then root — ensures packages like @react-navigation
// that exist in both places use the mobile copy (which depends on react@19, not root's react@18)
config.resolver.nodeModulesPaths = [
  mobileNodeModules,
  path.resolve(workspaceRoot, "node_modules"),
];

// Apply nativewind first — it wraps any existing resolveRequest as its "originalResolver"
const windConfig = withNativeWind(config, { input: "./global.css" });

// Now wrap nativewind's final resolver so our React redirect has the highest priority.
// This prevents root's react@18 from being used by any hoisted package (e.g. @react-navigation).
const nativewindResolver = windConfig.resolver.resolveRequest;
windConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = moduleName.split("/")[0];
  if (base === "react" || base === "react-native" || base === "react-dom") {
    try {
      return {
        filePath: require.resolve(moduleName, { paths: [mobileNodeModules] }),
        type: "sourceFile",
      };
    } catch (e) {
      // fall through to nativewind/default resolver
    }
  }
  return nativewindResolver
    ? nativewindResolver(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = windConfig;
