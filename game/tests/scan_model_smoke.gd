extends Node3D
## No backend or GPU needed: exercise GLB decoding and the normal item trigger.
var _failed := false


func _ready() -> void:
	# Include translated, nested meshes to catch incorrect world/local bounds.
	var source := Node3D.new()
	var nested := Node3D.new()
	nested.position = Vector3(20, -4, 12)
	source.add_child(nested)
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(2, 6, 3)
	var arrays := box.get_mesh_arrays()
	var colors := PackedColorArray()
	colors.resize((arrays[Mesh.ARRAY_VERTEX] as PackedVector3Array).size())
	colors.fill(Color(0.2, 0.6, 0.3))
	arrays[Mesh.ARRAY_COLOR] = colors
	var colored_mesh := ArrayMesh.new()
	colored_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.mesh = colored_mesh
	mesh.rotation.y = 0.4
	nested.add_child(mesh)
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	check(document.append_from_scene(source, state) == OK, "export fixture")
	var model := ScanModel.from_glb(document.generate_buffer(state))
	source.free()
	check(model != null, "decode GLB")
	if model == null:
		get_tree().quit(1)
		return
	var bounds := AABB()
	var first := true
	for child: MeshInstance3D in model.get_children():
		var material := child.get_active_material(0) as BaseMaterial3D
		check(
			material != null and material.vertex_color_use_as_albedo,
			"material-less GLB preserves vertex colors"
		)
		var current: AABB = child.transform * child.get_aabb()
		bounds = current if first else bounds.merge(current)
		first = false
	check(
		bounds.size.x <= 0.601 and bounds.size.y <= 0.801 and bounds.size.z <= 0.601,
		"model fits placement bounds"
	)
	check(
		absf(bounds.get_center().x) < 0.001 and absf(bounds.get_center().z) < 0.001,
		"model centered on item"
	)
	check(absf(bounds.position.y) < 0.001, "model base rests on tabletop")
	var packed := PackedScene.new()
	check(packed.pack(model) == OK, "cache model")
	model.free()
	Market._models["fixture"] = packed
	var frame := (
		preload("res://scenes/objects/store/product_frame.tscn").instantiate() as ProductFrame
	)
	add_child(frame)
	var entry := {
		"id": "test-placement",
		"itemId": "test-item",
		"name": "Scanned chair",
		"details": "A scan",
		"storeName": "Test store",
		"externalUrl": null,
		"x": 0.0,
		"y": 0.9,
		"z": 2.4,
		"surfaceId": "lobby-table",
		"imageAssetId": null,
		"scanJobId": "fixture",
	}
	frame.update_data(entry)
	check(not frame.backing.visible and not frame.picture.visible, "no frame for scans")
	check(is_instance_valid(frame._model), "model attached")
	check(frame.interaction.tooltip == "Scanned chair", "normal item tooltip")
	check(
		frame.has_signal("triggered") and frame.is_connected("triggered", frame._inspect),
		"normal inspect trigger"
	)
	check(
		is_equal_approx((frame.collider.shape as BoxShape3D).size.z, 0.6),
		"model interaction volume"
	)
	Market.placements[entry.id] = entry
	frame.emit_signal("triggered")
	check(str(AppUI._details.get("itemId")) == "test-item", "trigger opens item details")
	Market.begin({"id": "test-item", "scanJobId": "fixture"})
	check(
		Market._preview.mesh == null and Market._preview.get_child_count() == 1,
		"model preview has no frame"
	)
	var wheel := InputEventMouseButton.new()
	wheel.pressed = true
	wheel.button_index = MOUSE_BUTTON_WHEEL_UP
	Market._unhandled_input(wheel)
	check(
		is_equal_approx(Market._preview.rotation.y, PI / 12.0), "scroll rotates placement preview"
	)
	entry.yaw = Market._yaw
	frame.update_data(entry)
	check(is_equal_approx(frame.rotation.y, PI / 12.0), "saved snapshot restores model rotation")
	wheel.button_index = MOUSE_BUTTON_WHEEL_DOWN
	Market._unhandled_input(wheel)
	check(is_zero_approx(Market._yaw), "reverse scroll reverses rotation")
	Market.cancel()
	entry.scanJobId = null
	entry.yaw = 0.0
	frame.update_data(entry)
	check(frame.backing.visible and frame.picture.visible, "switch back to image frame")
	check(frame._model == null, "old model removed")
	check(
		is_equal_approx((frame.collider.shape as BoxShape3D).size.z, 0.06),
		"image interaction volume restored"
	)
	# Exercise the actual scene's tabletop, bounds, reach, occlusion and overlap.
	Market.set_process(false)
	Market.placements.clear()
	var lobby := preload("res://scenes/maps/demo_store.tscn").instantiate()
	for surface_name: String in ["LobbyTable", "SharedDisplayWall"]:
		var surface := lobby.get_node(NodePath(surface_name))
		surface.owner = null
		surface.reparent(self, false)
	lobby.free()
	await get_tree().physics_frame
	await get_tree().physics_frame
	var tabletop := Vector3(0, 0.9, 2.4)
	var eye := Vector3(0, 1.6, 1.0)
	check(
		Market.validate_position(tabletop, eye, null, true, "lobby-table").is_empty(),
		"table accepts model position"
	)
	check(
		not (
			Market
			. validate_position(Vector3(1.6, 0.9, 2.4), eye, null, true, "lobby-table")
			. is_empty()
		),
		"table rejects overhang"
	)
	check(
		not Market.validate_position(tabletop, eye, null, true, "demo-board").is_empty(),
		"wall rejects table coordinates"
	)
	check(
		not (
			Market
			. validate_position(Vector3(1.5, 0.9, 2.4), eye, null, true, "lobby-table", PI / 4.0)
			. is_empty()
		),
		"rotation cannot overhang table edge"
	)
	Market.placements["occupied"] = {"surfaceId": "lobby-table", "x": 0.0, "y": 0.9, "z": 2.4}
	check(
		(
			Market.validate_position(tabletop, eye, null, true, "lobby-table")
			== "That space is occupied"
		),
		"table checks X/Z overlap"
	)
	check(
		Market.validate_position(Vector3(0, 1.5, -1.94), Vector3(0, 1.5, -0.5)).is_empty(),
		"table does not block wall slots"
	)
	frame.queue_free()
	await get_tree().process_frame
	print("SCAN_MODEL_SMOKE_PASS" if not _failed else "SCAN_MODEL_SMOKE_FAIL")
	get_tree().quit(1 if _failed else 0)


func check(ok: bool, description: String) -> void:
	if not ok:
		_failed = true
		push_error(description)
