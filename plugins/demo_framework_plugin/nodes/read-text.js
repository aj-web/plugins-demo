const fs = require('fs')

exports.main = async function(params = {}) {
	const p = params.path
	if (!p) {
		return { ok: false, error: 'path is required' }
	}
	try {
		const content = fs.readFileSync(p, 'utf-8')
		return { ok: true, path: p, content }
	} catch (e) {
		return { ok: false, error: e?.message || String(e) }
	}
} 