require("dotenv").config();
const MusicBee = require("./libs/musicbee");
const { createServer } = require("http");
const { Server } = require("socket.io");
const colors = require("colors");
const path = require("path");
const express = require("express");
const open = require("open");
const { question } = require("./libs/readline-utils");

const IO_CORS_IP = process.env.IO_CORS_IP || "http://localhost";
const IO_CORS_PORT = process.env.IO_CORS_PORT || 3001;

const IO_PORT = process.env.IO_PORT || 3001;

const MUSIC_BEE_IP = process.env.MUSIC_BEE_IP || "127.0.0.1";
const MUSIC_BEE_PORT = process.env.MUSIC_BEE_PORT || 3000;

const app = express();

const httpServer = createServer(app);

app.use(
  express.static(path.join(__dirname, "../musicbee-remote-frontend/build"))
);

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname + "../musicbee-remote-frontend/build", "index.html")
  );
});

let state = {
  playerstate: null,
  // playerstatus: {
  //   playerrepeat: null,
  //   playermute: null,
  //   playershuffle: null,
  //   scrobbler: null,
  //   playerstate: null,
  //   playervolume: null,
  // },
  nowplayingposition: {
    current: null,
    total: null,
  },
  nowplayingtrack: {
    artist: null,
    title: null,
    album: null,
    year: null,
    path: null,
  },
};

let playlists = [];
let updatingPlaylists = false;
let playlistPlaying = "-1";
let trackPlaying = -1;
let playlistLength = 0;
let trackAdjust = 1;
let ignoreIndexUpdates = false;

const musicbee = new MusicBee();

// (async () => {
//   const test = await question("What port? \n", 3000, (response) => {
//     if (!isNaN(Number(response))) return true;
//   });

//   console.log("TEST", test);
// })();

const io = new Server(httpServer, {
  cors: {
    origin: `${IO_CORS_IP}:${IO_CORS_PORT}`,
    methods: ["GET", "POST"],
  },
});

httpServer.listen(IO_PORT);

musicbee.connect(MUSIC_BEE_PORT, MUSIC_BEE_IP);

musicbee.on("ready", (data) => {
  // console.log("ready", data);
});

io.on("connect", (socket) => {
  console.log(colors.blue("New Websocket Connection from:", socket.id));

  socket.on("disconnect", (reason) => {
    console.log(colors.red(`${socket.id} websocket disconnected: ${reason}`));
  });

  socket.emit("init", state);
  socket.emit("playlistplaying", playlistPlaying);
  socket.emit("trackplaying", trackPlaying);

  musicbee.nowplayingposition();

  socket.on("playerplay", () => {
    musicbee.playerplay();
  });

  socket.on("playerpause", () => {
    musicbee.playerpause();
  });

  socket.on("playerprevious", () => {
    musicbee.playerprevious();
  });

  socket.on("playernext", () => {
    musicbee.playernext();
  });

  socket.on("playlistlist", () => {
    musicbee.playlistlist();
  });

  socket.on("nowplayinglist", () => {
    musicbee.nowplayinglist();
  });

  socket.on("updateplaylists", () => {
    if (!updatingPlaylists) updatePlaylists();
  });

  socket.on("playerstop", () => {
    musicbee.playerstop();
  });

  socket.on("playlistplay", (data) => {
    ignoreIndexUpdates = false;
    clearTimeout(ignoreIndexUpdatesTimer);
    updatePlaylistPlaying(data);
    updateTrackPlayingByIndex(0);
    musicbee.playlistplay(data);
  });

  socket.on("playlistplaybyindex", ({ url, index }) => {
    updatePlaylistPlaying(url);
    playlistPlayFromIndex(url, index);
  });

  socket.on("playermute", () => {
    musicbee.playermute();
  });

  socket.on("playlistplaysmooth", (data) => {
    ignoreIndexUpdates = false;
    clearTimeout(ignoreIndexUpdatesTimer);
    updatePlaylistPlaying(data);
    updateTrackPlayingByIndex(0);
    playlistPlaySmooth(data);
  });

  socket.on("requestplaylists", () => {
    socket.emit("updateplaylists", playlists);
  });

  socket.on("nowplayingdetails", () => {
    musicbee.nowplayingdetails();
  });
});

musicbee.on("playlistplay", () => {
  musicbee.nowplayinglist();
});

musicbee.on("playerstatus", (data) => {
  state.playerstate = data.playerstate;
  io.emit("playerstate", data.playerstate);
});

musicbee.on("playerstate", (data) => {
  state.playerstate = data;
  io.emit("playerstate", data);
});

musicbee.on("nowplayingposition", (data) => {
  state.nowplayingposition = data;
  io.emit("nowplayingposition", data);
});

musicbee.on("nowplayingtrack", (data) => {
  state.nowplayingtrack = data;
  io.emit("nowplayingtrack", data);
  updateTrackPlaying(1);
});

musicbee.on("playlistlist", (data) => {
  io.emit("playlistlist", data);
});

musicbee.on("nowplayinglist", (data) => {
  playlistLength = data.length;
  io.emit("nowplayinglist", data);
});

musicbee.on("nowplayinglistchanged", () => {
  musicbee.nowplayinglist();
});

musicbee.on("playermute", (data) => {
  io.emit("playermute", data);
});

musicbee.on("playerprevious", () => {
  trackAdjust = -1;
});

const updatePlaylists = async () => {
  updatingPlaylists = true;
  musicbee.playlistlist();

  const playlistlist = await waitForEvent(musicbee, "playlistlist");

  musicbee.playerstop();

  await waitForEvent(musicbee, "playerstop");

  musicbee.playermute();

  const muteState = await waitForEvent(musicbee, "playermute");

  if (!muteState) {
    musicbee.playermutetoggle();
    await waitForEvent(musicbee, "playermute");
  }

  let tempPlaylists = [];

  for (const playlist of playlistlist) {
    if (playlist.url.slice(-7) !== "xautopf") {
      const tracks = await getPlaylistTracks(playlist);
      if (tracks.length > 0) {
        tempPlaylists.push({
          name: playlist.name,
          url: playlist.url,
          tracks,
        });
      }
    }
  }

  if (!muteState) {
    musicbee.playermutetoggle();
    await waitForEvent(musicbee, "playermute");
  }

  playlists = tempPlaylists;

  io.emit("updateplaylists", playlists);
  updatingPlaylists = false;
};

const waitForEvent = (emitter, event) => {
  return new Promise((resolve, reject) => {
    emitter.once(event, (data) => {
      resolve(data);
    });
  });
};

const waitForEventWithinTimeFrame = (emitter, event, time) => {
  return new Promise((resolve, reject) => {
    let timer;

    timer = setTimeout(() => {
      emitter.removeListener(event, resolveEvent);
      resolve(false);
    }, time);

    const resolveEvent = () => {
      clearTimeout(timer);
      resolve(true);
    };

    emitter.addListener(event, resolveEvent);
  });
};

const getPlaylistTracks = (playlist) => {
  return new Promise(async (resolve, reject) => {
    musicbee.playlistplay(playlist.url);
    await waitForEvent(musicbee, "playlistplay");
    musicbee.playerstop();
    let tracksExist = await waitForEventWithinTimeFrame(
      musicbee,
      "nowplayinglistchanged",
      500
    );
    if (tracksExist === false) {
      resolve([]);
    } else {
      await waitForEvent(musicbee, "playerstop");
      musicbee.nowplayinglist();
      const tracks = await waitForEvent(musicbee, "nowplayinglist");
      resolve(tracks);
    }
  });
};

const playlistPlayFromIndex = async (url, index) => {
  ignoreIndexUpdates = false;
  clearTimeout(ignoreIndexUpdatesTimer);
  musicbee.playerstop();

  await waitForEvent(musicbee, "playerstop");

  musicbee.playermute();

  const muteState = await waitForEvent(musicbee, "playermute");

  if (!muteState) {
    musicbee.playermutetoggle();
    await waitForEvent(musicbee, "playermute");
  }

  musicbee.playlistplay(url);

  await waitForEvent(musicbee, "playlistplay");

  musicbee.nowplayinglistplay(index - 1);
  updateTrackPlayingByIndex(index);
  ignoreIndexUpdates = true;
  ignoreIndexUpdatesTimer = setTimeout(setIgnoreIndexUpdatesToFalse, 2000);

  if (!muteState) {
    musicbee.playermutetoggle();
    await waitForEvent(musicbee, "playermute");
  }
};

const playlistPlaySmooth = async (url) => {
  musicbee.playerstop();

  await waitForEvent(musicbee, "playerstop");

  musicbee.playlistplay(url);
};

const updatePlaylistPlaying = (url) => {
  playlistPlaying = playlists.findIndex((playlist) => playlist.url === url);
  io.emit("playlistplaying", playlistPlaying);
};

const updateTrackPlayingByIndex = (index) => {
  if (ignoreIndexUpdates) return;
  trackPlaying = index;
  io.emit("trackplaying", trackPlaying);
};

const setIgnoreIndexUpdatesToFalse = () => {
  ignoreIndexUpdates = false;
};

let ignoreIndexUpdatesTimer = setTimeout(setIgnoreIndexUpdatesToFalse, 2000);

const updateTrackPlaying = () => {
  if (ignoreIndexUpdates) return;

  if (trackPlaying !== 1 || trackAdjust !== -1) {
    trackPlaying = trackPlaying + trackAdjust;
  }

  trackAdjust = 1;
  if (trackPlaying > playlistLength) {
    trackPlaying = 1;
  }
  io.emit("trackplaying", trackPlaying);
};
