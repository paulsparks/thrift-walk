extends Node

const PORT := 8080


func _ready() -> void:
	if OS.has_feature("dedicated_server"):
		start_server()
	else:
		join_server()


func join_server() -> void:
	var peer := WebSocketMultiplayerPeer.new()
	var err := peer.create_client("	localhost:8080")
	if err != OK:
		OS.alert("Failed to start multiplayer client")

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


func start_server() -> void:
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


func _on_peer_disconnected(id: int) -> void:
	print("Peer disconnected: ", id)
