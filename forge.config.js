/**
 * electron-builder configuration for esign
 * Used via: electron-builder --config forge.config.js
 */
module.exports = {
  appId: "com.esign.app",
  productName: "esign",
  files: [
    "main/**/*",
    "renderer/**/*",
    "assets/**/*",
    "package.json"
  ],
  asarUnpack: [
    "node_modules/@napi-rs/canvas/**/*"
  ],
  win: {
    target: "portable",
    icon: null
  },
  mac: {
    target: "dmg",
    icon: null
  },
  linux: {
    target: "AppImage",
    icon: null
  }
};
