import { defineConfig } from 'tsup'

export default defineConfig(options => {
  if (options.env?.TEST === 'yes') {
    return {
      outDir: 'tmp/tests',
      entry: ['src'],
      external: ['ava'],
      format: ['esm'],
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
