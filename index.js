const hashing = require("bigint-hash")
const express = require("express")
const path = require("path")
const fs = require("fs")
const app = express()

function hash(str) {
	return "" + hashing.hashAsBigInt(hashing.HashType.SHA256, Buffer.from("setserver_salt" + str))
}

// State
let users = {}
let rooms = {}
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

// Unified error message JSON
function err(message) {
	return {
		success: false,
		exception: { message }
	}
}

// JSON parser + parser error catcher
const json_parser = express.json()
const error_catch = function(error, request, response, next) {
	if (error instanceof SyntaxError) {
		response.json(err("Malformed JSON"))
	} else next()
}

// Execution starts here
load_state()

// Must be run before any routing is declared
app.use(json_parser)
app.use(error_catch)

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

app.post("/user/register", register_fn)

// Standalone web server mode
app.listen(3000)

// Nginx mode
// chmod a+rw /tmp/setserver.sock
//app.listen("/tmp/setserver.sock", () => {
//	console.log("Now listening on /tmp/setserver.sock")
//})

