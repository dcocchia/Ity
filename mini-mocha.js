#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

global.describe = function(desc, fn) {
  console.log(desc);
  fn();
};

global.it = async function(desc, fn) {
  try {
    await fn();
    console.log('  \u2714', desc);
  } catch (e) {
    console.error('  \u2716', desc);
    console.error(e);
    process.exitCode = 1;
  }
};

const files = process.argv.slice(2);
files.forEach(file => {
  require(path.resolve(file));
});
