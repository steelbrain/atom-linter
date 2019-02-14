process.stdout.write("STDOUT");

function echo(data) {
  process.stdout.write(data.toString());
  process.stdin.end();
}

if (process.argv.indexOf("input") !== -1) {
  process.stdin.on("data", echo);
}
