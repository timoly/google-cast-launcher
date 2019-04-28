const channelMapping = [
  "YLE 1", 
  "YLE 2", 
  "Yle Teema/Fem", 
  "Fox", 
  "National Geographic", 
  "Nat Geo Wild", 
  "Viasat Explorer",
  "Viasat Nature", 
  "Viasat History", 
  "BBC World News", 
  "CNN International",
  "Euronews", 
  "Boomerang Nordic", 
  "Nick Jr Scandinavia", 
  "Cartoon Network", 
  "Music Television HD", 
  "MTV Hits",
  "VH1 Europe"
]

module.exports = async function(page, Cast, username, password) {
  const loginBtn = '.LoginHeader-menu-3DV_r'
  await page.waitForSelector(loginBtn, {visible: true})
  await page.click(loginBtn)

  if(await page.$('button[data-testhook="header-authenticated-username"') === null){
    const usernameEl = "input.username"
    await page.waitForSelector(usernameEl, {visible: true})
    await page.type(usernameEl, username)
    await page.type("input.password", password)
    await page.click('input[type="submit"]')
  }

  // await page.click('a[data-testhook="header-menu-channels"]')

  await page.evaluate(() => {
    const elements = document.getElementsByClassName('.Carousel-inner-gyO8I')
    elements[10].click()
  })

  Cast.startTabMirroring()
  // await page.click('', {visible: true})
  // return new Promise((resolve) => setTimeout(resolve, 2000))
}
