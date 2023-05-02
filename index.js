const hashing = require("bigint-hash")
const express = require("express")
const path = require("path")
const fs = require("fs")
const app = express()

// ============================================================================
// General functions
// ============================================================================

// Unified error message JSON
function err(message) {
	return {
		success: false,
		exception: { message }
	}
}

function hash(str) {
	return "" + hashing.hashAsBigInt(hashing.HashType.SHA256, Buffer.from("setserver_salt" + str))
}

// Full 81 card set
// count
// color
// shape
// fill
function full_set() {
	const values = [1, 2, 3]
	const cards = []

	for (let count of values) {
		for (let color of values) {
			for (let shape of values) {
				for (let fill of values) {
					cards.push( { count, color, shape, fill } )
				}
			}
		}
	}

	return cards
}

function shuffle(arr) {
	const sh_arr = [].concat(arr)
	const random_sort_fn = function(a, b) {
		return 2*Math.random() - 1
	}

	sh_arr.sort(random_sort_fn)

	return sh_arr
}

function all_different_or_equal(a, b, c) {
	const diff = (a != b) + (a != c) + (b != c)

	return diff == 0 || diff == 3
}

function is_a_set(a, b, c) {
	return	all_different_or_equal(a.count, b.count, c.count) &&
		all_different_or_equal(a.color, b.color, c.color) &&
		all_different_or_equal(a.shape, b.shape, c.shape) &&
		all_different_or_equal(a.fill, b.fill, c.fill)
}

function set_detect(cards) {
	const sets = []
	const sublevel = [].concat(cards)

	for (let k1 in sublevel) {
		const a = sublevel[k1]

		delete sublevel[k1]

		const sublevel2 = [].concat(sublevel)

		for (let k2 in sublevel2) {
			const b = sublevel2[k2]

			delete sublevel2[k2]

			for (let k3 in sublevel2) {
				const c = sublevel2[k3]

				if (is_a_set(a, b, c))
					sets.push([+k1, +k2, +k3])
			}
		}
	}

	return sets
}

// ============================================================================
// State + associated functions
// ============================================================================

// Ephemeral state
let rooms = []

// Persistent state
let users = {}
let nicknames = {}

const data_dir = "/tmp/setserver/"

// Load state from disk
function load_state() {
	if (fs.existsSync(data_dir) === false) {
		console.log("First run! Creating /tmp/setserver to store user accounts")
		return fs.mkdirSync("/tmp/setserver/")
	} else {
		console.log("Loading saved state from " + data_dir)
	}

	const entries = fs.readdirSync(data_dir)

	for (let token of entries) {
		const user = JSON.parse(fs.readFileSync(data_dir + token))
		nicknames[user.nickname] = token
		users[token] = user
	}
}

// Save state to disk
function save_state() {
	for (let token in users) {
		const user = users[token]

		if (user.saved > user.modified)
			continue

		fs.writeFileSync(data_dir + token, JSON.stringify(user))

		user.saved = Date.now()
	}
}

// ============================================================================
// Execution starts here
// ============================================================================

load_state()

// JSON parser + parser error catcher
const json_parser = express.json()
const error_catch = function(error, request, response, next) {
	if (error instanceof SyntaxError) {
		response.json(err("Malformed JSON"))
	} else next()
}

// Must be run before any routing is declared
app.use(json_parser)
app.use(error_catch)

// ============================================================================
// API endpoints
// ============================================================================

function register_fn(request, response) {
	const nickname = request.body.nickname || null
	const password = request.body.password || null

	if (nickname === null) return response.json(err("Nickname missing"))
	if (password === null) return response.json(err("Password missing"))
	if (nickname in nicknames) return response.json(err("Nickname taken"))

	const accessToken = hash(Math.random())

	if (accessToken in users) return response.json(err("Internal server error"))

	nicknames[nickname] = accessToken
	users[accessToken] = {
		saved: 0,
		modified: Date.now(),
		nickname: nickname,
		password: hash(password)
	}

	save_state()

	const result = {
		nickname,
		accessToken
	}

	response.json(result)
}

function room_create_fn(request, response) {
	const token = request.body.token || null

	if (token === null) return response.json(err("Token missing"))
	if (token in users === false) return response.json(err("Invalid token"))

	const room = {
		created: Date.now(),
		players: {},
		cards: shuffle(full_set()),
		cards_visible: 12
	}

	const room_id = rooms.push(room) - 1
	const result = {
		gameId: room_id
	}

	response.json(result)
}

function room_list_fn(request, response) {
	const token = request.body.token || null

	if (token === null) return response.json(err("Token missing"))
	if (token in users === false) return response.json(err("Invalid token"))

	const result = {
		games: rooms.map(function(x, k) { return { id: k, users: Object.keys(x.players) } })
	}

	response.json(result)
}

function room_enter_fn(request, response) {
	const token = request.body.token || null
	const room_id = request.body.gameId || null

	if (token === null) return response.json(err("Token missing"))
	if (room_id === null) return response.json(err("Game id missing"))
	if (token in users === false) return response.json(err("Invalid token"))
	if (room_id in rooms === false) return response.json(err("Invalid game id"))

	const user = users[token]
	const room = rooms[room_id]

	if (user.nickname in room.players) return response.json(err("Already a player in this game"))

	room.players[user.nickname] = {
		score: 0
	}

	const result = {
		gameId: room_id
	}

	response.json(result)
}

function room_field_fn(request, response) {
	const token = request.body.token || null
	const room_id = request.body.gameId || null

	if (token === null) return response.json(err("Token missing"))
	if (room_id === null) return response.json(err("Game id missing"))
	if (token in users === false) return response.json(err("Invalid token"))
	if (room_id in rooms === false) return response.json(err("Invalid game id"))

	const user = users[token]
	const room = rooms[room_id]

	if (user.nickname in room.players === false) return response.json(err("Not a player in this game"))

	const result = {
		players: room.players,
		cards: room.cards.slice(0, room.cards_visible),
		cards_visible: room.cards_visible,
		cards_remain: room.cards.length
	}

	response.json(result)
}

function room_debug_fn(request, response) {
	const token = request.body.token || null
	const room_id = request.body.gameId || null

	if (token === null) return response.json(err("Token missing"))
	if (room_id === null) return response.json(err("Game id missing"))
	if (token in users === false) return response.json(err("Invalid token"))
	if (room_id in rooms === false) return response.json(err("Invalid game id"))

	const user = users[token]
	const room = rooms[room_id]

	if (user.nickname in room.players === false) return response.json(err("Not a player in this game"))

	const result = {
		sets: set_detect(room.cards.slice(0, room.cards_visible))
	}

	response.json(result)
}

app.post("/user/register", register_fn)
app.post("/set/room/create", room_create_fn)
app.post("/set/room/list", room_list_fn)
app.post("/set/room/enter", room_enter_fn)
app.post("/set/room/field", room_field_fn)
app.post("/set/room/debug", room_debug_fn)

// Standalone web server mode
app.listen(3000)

// Nginx mode
// chmod a+rw /tmp/setserver.sock
//app.listen("/tmp/setserver.sock", () => {
//	console.log("Now listening on /tmp/setserver.sock")
//})

