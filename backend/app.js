const CDP = require('chrome-remote-interface')
const puppeteer = require("puppeteer-core")
const env = (() => {
  const arg = process.argv[2]
  switch(arg){
    case "pi":
    case "mac":
      return arg
    default:
      throw new Error("invalid/missing env argument")
  }
})()
const config = require("./config")
const envConfig = config[env]
const {targetSink, chromePath, userDataDir} = envConfig

async function serviceHandler(page, Cast, type, serviceParameters){
  switch(type){
    case "ruutu":
      const ruutu = require("./ruutu")
      return ruutu(page, serviceParameters.url)
    case "youtube":
      const youtube = require("./youtube")
      return youtube(page, serviceParameters.url)
    case "viaplay":
      const viaplay = require("./viaplay")
      return viaplay({
        ...serviceParameters,
        page, 
        Cast, 
        sinkName: targetSink
      })
    default: 
      throw new Error(`unsupported ${type}`)
  }
}

async function cast(type, serviceParameters){
  try{
    const browser = await puppeteer.launch({
      headless: false, 
      executablePath: chromePath,
      defaultViewport: {
        width: 1280,
        height: 1024
      },
      ignoreHTTPSErrors: true,
      args: [
        "--remote-debugging-port=9222",
        "--no-first-run",
        "--mute-audio",
        "--flag-switches-begin",
        "--load-media-router-component-extension=1",
        "--flag-switches-end",
        '--disk-cache-dir=./',
      ],
      userDataDir,
      ignoreDefaultArgs: true
    })
    const page = await browser.newPage()
    page.on('console', consoleObj => console.log(consoleObj.text()))
    const list = await CDP.List()
    const tab = list.find(i => i.url === "about:blank" && i.type === "page")
    if(!tab){
      throw new Error("could not activate tab control")
    }
    const client = await CDP({target: tab.id})
    await CDP.Activate({id: tab.id})
    const {Cast} = client
    await Cast.enable()
    
    await new Promise(async (resolve, reject) => {
      let count = 0
      let castingStarted = false

      Cast.issueUpdated(msg => {
        console.log("cast issue:", msg)
      })

      Cast.sinksUpdated(async sinks => {
        if(castingStarted){
          return
        }
        console.log("sinks:", sinks)
        const sinkName = sinks.sinkNames.find(sink => sink === targetSink)
        if(!sinkName && count > 5){
          return reject(new Error("requested sink not found"))
        }
        if(sinkName){
          castingStarted = true
          await Cast.setSinkToUse({sinkName})
          try{
            await serviceHandler(page, Cast, type, serviceParameters)
          }catch(error){
            reject(error)
          }
          resolve()
        }
      })
    })
    await Promise.all([client.close(), browser.close()])
  }
  catch(error){
    console.error(error)
  }
}
// cast("ruutu", {url: "https://www.ruutu.fi/video/3257790"})
// cast("youtube", {url: "https://www.youtube.com/watch?v=LOUgsAmD51s"})
cast("viaplay", {
  channel: "CNN International",
  username: config.viaplayUsername,
  password: config.viaplayPassword
})
 
