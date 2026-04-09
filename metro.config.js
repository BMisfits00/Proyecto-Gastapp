const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const workspaceRoot = __dirname;
const config = getDefaultConfig(workspaceRoot);

// Incluir packages/ en el watch de Metro
config.watchFolders = [path.resolve(workspaceRoot, 'packages')];

// Resolver: buscar node_modules en la raíz del workspace
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
