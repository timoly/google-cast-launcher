# google cast launcher  (proof of concept)

- Node app that can be used to start casting to a selected chromecast device without user interaction.
- Uses puppeteer & chrome remote interface to interact with the target page.
- Chrome's remote interface supports tab casting, which works with some chromecast sender web app's, where the actual custom receiver app is start if available. But with some services, the custom receiver app is not started even if available, and the basic tab casting starts instead.
- Modular structure where target services can define custom logic which is needed to start the cast. 