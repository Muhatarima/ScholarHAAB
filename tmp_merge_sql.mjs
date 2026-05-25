import fs from 'fs'
import path from 'path'

const sqlDir = path.resolve('docs', 'sql')
const files = fs.readdirSync(sqlDir)
  .filter(f => f.endsWith('.sql') && !f.startsWith('999_'))
  .sort()

let merged = ''
for (const f of files) {
  merged += '-- ======= FILE: ' + f + ' =======\n'
  merged += fs.readFileSync(path.join(sqlDir, f), 'utf8')
  merged += '\n\n'
}

fs.writeFileSync(path.join(sqlDir, '999_master_setup.sql'), merged)
console.log('Merged successfully into 999_master_setup.sql')
