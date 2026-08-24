/**
 * smoke.tsx ni yig'ib, har bir rol uchun alohida jarayonda ishga tushiradi.
 *
 * `react-dom/server` do'kon holatini birinchi renderda muzlatib qo'yadi,
 * shuning uchun har bir rol o'z jarayonida sinaladi.
 */
import { build } from 'esbuild'
import { spawn } from 'node:child_process'

const out = 'scripts/.smoke.mjs'

await build({
  entryPoints: ['scripts/smoke.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  outfile: out,
  external: ['xlsx'],
  loader: { '.css': 'empty' },
  logLevel: 'warning',
  // react-dom/server node modullarini `require` orqali chaqiradi
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
})

const run = (phase) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [out], {
      // React SSR ogohlantirishlari (useLayoutEffect va h.k.) natijani to'sib qo'ymasin
      stdio: ['ignore', 'inherit', 'ignore'],
      env: { ...process.env, SMOKE: phase },
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })

let failed = 0
for (const phase of ['public', 'cabinet', 'admin', 'zavuch']) {
  const code = await run(phase)
  if (code !== 0) failed++
  console.log('')
}

console.log(failed === 0 ? '✓ Barcha sahifalar xatosiz chizildi' : `✗ ${failed} ta bosqichda xato`)
process.exit(failed === 0 ? 0 : 1)
