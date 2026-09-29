const assert = require('node:assert/strict')

async function main() {
  const { default: config } = await import('../next.config.mjs')
  const { PHASE_DEVELOPMENT_SERVER: dev, PHASE_PRODUCTION_BUILD: build, PHASE_PRODUCTION_SERVER: start } = require('next/constants')
  const original = process.env.LIVSKRAFT_QA
  try {
    delete process.env.LIVSKRAFT_QA
    const liveDev = config(dev).distDir
    const production = config(build).distDir
    assert.equal(config(start).distDir, production)
    process.env.LIVSKRAFT_QA = '1'
    const qaDev = config(dev).distDir
    const qaBuild = config(build).distDir
    assert.equal(config(start).distDir, qaBuild)
    const dirs = [liveDev, production, qaDev, qaBuild]
    assert.equal(new Set(dirs).size, 4)
    for (const dir of dirs) {
      assert(/^\.next(?:-[a-z-]+)?$/.test(dir), 'Outputs must be sibling workspace folders')
      assert(require('node:fs').readFileSync('.gitignore', 'utf8').includes(`/${dir}/`))
    }
    console.log('PASS live dev, production, QA dev and QA build outputs are isolated; build/start agree')
  } finally {
    if (original === undefined) delete process.env.LIVSKRAFT_QA
    else process.env.LIVSKRAFT_QA = original
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
