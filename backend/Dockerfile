# FROM node:10.15.3-jessie

# #==============
# # VNC and Xvfb
# #==============
# RUN apt-get update -y \
#   && apt-get -y install \
#     xvfb \
#   && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# #========================
# # Miscellaneous packages
# # Includes minimal runtime used for executing non GUI Java programs
# #========================
# RUN apt-get update -qqy \
#   && apt-get -qqy --no-install-recommends install \
#     bzip2 \
#     ca-certificates \
#     default-jre \
#     sudo \
#     unzip \
#     wget \
#     libgconf-2-4


# #========================================
# USER root

# #============================================
# # Google Chrome
# #============================================
# # can specify versions by CHROME_VERSION;
# #  e.g. google-chrome-stable=53.0.2785.101-1
# #       google-chrome-beta=53.0.2785.92-1
# #       google-chrome-unstable=54.0.2840.14-1
# #       latest (equivalent to google-chrome-stable)
# #       google-chrome-beta  (pull latest beta)
# #============================================
# ARG CHROME_VERSION="google-chrome-stable"
# RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
#   && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
#   && apt-get update -qqy \
#   && apt-get -qqy install \
#     ${CHROME_VERSION:-google-chrome-stable} \
#   && rm /etc/apt/sources.list.d/google-chrome.list \
#   && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# RUN chmod +x /opt/google/chrome/google-chrome


FROM node:10.15.3-slim@sha256:465b12d4a542a574320957fb794aa2a5232e010a8075bca9fdbac675fa116ecb
    
RUN  apt-get update \
     # Install latest chrome dev package, which installs the necessary libs to
     # make the bundled version of Chromium that Puppeteer installs work.
     && apt-get install -y wget --no-install-recommends \
     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
     && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
     && apt-get update \
     && apt-get install -y google-chrome-unstable --no-install-recommends \
     && rm -rf /var/lib/apt/lists/* \
     && wget --quiet https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh -O /usr/sbin/wait-for-it.sh \
     && chmod +x /usr/sbin/wait-for-it.sh

RUN apt-get update -y \
  && apt-get -y install \
    xvfb \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY build build
COPY .env.docker .env
CMD xvfb-run -a --server-args="-screen 0 1280x1024x16 -ac -nolisten tcp" node build/index.js