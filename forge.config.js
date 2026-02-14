module.exports = {
  appId: 'com.esign.app',
  productName: 'esign',
  directories: {
    output: 'dist',
  },
  files: [
    'main/**/*',
    'renderer/**/*',
    'assets/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  asarUnpack: [
    'node_modules/@napi-rs/canvas/**/*',
  ],
  win: {
    target: 'nsis',
    icon: null,
  },
  mac: {
    target: 'dmg',
    icon: null,
  },
  linux: {
    target: 'AppImage',
    icon: null,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
