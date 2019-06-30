#trello backlog
https://trello.com/b/pk8mzi1N/google-cast-launcher

# google cast launcher  (proof of concept)
- repository: https://github.com/timoly/google-cast-launcher.git

- Node backend that can be used to start casting to a selected chromecast device without user interaction.
- ios and amazon alexa client applications to be implemented
- Uses puppeteer & chrome remote interface to interact with the target page.
- Chrome's remote interface supports tab casting, which works with some chromecast sender web app's, where the actual custom receiver app is start if available. But with some services, the custom receiver app is not started even if available, and the basic tab casting starts instead.
- Modular structure where target services can define custom logic which is needed to start the cast. 
