class_name ScanModel
extends RefCounted
## Runtime scans contain only visual meshes; interaction belongs to the item.
const DISPLAY_SIZE := Vector3(0.6, 0.8, 0.6)


static func from_glb(bytes: PackedByteArray) -> Node3D:
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	if document.append_from_buffer(bytes, "", state) != OK:
		return null
	var imported := document.generate_scene(state)
	if imported == null:
		return null
	var model := Node3D.new()
	_copy_meshes(imported, Transform3D.IDENTITY, model)
	imported.free()
	if model.get_child_count() == 0:
		model.free()
		return null
	var bounds := AABB()
	var first := true
	for mesh: MeshInstance3D in model.get_children():
		var box: AABB = mesh.transform * mesh.get_aabb()
		bounds = box if first else bounds.merge(box)
		first = false
	if not bounds.position.is_finite() or not bounds.size.is_finite():
		model.free()
		return null
	var largest := maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	if largest <= 0.000001:
		model.free()
		return null
	var factor := minf(
		DISPLAY_SIZE.x / maxf(bounds.size.x, 0.000001),
		minf(
			DISPLAY_SIZE.y / maxf(bounds.size.y, 0.000001),
			DISPLAY_SIZE.z / maxf(bounds.size.z, 0.000001)
		)
	)
	# Center X/Z on the placement point and rest the base on the tabletop.
	var offset := -bounds.get_center() * factor
	offset.y += bounds.size.y * factor / 2.0
	var fit := Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * factor), offset)
	for mesh: MeshInstance3D in model.get_children():
		mesh.transform = fit * mesh.transform
	return model


static func _copy_meshes(node: Node, parent_transform: Transform3D, target: Node3D) -> void:
	var transform := parent_transform
	if node is Node3D:
		transform = parent_transform * (node as Node3D).transform
	if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
		var source := node as MeshInstance3D
		var visual := MeshInstance3D.new()
		visual.mesh = source.mesh
		visual.transform = transform
		for surface in source.mesh.get_surface_count():
			# COLOR_0 multiplies the glTF base color, even without a material.
			# Godot may supply a default material that doesn't enable it.
			var material := source.get_active_material(surface)
			if material == null:
				material = StandardMaterial3D.new()
			var arrays := source.mesh.surface_get_arrays(surface)
			if (
				not arrays.is_empty()
				and arrays[Mesh.ARRAY_COLOR] != null
				and material is BaseMaterial3D
			):
				var colored := material.duplicate() as BaseMaterial3D
				colored.vertex_color_use_as_albedo = true
				material = colored
			visual.set_surface_override_material(surface, material)
		target.add_child(visual)
		visual.owner = target
	for child in node.get_children():
		_copy_meshes(child, transform, target)
