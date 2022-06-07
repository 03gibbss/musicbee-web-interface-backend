const EventEmitter = require("events");
const net = require("net");
const ndjson = require("ndjson");

module.exports = class MusicBee extends EventEmitter {
  #client;
  #stream;

  constructor() {
    super();
    this.#client = new net.Socket();
    this.#stream = ndjson.stringify();
    this.#events();
    this.ready = false;
  }

  connect(port, ip) {
    this.#client.connect(port, ip, () => {
      console.log("MusicBee Connected");
      this.#sendMessage("player", "custom");
    });
  }

  #events() {
    this.#stream.on("data", (line) => {
      this.#client.write(line);
    });

    this.#stream.on("error", (err) => {
      console.log("STREAM ERROR", err);
    });

    this.#client.on("data", (res) => {
      try {
        const { context, data } = JSON.parse(res);
        // console.log({ context, data });
        switch (context) {
          case "player":
            this.#sendMessage("protocol", {
              no_broadcast: false,
              protocol_version: 5,
              client_id: "custom_id",
            });
            break;
          case "protocol":
            this.#init();
            break;
          case "playerstatus":
            this.emit("playerstatus", data);
            break;
          case "playerstate":
            this.emit("playerstate", data);
            break;
          case "nowplayingposition":
            this.emit("nowplayingposition", data);
            break;
          case "nowplayingtrack":
            this.emit("nowplayingtrack", data);
            break;
          case "playlistlist":
            this.emit("playlistlist", data);
            break;
          case "playlistplay":
            this.emit("playlistplay", data);
            break;
          case "nowplayinglist":
            this.emit("nowplayinglist", data);
            break;
          case "playerstop":
            this.emit("playerstop", data);
            break;
          case "playermute":
            this.emit("playermute", data);
            break;
          case "playerprevious":
            this.emit("playerprevious");
            break;
          case "nowplayinglistchanged":
            this.emit("nowplayinglistchanged");
            break;
          default:
        }
      } catch (err) {
        console.error(err);
      }
    });

    this.#client.on("close", () => {
      console.log("Connection closed");
    });
  }

  #sendMessage(context, data) {
    this.#stream.write({
      context,
      data,
    });
  }

  #init() {
    this.playerstatus();
    this.nowplayingposition();
    this.nowplayingtrack();
    this.ready = true;
    this.emit("ready", true);
  }

  playlistplay(url) {
    this.#sendMessage("playlistplay", url);
  }

  playlistlist() {
    this.#sendMessage("playlistlist");
  }

  nowplayinglist() {
    this.#sendMessage("nowplayinglist");
  }

  nowplayinglistplay(index) {
    this.#sendMessage("nowplayinglistplay", index);
  }

  playerplay() {
    this.#sendMessage("playerplay");
  }

  playerpause() {
    this.#sendMessage("playerpause");
  }

  nowplayingtrack() {
    this.#sendMessage("nowplayingtrack");
  }

  playerstatus() {
    this.#sendMessage("playerstatus");
  }

  nowplayingposition() {
    this.#sendMessage("nowplayingposition");
  }

  playerprevious() {
    this.#sendMessage("playerprevious");
  }

  playernext() {
    this.#sendMessage("playernext");
  }

  playerstop() {
    this.#sendMessage("playerstop");
  }

  playermutetoggle() {
    this.#sendMessage("playermute", "toggle");
  }

  playermute() {
    this.#sendMessage("playermute");
  }

  browseartists() {
    this.#sendMessage("browseartists", { offset: 1, limit: 1 });
  }

  libraryartistalbums(artist) {
    this.#sendMessage("libraryartistalbums", artist);
  }

  libraryalbumtracks() {
    this.#sendMessage("libraryalbumtracks");
  }

  librarygenreartists() {
    this.#sendMessage("librarygenreartists");
  }

  nowplayingdetails() {
    this.#sendMessage("nowplayingdetails");
  }
};
