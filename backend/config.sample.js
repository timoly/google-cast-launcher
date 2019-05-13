export const config = {
  viaplayUsername: '',
  viaplayPassword: '',
  pi: {
    targetSink: 'Living Room TV',
    chromePath: '/snap/bin/chromium',
    userDataDir: '/home/pi/.config/chromium/Default'
  },
  mac: {
    targetSink: 'Living Room TV',
    chromePath:
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    userDataDir:
      '/Users/{username}/Library/Application Support/Google/Chrome Canary/Default'
  }
}
