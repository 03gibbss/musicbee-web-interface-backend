require("dotenv").config();
const MusicBee = require("./libs/musicbee");
const { createServer } = require("http");
const { Server } = require("socket.io");
const colors = require("colors");

const MUSIC_BEE_IP = process.env.MUSIC_BEE_IP || "127.0.0.1";
const MUSIC_BEE_PORT = process.env.MUSIC_BEE_PORT || 3002;

const IO_CORS_IP = process.env.IO_CORS_IP || "http://localhost";
const IO_CORS_PORT = process.env.IO_CORS_PORT || 3000;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: `${IO_CORS_IP}:${IO_CORS_PORT}`,
    methods: ["GET", "POST"],
  },
});

httpServer.listen(3005);

let state = {
  playerstate: null,
  //   playerstatus: {
  //     playerrepeat: null,
  //     playermute: null,
  //     playershuffle: null,
  //     scrobbler: null,
  //     playerstate: null,
  //     playervolume: null,
  //   },
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

const musicbee = new MusicBee();

musicbee.connect(MUSIC_BEE_PORT, MUSIC_BEE_IP);

musicbee.on("ready", (data) => {
  console.log("ready", data);
});

io.on("connect", (socket) => {
  console.log(colors.blue("New Websocket Connection from:", socket.id));

  socket.on("disconnect", (reason) => {
    console.log(colors.red(`${socket.id} websocket disconnected: ${reason}`));
  });

  socket.emit("init", state);

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
});
