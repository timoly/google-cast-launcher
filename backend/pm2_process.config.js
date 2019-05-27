module.exports = {
  apps: [
    {
      name: 'google-cast-launcher',
      script: 'node_modules/google-cast-launcher/build/index.js',
      env: {
        DISPLAY: ':99',
        PI: true
      }
    },
    {
      name: 'Xvfb',
      interpreter: 'none',
      script: 'Xvfb',
      args: ':99 -s "-screen 0 1280x1024x8 -ac -nolisten tcp"'
    }
  ]
}
