process.stdout.write("STDOUT")
process.stderr.write("STDERR")
if(process.argv.indexOf('input') !== -1){
  process.stdin.on('data', function(data){
    process.stdout.write(data.toString())
    process.stdin.end()
  })
}