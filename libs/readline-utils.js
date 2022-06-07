const { response } = require("express");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (request, defaultResponse, validationCallback) => {
  return new Promise(async (resolve, reject) => {
    if (validationCallback) {
      resolve(
        await validationQ(request, String(defaultResponse), validationCallback)
      );
    } else {
      resolve(await q(request, String(defaultResponse)));
    }
  });
};

const validationQ = (request, defaultResponse, validationCallback) => {
  return new Promise(async (resolve, reject) => {
    let valid = false;
    let response;

    do {
      response = await q(request, defaultResponse);
      if (validationCallback(response)) {
        valid = true;
      } else {
        console.log(`${response} is not valid, please try again...`);
      }
    } while (!valid);

    resolve(response);
  });
};

const q = (request, defaultResponse) => {
  return new Promise((resolve, reject) => {
    rl.question(request, (response) => {
      resolve(response);
    });
    rl.write(defaultResponse);
  });
};

module.exports = { question };
