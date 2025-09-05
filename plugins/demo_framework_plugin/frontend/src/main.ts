import { createApp, ref, onMounted } from 'vue'

let seq = 0

const App = {
	setup() {
		const output = ref<string>('')
		const counter = ref<number>(0)
		let pendingId: number | undefined

		onMounted(() => {
			window.addEventListener('message', (event) => {
				const data = event.data || {}
				if (data && data.source === 'host' && data.id === pendingId) {
					pendingId = undefined
					output.value = data.success ? JSON.stringify(data.result) : `Error: ${data.error}`
				}
			})
		})

		async function sayHello() {
			const id = ++seq
			pendingId = id
			window.parent.postMessage({
				source: 'plugin-frontend',
				action: 'trigger-event',
				id,
				payload: { eventType: 'hello', params: { args: ['from-frontend'] } }
			}, '*')
		}

		function inc() {
			counter.value++
		}

		async function readText() {
			const selectId = ++seq
			const filePath: string | undefined = await new Promise((resolve) => {
				const onMsg = (event: MessageEvent) => {
					const data = (event.data || {}) as any
					if (data && data.source === 'host' && data.id === selectId) {
						window.removeEventListener('message', onMsg)
						resolve(data.success ? data.result : undefined)
					}
				}
				window.addEventListener('message', onMsg)
				window.parent.postMessage({
					source: 'plugin-frontend',
					action: 'ipc-invoke',
					id: selectId,
					payload: { channel: 'select-file', args: [] }
				}, '*')
			})
			if (!filePath) return

			const id = ++seq
			pendingId = id
			window.parent.postMessage({
				source: 'plugin-frontend',
				action: 'trigger-event',
				id,
				payload: { eventType: 'read-text', params: { path: filePath } }
			}, '*')
		}

		return { output, counter, sayHello, inc, readText }
	},
	template: `
		<div style="padding:16px;font-family:system-ui,Segoe UI,Arial">
			<h2 style="color:#42b983">Demo Framework Plugin (Vue)</h2>
			<div style="margin-bottom:12px">
				<button style="padding:6px 12px" @click="sayHello">调用 hello 事件</button>
				<button style="padding:6px 12px;margin-left:8px" @click="readText">读取 txt 文件</button>
			</div>
			<div style="margin-bottom:12px">
				<button style="padding:6px 12px" @click="inc">本地计数器：{{ counter }}</button>
			</div>
			<pre style="margin-top:12px;white-space:pre-wrap;background:#111;color:#0f0;padding:8px;border-radius:4px;">{{ output }}</pre>
		</div>
	`
}

createApp(App).mount('#app')
