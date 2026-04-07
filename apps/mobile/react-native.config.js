const path = require('path');

module.exports = {
  dependencies: {
    'react-native-webrtc': {
      root: path.dirname(require.resolve('react-native-webrtc/package.json')),
    },
  },
};
