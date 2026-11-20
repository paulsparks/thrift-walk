extends Node
## Browser requests use HttpOnly cookies via fetch. Native cookies live only in RAM.
signal session_ended
signal account_changed
var user: Dictionary = {}
var generation := 0
var cookies: Dictionary = {}
var base_url := "http://localhost:3000"
var signout_pending := false
var _bridge: JavaScriptObject


class WebRequest:
	extends RefCounted
	signal completed
	var response: Dictionary = {}
	var callback: JavaScriptObject

	func receive(args: Array) -> void:
		response = {"status": args[0] as int, "data": Api._parse_json(str(args[1]))}
		completed.emit()


func _ready() -> void:
	var configured := OS.get_environment("THRIFT_API_URL")
	if not configured.is_empty():
		base_url = configured.trim_suffix("/")
	if OS.has_feature("web"):
		base_url = str(JavaScriptBridge.eval("window.location.origin"))
		(
			JavaScriptBridge
			. eval(
				"""
		window.thriftApi = {request: async function(path, method, body, cb) {
			try {
				const r = await fetch(path, {method, credentials:'same-origin', cache:'no-store',
					headers:{'Content-Type':'application/json'}, body: method==='GET'?undefined:body,
					signal:AbortSignal.timeout(12000)});
				cb(r.status, await r.text());
			} catch (_) { cb(0, '{"message":"Connection failed. Retry."}'); }
		}};
		""",
				true
			)
		)
		_bridge = JavaScriptBridge.get_interface("thriftApi")


func request(
	path: String, method: String = "GET", body: Dictionary = {}, server: bool = false
) -> Dictionary:
	if (
		not base_url.begins_with("https://")
		and not base_url.begins_with("http://localhost:")
		and not base_url.begins_with("http://127.0.0.1:")
		and not (
			server
			and Server.is_dedicated()
			and base_url.begins_with("http://")
			and OS.get_environment("THRIFT_ALLOW_INTERNAL_HTTP") == "true"
		)
	):
		return {"status": 0, "data": {"message": "HTTPS is required outside local development."}}
	var epoch := generation
	var result: Dictionary
	if OS.has_feature("web"):
		var pending := WebRequest.new()
		pending.callback = JavaScriptBridge.create_callback(pending.receive)
		_bridge.call("request", path, method, JSON.stringify(body), pending.callback)
		await pending.completed
		result = pending.response
	else:
		var http := HTTPRequest.new()
		http.timeout = 12.0
		http.max_redirects = 0
		http.body_size_limit = 8 * 1024 * 1024
		add_child(http)
		var headers := PackedStringArray(["Content-Type: application/json", "Origin: " + base_url])
		if server:
			headers.append("Authorization: Bearer " + OS.get_environment("GAME_SERVER_SECRET"))
		else:
			headers.append_array(cookie_headers())
		var verb := HTTPClient.METHOD_GET
		if method == "POST":
			verb = HTTPClient.METHOD_POST
		if method == "DELETE":
			verb = HTTPClient.METHOD_DELETE
		var err := http.request(
			base_url + path, headers, verb, "" if method == "GET" else JSON.stringify(body)
		)
		if err != OK:
			http.queue_free()
			return {"status": 0, "data": {"message": "Connection failed. Retry."}}
		var response: Array = await http.request_completed
		http.queue_free()
		if epoch != generation and not server:
			return {"status": 0, "data": {"message": "Session changed."}}
		if not server:
			for header: String in response[2]:
				if header.to_lower().begins_with("set-cookie:"):
					var pair := header.substr(11).strip_edges().split(";", true, 1)[0].split(
						"=", true, 1
					)
					if pair.size() == 2:
						if pair[1].is_empty():
							cookies.erase(pair[0])
						else:
							cookies[pair[0]] = pair[1]
		var bytes: PackedByteArray = response[3]
		result = {
			"status":
			(response[1] as int) if (response[0] as int) == HTTPRequest.RESULT_SUCCESS else 0,
			"data": _parse_json(bytes.get_string_from_utf8())
		}
	if epoch != generation and not server:
		return {"status": 0, "data": {"message": "Session changed."}}
	if not result.get("data") is Dictionary:
		result["data"] = {"message": "Service unavailable. Retry."}
	if not server and (result.data as Dictionary).has("accountId"):
		if not accept_account(str(result.data.accountId)):
			return _account_changed_result()
	if (result.status as int) == 401 and path.begins_with("/api/market/") and not server:
		user.clear()
		session_ended.emit()
	return result


func cookie_headers() -> PackedStringArray:
	if OS.has_feature("web") or cookies.is_empty():
		return PackedStringArray()
	var pairs := PackedStringArray()
	for key: String in cookies:
		pairs.append(key + "=" + str(cookies[key]))
	return PackedStringArray(["Cookie: " + "; ".join(pairs)])


func validate() -> Dictionary:
	var result := await request("/api/market/session")
	if (result.status as int) == 200:
		if not accept_account(str(result.data.user.id)):
			return _account_changed_result()
		user = result.data.user
	return result


func accept_account(account_id: String) -> bool:
	var expected := (
		Server.account_id if not Server.account_id.is_empty() else str(user.get("id", ""))
	)
	if expected.is_empty() or expected == account_id:
		return true
	# Browser cookies can change in another tab without revoking the world's session.
	# Invalidate outstanding requests before any data from the new account is used.
	generation += 1
	user.clear()
	account_changed.emit()
	return false


func _account_changed_result() -> Dictionary:
	return {
		"status": 409,
		"data": {"code": "ACCOUNT_CHANGED", "message": "Account changed. Reconnect to the market."}
	}


func clear() -> void:
	generation += 1
	user.clear()
	cookies.clear()


func request_id() -> String:
	return Crypto.new().generate_random_bytes(16).hex_encode()


func message(result: Dictionary) -> String:
	return str((result.get("data", {}) as Dictionary).get("message", "Connection failed. Retry."))


func open_browser(path: String) -> void:
	InputMode.release_for_focus_change()
	var url := base_url + path if path.begins_with("/") else path
	if OS.has_feature("web"):
		JavaScriptBridge.eval(
			"window.open(%s, '_blank', 'noopener,noreferrer')" % JSON.stringify(url)
		)
	else:
		OS.shell_open(url)


func _parse_json(value: String) -> Dictionary:
	var parser := JSON.new()
	if parser.parse(value) == OK and parser.data is Dictionary:
		return parser.data as Dictionary
	return {"message": "Service unavailable. Retry."}
