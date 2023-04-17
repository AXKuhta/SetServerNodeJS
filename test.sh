json='{"nickname": "aaaa", "password": "bbbb"}'
curl -X POST -H "Content-Type: application/json" -d "$json" http://localhost:3000/user/register | python3 -m json.tool
