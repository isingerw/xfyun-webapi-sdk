import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'src', 'worklet')

function copyDir(fromDir, toDir){
  if(!fs.existsSync(fromDir)) return
  fs.mkdirSync(toDir, { recursive: true })
  for(const name of fs.readdirSync(fromDir)){
    const src = path.join(fromDir, name)
    const dest = path.join(toDir, name)
    const stat = fs.statSync(src)
    if(stat.isDirectory()){
      copyDir(src, dest)
    }else if(stat.isFile()){
      fs.copyFileSync(src, dest)
    }
  }
}

const targets = [
  path.join(root, 'dist', 'worklet'),
  path.join(root, 'dist', 'vue', 'worklet'),
  path.join(root, 'dist', 'react', 'worklet'),
]

for(const outDir of targets){
  copyDir(srcDir, outDir)
}

console.log('[copy-worklet] copied to:', targets.join(', '))


