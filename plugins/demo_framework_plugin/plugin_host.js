const path = require('path')

const routes = {
	'HelloService.say': (args = []) => {
		return { message: `Hello from demo plugin! args=${JSON.stringify(args)}` }
	},
	'Control.stop': () => {
		process.send && process.send({ type: 'stopped' })
		process.exit(0)
	}
}

process.on('message', async (msg) => {
	try {
		const { jsFile, call, ...rest } = msg || {}
		const key = `${call?.class}.${call?.method}`
		let result
		if (routes[key]) {
			result = await routes[key](call?.args)
		} else if (jsFile) {
			const target = path.join(__dirname, jsFile)
			const handler = require(target)
			result = await (handler.main ? handler.main(rest) : handler(rest))
		}
		process.send && process.send(result)
	} catch (e) {
		process.send && process.send({ error: e?.message || String(e) })
	}
}) 