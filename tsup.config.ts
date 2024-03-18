import { defineConfig } from 'tsup'

export default defineConfig(options => {
  if (options.env?.TEST === 'yes') {
    return {
      outDir: 'tmp/tests',
      entry: ['src', "!src/tests/_server/static/**/*"],
      external: ['ava', 'express', 'multer', 'node:url', 'node:path', 'node:fs'],
      format: ['esm'],
      publicDir: 'src/tests/_server/static'
    }
  } else {
    return {
      minify: options.watch !== true,
      clean: true,
      dts: true,
      format: ['esm', 'cjs'],
      sourcemap: options.watch === true,
      entry: ['src/main.ts'],
    }
  }
})
