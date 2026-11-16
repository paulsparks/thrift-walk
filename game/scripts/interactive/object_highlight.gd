class_name ObjectHighlight
extends RefCounted
## Adds or removes a white highlight without requiring a material override in
## the scene. Call ObjectHighlight.set_enabled(your_node, true/false).

const HIGHLIGHT_SHADER := preload("res://resources/shaders/highlight.gdshader")
const STATE_META := &"object_highlight_state"


static func set_enabled(
	target: Node,
	enabled: bool,
) -> void:
	for mesh_instance in _find_mesh_instances(target):
		if enabled:
			_enable_on_mesh(mesh_instance)
		else:
			_disable_on_mesh(mesh_instance)


static func _find_mesh_instances(target: Node) -> Array[MeshInstance3D]:
	var meshes: Array[MeshInstance3D] = []
	if target is MeshInstance3D:
		meshes.append(target)
	for child in target.find_children("*", "MeshInstance3D", true, false):
		meshes.append(child as MeshInstance3D)
	return meshes


static func _enable_on_mesh(mesh_instance: MeshInstance3D) -> void:
	if mesh_instance.has_meta(STATE_META):
		return

	if mesh_instance.mesh == null:
		return

	var original_overrides: Array = []
	for surface in mesh_instance.mesh.get_surface_count():
		original_overrides.append(mesh_instance.get_surface_override_material(surface))
		var source_material := mesh_instance.get_active_material(surface)
		if source_material == null:
			# Meshes without a material render with Godot's default white material.
			# Use an equivalent local material so they can be highlighted too.
			source_material = StandardMaterial3D.new()

		var material_copy := source_material.duplicate() as Material
		var highlight_material := ShaderMaterial.new()
		highlight_material.shader = HIGHLIGHT_SHADER
		material_copy.next_pass = highlight_material
		mesh_instance.set_surface_override_material(surface, material_copy)

	mesh_instance.set_meta(STATE_META, {
		"original_overrides": original_overrides,
	})


static func _disable_on_mesh(mesh_instance: MeshInstance3D) -> void:
	if not mesh_instance.has_meta(STATE_META):
		return

	var state := mesh_instance.get_meta(STATE_META) as Dictionary
	var original_overrides: Array = state["original_overrides"]
	for surface in original_overrides.size():
		var original_material := original_overrides[surface] as Material
		mesh_instance.set_surface_override_material(surface, original_material)
	mesh_instance.remove_meta(STATE_META)
