import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
	root: __dirname,
	base: '',
	resolve: {
		alias: {
			vue: 'vue/dist/vue.esm-bundler.js'
		}
	},
	define: {
		__VUE_OPTIONS_API__: true,
		__VUE_PROD_DEVTOOLS__: false,
		__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
	},
	build: {
		outDir: resolve(__dirname, '../dist'),
		emptyOutDir: true
	},
	server: {
		host: '127.0.0.1',
		port: 5174
	}
}) 