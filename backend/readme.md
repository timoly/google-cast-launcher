# node
npm install

## raspberry pi
setup: https://hackernoon.com/raspberry-pi-headless-install-462ccabd75d0
wifi: https://howchoo.com/g/ndy1zte2yjn/how-to-set-up-wifi-on-your-raspberry-pi-without-ethernet
find out raspberry ip: arp -a
raspberrypi (192.168.1.33) at b8:27:eb:b7:38:81 on en0 ifscope [ethernet]
ssh pi@192.168.1.33
setup public/private key ssh authentcation: ssh-copy-id pi@192.168.1.33

sudo apt-get update && sudo apt-get upgrade
sudo apt-get install nodejs npm git xvfb snapd --yes
sudo snap install core 
sudo snap install chromium 

sudo npm install -g npm
sudo apt-get remove npm
sudo npm install pm2@latest -g
pm2 startup

pm2 save


git clone https://github.com/timoly/google-cast-launcher.git
npm install

xvfb-run -a --server-args="-screen 0 1280x1024x16 -ac -nolisten tcp" node app.js 