extends Node


func _ready() -> void:
	await get_tree().process_frame
	multiplayer.connected_to_server.disconnect(Server._on_connected)
	var peer := WebSocketMultiplayerPeer.new()
	var url := OS.get_environment("THRIFT_GAME_URL")
	assert(peer.create_client(url) == OK)
	multiplayer.multiplayer_peer = peer
	await multiplayer.connected_to_server
	# Ready and placement RPCs without admission must have no effect.
	Server._client_ready.rpc_id(1)
	Server._command.rpc_id(
		1, {"op": "place", "userId": "forged-user", "itemId": "forged-item", "x": 0.0, "y": 2.3}
	)
	await get_tree().create_timer(1).timeout
	assert(get_tree().current_scene.find_children("Player_*", "", false, false).is_empty())
	Server._admit.rpc_id(1, "0".repeat(64))
	await get_tree().create_timer(2).timeout
	assert(peer.get_connection_status() != MultiplayerPeer.CONNECTION_CONNECTED)
	print("UNAUTHENTICATED_PEER_PASS")
	get_tree().quit()
