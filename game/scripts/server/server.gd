extends Node
signal connection_error(message: String)
signal entered_world
signal placement_result(result: Dictionary)
const PORT := 8080
const PLAYER_SCENE := preload("res://scenes/objects/player/player.tscn")
const PLAYER_NODE_PREFIX := "Player_"


class PlayerSpawn:
	var peer_id: int
	var position: Vector3
	var display_name: String


var account_id := ""
var _players: Dictionary[int, PlayerController] = {}
var _pending_spawns: Array[PlayerSpawn] = []
var _identities: Dictionary = {}
var _connected_at: Dictionary = {}
var _admitting: Dictionary = {}
var _commands: Dictionary = {}
var _validated_commands: Dictionary = {}
var _ticket := ""
var _validating: Dictionary = {}
var _next_check := 0
var _attempt := 0
var _world_ready := false


func _ready() -> void:
	multiplayer.connected_to_server.connect(_on_connected)
	multiplayer.connection_failed.connect(_failed)
	multiplayer.server_disconnected.connect(_failed)
	multiplayer.peer_connected.connect(_peer_connected)
	multiplayer.peer_disconnected.connect(_peer_disconnected)
	if OS.has_feature("dedicated_server") or "--server" in OS.get_cmdline_user_args():
		_start_server.call_deferred()


func is_dedicated() -> bool:
	return OS.has_feature("dedicated_server") or "--server" in OS.get_cmdline_user_args()


func _start_server() -> void:
	if OS.get_environment("GAME_SERVER_SECRET").length() < 32:
		push_error(
			"Set GAME_SERVER_SECRET (at least 32 characters) on both backend and game server."
		)
		get_tree().quit(1)
		return
	get_tree().change_scene_to_file("res://scenes/maps/demo_store.tscn")
	await get_tree().process_frame
	var peer := WebSocketMultiplayerPeer.new()
	if (
		peer.create_server(
			(
				int(OS.get_environment("GAME_PORT"))
				if not OS.get_environment("GAME_PORT").is_empty()
				else PORT
			)
		)
		!= OK
	):
		get_tree().quit(1)
		return
	multiplayer.multiplayer_peer = peer
	_world_ready = true


func connect_game() -> void:
	disconnect_game()
	var attempt := _attempt
	InputMode.set_mode(InputMode.Mode.CONNECTING)
	var result := await Api.request("/api/market/ticket", "POST")
	if attempt != _attempt:
		return
	if (result.status as int) != 200:
		connection_error.emit(Api.message(result))
		return
	_ticket = str(result.data.ticket)
	var url := OS.get_environment("THRIFT_GAME_URL")
	if url.is_empty():
		url = "ws://localhost:8080"
		if OS.has_feature("web"):
			url = str(
				(
					JavaScriptBridge
					. eval(
						"window.THRIFT_GAME_URL || ((location.protocol==='https:'?'wss://':'ws://')+location.host+'/game-socket')"
					)
				)
			)
	if (
		not url.begins_with("wss://")
		and not url.begins_with("ws://localhost:")
		and not url.begins_with("ws://127.0.0.1:")
	):
		connection_error.emit("A secure WSS connection is required.")
		return
	var peer := WebSocketMultiplayerPeer.new()
	if peer.create_client(url) != OK:
		_failed()
		return
	multiplayer.multiplayer_peer = peer
	await get_tree().create_timer(20).timeout
	if attempt == _attempt and not _world_ready:
		_failed()


func disconnect_game() -> void:
	_attempt += 1
	account_id = ""
	_world_ready = false
	_ticket = ""
	_pending_spawns.clear()
	if multiplayer.has_multiplayer_peer():
		multiplayer.multiplayer_peer.close()
	multiplayer.multiplayer_peer = null


func _failed() -> void:
	disconnect_game()
	connection_error.emit("Could not connect to the market. Retry or return to login.")


func _on_connected() -> void:
	_admit.rpc_id(1, _ticket)
	_ticket = ""


func _peer_connected(id: int) -> void:
	if multiplayer.is_server():
		_connected_at[id] = Time.get_ticks_msec()


func _peer_disconnected(id: int) -> void:
	if not multiplayer.is_server():
		return
	_identities.erase(id)
	_connected_at.erase(id)
	_admitting.erase(id)
	_commands.erase(id)
	_validated_commands.erase(id)
	_despawn_player_local(id)
	for other: int in _identities:
		if admitted(other):
			_despawn_player.rpc_id(other, id)


func admitted(id: int) -> bool:
	if not _identities.has(id) or Time.get_ticks_msec() - (_identities[id].checked as int) >= 30000:
		return false
	if not multiplayer.has_multiplayer_peer() or not id in multiplayer.get_peers():
		return false
	var transport := multiplayer.multiplayer_peer as WebSocketMultiplayerPeer
	return (
		transport != null and transport.get_peer(id).get_ready_state() == WebSocketPeer.STATE_OPEN
	)


func sync_player(id: int, state: Dictionary) -> void:
	for other: int in _identities:
		if admitted(other) and (_identities[other].ready as bool):
			_player_state.rpc_id(other, id, state)


@rpc("authority", "unreliable_ordered")
func _player_state(id: int, state: Dictionary) -> void:
	# Snapshots may race reliable spawn/despawn messages. The autoload always
	# exists, so an early/late snapshot can safely be discarded without node RPC errors.
	if not _world_ready:
		return
	var world := get_tree().current_scene
	if world == null or world.name != "DemoStore":
		return
	var player := (
		world.get_node_or_null(NodePath("%s%s" % [PLAYER_NODE_PREFIX, id])) as PlayerController
	)
	if player == null:
		return
	player._sync_state(
		state.position as Vector3,
		state.velocity as Vector3,
		state.yaw as float,
		state.pitch as float,
		state.on_floor as bool,
		state.sequence as int
	)


@rpc("any_peer", "reliable")
func _admit(ticket: String) -> void:
	if not multiplayer.is_server():
		return
	var id := multiplayer.get_remote_sender_id()
	if _admitting.has(id) or _identities.has(id) or not _connected_at.has(id):
		return
	if ticket.length() != 64:
		multiplayer.multiplayer_peer.disconnect_peer(id)
		return
	_admitting[id] = true
	var connected: int = _connected_at[id]
	var result := await Api.request(
		"/api/market/server/redeem", "POST", {"ticket": ticket, "worldId": "demo_store"}, true
	)
	if not _connected_at.has(id) or (_connected_at[id] as int) != connected:
		return
	if (result.status as int) != 200:
		multiplayer.multiplayer_peer.disconnect_peer(id)
		return
	var user_id := str(result.data.userId)
	# No await between checking and recording identity: simultaneous redemptions
	# are serialized here, including peers which have not announced readiness yet.
	for other: int in _identities:
		if str(_identities[other].userId) == user_id:
			(
				_admission_rejected
				. rpc_id(
					id,
					"You are already in the market in another tab or window. Close it before joining here."
				)
			)
			await get_tree().create_timer(0.5).timeout
			if id in multiplayer.get_peers():
				multiplayer.multiplayer_peer.disconnect_peer(id)
			return
	_identities[id] = {
		"sessionId": result.data.sessionId,
		"userId": user_id,
		"name":
		(
			str((result.data as Dictionary).get("name", "Visitor"))
			. replace("\n", " ")
			. replace("\r", " ")
			. left(80)
		),
		"checked": Time.get_ticks_msec(),
		"ready": false
	}
	_admission_accepted.rpc_id(id, user_id)


@rpc("authority", "reliable")
func _admission_rejected(message: String) -> void:
	disconnect_game()
	connection_error.emit(message)


@rpc("authority", "reliable")
func _admission_accepted(user_id: String) -> void:
	if not Api.accept_account(user_id):
		return
	account_id = user_id
	var attempt := _attempt
	get_tree().change_scene_to_file("res://scenes/maps/demo_store.tscn")
	await get_tree().process_frame
	var result := await Api.request("/api/market/world")
	if attempt != _attempt:
		return
	if (result.status as int) != 200:
		_failed()
		return
	Market.apply_snapshot(result.data as Dictionary)
	_world_ready = true
	_client_ready.rpc_id(1)


@rpc("any_peer", "reliable")
func _client_ready() -> void:
	if not multiplayer.is_server():
		return
	var id := multiplayer.get_remote_sender_id()
	if not admitted(id) or (_identities[id].ready as bool):
		return
	_identities[id].ready = true
	for peer_id in _players:
		_spawn_player.rpc_id(
			id, peer_id, _players[peer_id].global_position, _players[peer_id].display_name
		)
	var spawn := Vector3(
		float(_players.size() % 5) * 1.2 - 2.4, 1, floorf(float(_players.size()) / 5.0) * 1.2
	)
	_spawn_player_local(id, spawn, str(_identities[id].name))
	for other: int in _identities:
		if admitted(other) and (_identities[other].ready as bool):
			_spawn_player.rpc_id(other, id, spawn, str(_identities[id].name))
	_entered.rpc_id(id)


@rpc("authority", "reliable")
func _entered() -> void:
	InputMode.set_mode(InputMode.Mode.PLAYING)
	entered_world.emit()


func _process(_delta: float) -> void:
	if not is_dedicated() or not multiplayer.has_multiplayer_peer():
		return
	for id: int in _connected_at.keys():
		if not _identities.has(id) and Time.get_ticks_msec() - (_connected_at[id] as int) > 15000:
			multiplayer.multiplayer_peer.disconnect_peer(id)
	if Time.get_ticks_msec() >= _next_check:
		_revalidate()


func _revalidate() -> void:
	_next_check = Time.get_ticks_msec() + 15000
	for id: int in _identities.keys():
		if not _validating.has(id):
			_validate_peer(id)


func _validate_peer(id: int) -> void:
	_validating[id] = true
	var sid: String = _identities[id].sessionId
	var result := await Api.request("/api/market/server/validate", "POST", {"sessionId": sid}, true)
	_validating.erase(id)
	if not _identities.has(id) or str(_identities[id].sessionId) != sid:
		return
	if (result.status as int) == 200:
		_identities[id].checked = Time.get_ticks_msec()
	else:
		_identities[id].checked = -30000
		_session_failed.rpc_id(id, (result.status as int) == 401)
		multiplayer.multiplayer_peer.disconnect_peer(id)


@rpc("authority", "reliable")
func _session_failed(expired: bool) -> void:
	if expired:
		Api.session_ended.emit()
	else:
		connection_error.emit("Session validation is unavailable. Retry to reconnect.")


func submit_placement(command: Dictionary) -> void:
	_command.rpc_id(1, command)


@rpc("any_peer", "reliable")
func _command(command: Dictionary) -> void:
	if not multiplayer.is_server():
		return
	var id := multiplayer.get_remote_sender_id()
	if not admitted(id) or not _players.has(id) or _commands.has(id):
		return
	_commands[id] = true
	var sid: String = _identities[id].sessionId
	var op := str(command.get("op", ""))
	var payload := {
		"sessionId": sid, "requestId": command.get("requestId"), "itemId": command.get("itemId")
	}
	var previous: Dictionary = _validated_commands.get(id, {})
	if previous.get("command") == command:
		payload = previous.payload as Dictionary
	elif op == "place":
		if (
			typeof(command.get("x")) not in [TYPE_FLOAT, TYPE_INT]
			or typeof(command.get("y")) not in [TYPE_FLOAT, TYPE_INT]
			or typeof(command.get("z", -1.94)) not in [TYPE_FLOAT, TYPE_INT]
			or typeof(command.get("yaw", 0.0)) not in [TYPE_FLOAT, TYPE_INT]
		):
			_command_result.rpc_id(
				id,
				{
					"requestId": command.get("requestId"),
					"status": 422,
					"data": {"message": "Invalid frame transform"}
				}
			)
			_commands.erase(id)
			return
		var position := Vector3(
			command.get("x", NAN) as float,
			command.get("y", NAN) as float,
			command.get("z", -1.94) as float
		)
		var reason := Market.validate_position(
			position,
			_players[id].camera.global_position,
			_players[id],
			false,
			str(command.get("surfaceId", "demo-board")),
			command.get("yaw", 0.0) as float
		)
		if not reason.is_empty():
			_command_result.rpc_id(
				id,
				{"requestId": command.get("requestId"), "status": 422, "data": {"message": reason}}
			)
			_commands.erase(id)
			return
		payload.merge(
			{
				"worldId": "demo_store",
				"surfaceId": str(command.get("surfaceId", "demo-board")),
				"x": position.x,
				"y": position.y,
				"z": position.z,
				"yaw": command.get("yaw", 0.0) as float
			}
		)
	elif op == "remove":
		payload.merge(
			{"placementId": command.get("placementId"), "revision": command.get("revision")}
		)
	else:
		_commands.erase(id)
		return
	_validated_commands[id] = {
		"command": command.duplicate(true), "payload": payload.duplicate(true)
	}
	var result := await Api.request("/api/market/server/" + op, "POST", payload, true)
	result["requestId"] = command.get("requestId")
	if _identities.has(id) and str(_identities[id].sessionId) == sid:
		_command_result.rpc_id(id, result)
	_commands.erase(id)
	if (result.status as int) == 200:
		Market.poll_world()


@rpc("authority", "reliable")
func _command_result(result: Dictionary) -> void:
	if not result.get("requestId") is String:
		connection_error.emit(
			"Game server is out of date. Rebuild and restart the dedicated server, then reconnect."
		)
		return
	if (result.get("status", 0) as int) == 401:
		Api.session_ended.emit()
		return
	placement_result.emit(result)


@rpc("authority", "reliable")
func world_snapshot(data: Dictionary) -> void:
	if _world_ready:
		Market.apply_snapshot(data)


func broadcast_snapshot(data: Dictionary) -> void:
	for id: int in _identities:
		if admitted(id) and (_identities[id].ready as bool):
			world_snapshot.rpc_id(id, data)


@rpc("authority", "reliable")
func _spawn_player(peer_id: int, spawn_position: Vector3, display_name: String) -> void:
	_spawn_player_local(peer_id, spawn_position, display_name)


func _spawn_player_local(peer_id: int, spawn_position: Vector3, display_name: String) -> void:
	var world := get_tree().current_scene
	if world == null or world.name != "DemoStore":
		var pending_spawn := PlayerSpawn.new()
		pending_spawn.peer_id = peer_id
		pending_spawn.position = spawn_position
		pending_spawn.display_name = display_name
		_pending_spawns.append(pending_spawn)
		return

	var node_name := "%s%s" % [PLAYER_NODE_PREFIX, peer_id]
	if world.has_node(NodePath(node_name)):
		return
	var player := PLAYER_SCENE.instantiate() as PlayerController
	player.name = node_name
	player.display_name = display_name
	world.add_child(player)
	player.global_position = spawn_position
	player.set_controlling_peer(peer_id)
	if multiplayer.is_server():
		_players[peer_id] = player


@rpc("authority", "reliable")
func _despawn_player(peer_id: int) -> void:
	_despawn_player_local(peer_id)


func _despawn_player_local(peer_id: int) -> void:
	_players.erase(peer_id)
	var remaining_spawns: Array[PlayerSpawn] = []
	for pending_spawn in _pending_spawns:
		if pending_spawn.peer_id != peer_id:
			remaining_spawns.append(pending_spawn)
	_pending_spawns = remaining_spawns
	var world := get_tree().current_scene
	if world == null or world.name != "DemoStore":
		return
	var player := world.get_node_or_null(NodePath("%s%s" % [PLAYER_NODE_PREFIX, peer_id]))
	if player != null:
		player.queue_free()
