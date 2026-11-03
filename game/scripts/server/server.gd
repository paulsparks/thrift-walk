extends Node

const PORT := 8080
const SERVER_HOST := "localhost"
const PLAYER_SCENE := preload("res://objects/player.tscn")
const PLAYER_NODE_PREFIX := "Player_"


class PlayerSpawn:
	var peer_id: int
	var position: Vector3


var _players: Dictionary[int, PlayerController] = {}
var _pending_spawns: Array[PlayerSpawn] = []


func _ready() -> void:
	if OS.has_feature("dedicated_server"):
		_start_server()
	else:
		_join_server()


func _join_server() -> void:
	var peer := WebSocketMultiplayerPeer.new()
	var err := peer.create_client("ws://%s:%s" % [SERVER_HOST, PORT])
	if err != OK:
		push_error("Failed to create multiplayer client: %s" % err)
		return

	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)
	multiplayer.server_disconnected.connect(_on_server_disconnected)
	multiplayer.multiplayer_peer = peer


func _on_connected_to_server() -> void:
	print("Connected to server")


func _on_connection_failed() -> void:
	print("Failed to connect to server")


func _on_server_disconnected() -> void:
	print("Server disconnected")


func _start_server() -> void:
	var peer := WebSocketMultiplayerPeer.new()
	var err := peer.create_server(PORT)

	if err != OK:
		push_error("Failed to start server: %s" % err)
		get_tree().quit(1)
		return

	multiplayer.multiplayer_peer = peer
	print("Server started on port %s" % PORT)

	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)

	# Run the world scene here if this is a main menu.


func _on_peer_connected(id: int) -> void:
	print("Peer connected: ", id)
	# A late-joining client must receive every existing player before it gets its
	# own. The client queues these RPCs until its world scene is ready.
	for peer_id in _players:
		var player: PlayerController = _players[peer_id]
		_spawn_player.rpc_id(id, player.controlling_peer_id, player.global_position)

	var spawn_position := Vector3(float(_players.size()) * 2.0, 1.0, 0.0)
	_spawn_player_local(id, spawn_position)
	_spawn_player.rpc(id, spawn_position)


func _on_peer_disconnected(id: int) -> void:
	print("Peer disconnected: ", id)
	_despawn_player_local(id)
	_despawn_player.rpc(id)


func _process(_delta: float) -> void:
	if _pending_spawns.is_empty() or get_tree().current_scene == null:
		return
	var spawns := _pending_spawns
	_pending_spawns.clear()
	for spawn in spawns:
		_spawn_player_local(spawn.peer_id, spawn.position)


@rpc("authority", "reliable")
func _spawn_player(peer_id: int, spawn_position: Vector3) -> void:
	_spawn_player_local(peer_id, spawn_position)


func _spawn_player_local(peer_id: int, spawn_position: Vector3) -> void:
	var world := get_tree().current_scene
	if world == null:
		var pending_spawn := PlayerSpawn.new()
		pending_spawn.peer_id = peer_id
		pending_spawn.position = spawn_position
		_pending_spawns.append(pending_spawn)
		return

	var node_name := "%s%s" % [PLAYER_NODE_PREFIX, peer_id]
	if world.has_node(NodePath(node_name)):
		return
	var player := PLAYER_SCENE.instantiate() as PlayerController
	player.name = node_name
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
	if world == null:
		return
	var player := world.get_node_or_null(NodePath("%s%s" % [PLAYER_NODE_PREFIX, peer_id]))
	if player != null:
		player.queue_free()
