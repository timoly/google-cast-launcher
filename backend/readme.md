# node
npm install

## raspberry pi
setup: https://hackernoon.com/raspberry-pi-headless-install-462ccabd75d0
wifi: https://howchoo.com/g/ndy1zte2yjn/how-to-set-up-wifi-on-your-raspberry-pi-without-ethernet

sudo apt-get update && sudo apt-get upgrade
sudo apt-get install nodejs npm git xvfb snapd --yes
sudo snap install core 
sudo snap install chromium 

git clone https://github.com/timoly/google-cast-launcher.git
npm install

xvfb-run -a --server-args="-screen 0 1280x1024x16 -ac -nolisten tcp" node app.js 