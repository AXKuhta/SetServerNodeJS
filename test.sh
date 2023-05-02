function fail() {
	echo "Something errored out, aborting"
	exit
}

function request() {
	curl -s -X POST -H "Content-Type: application/json" -d "$1" "http://localhost:3000$2" || fail
}

# 1. Register a new account
nickname=`date +%s`
json="{\"nickname\": \"$nickname\", \"password\": \"bbbb\"}"
response=`request "$json" "/user/register"`
echo $response | python3 -m json.tool || fail

# 1a. Extract token
token=`echo $response | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])" || fail`
echo "Token: $token"

# 2. Create a room
json="{\"token\": \"$token\"}"
response=`request "$json" "/set/room/create"`
echo $response | python3 -m json.tool || fail

# 2a. Extract room id
room_id=`echo $response | python3 -c "import sys, json; print(json.load(sys.stdin)['gameId'])" || fail`
echo "Room id: $room_id"

# 3. List rooms
json="{\"token\": \"$token\"}"
response=`request "$json" "/set/room/list"`
echo $response | python3 -m json.tool || fail

# 4. Join a room
json="{\"token\": \"$token\", \"gameId\": \"$room_id\"}"
response=`request "$json" "/set/room/enter"`
echo $response | python3 -m json.tool || fail

