class_name ProductFrame
extends StaticBody3D
var data: Dictionary = {}
var _image_id := ""
var _scan_id := ""
var _model: Node3D
var _load_version := 0
@onready var backing: MeshInstance3D = $Frame
@onready var collider: CollisionShape3D = $CollisionShape3D
@onready var picture: MeshInstance3D = $Picture
@onready var interaction: InteractComponent = $InteractComponent


func _ready() -> void:
	connect("triggered", _inspect)


func update_data(next: Dictionary) -> void:
	data = next
	position = Vector3(data.x as float, data.y as float, data.z as float)
	rotation.y = (data.get("yaw", 0.0) as float)
	interaction.tooltip = str(data.name)
	if Context.object == self:
		Context.tooltip = interaction.tooltip
	var scan_id := str(data.scanJobId) if data.get("scanJobId") != null else ""
	var image_id := str(data.imageAssetId) if data.get("imageAssetId") != null else ""
	var is_model := not scan_id.is_empty()
	backing.visible = not is_model
	picture.visible = not is_model
	var shape := BoxShape3D.new()
	shape.size = ScanModel.DISPLAY_SIZE if is_model else Vector3(0.6, 0.8, 0.06)
	collider.shape = shape
	collider.position = Vector3(0, 0.4, 0) if is_model else Vector3.ZERO
	if scan_id != _scan_id or image_id != _image_id:
		_scan_id = scan_id
		_image_id = image_id
		_load_version += 1
		if is_instance_valid(_model):
			_model.queue_free()
		_model = null
		if is_model:
			_load_model(scan_id, _load_version)
		else:
			_load_image(image_id)


func _load_model(id: String, version: int) -> void:
	if Server.is_dedicated():
		return
	var loaded := await Market.model(id)
	if version != _load_version or not is_inside_tree():
		if loaded != null:
			loaded.free()
		return
	if loaded == null:
		# Keep the normal item trigger usable even if the download fails.
		var message := Label3D.new()
		message.text = "Model unavailable"
		message.font_size = 24
		message.position.z = 0.1
		_model = message
	else:
		_model = loaded
	add_child(_model)


func _inspect() -> void:
	AppUI.show_details(data)


func _load_image(id: String) -> void:
	if Server.is_dedicated():
		return
	var texture := await Market.texture(id)
	if id != _image_id or not is_inside_tree():
		return
	var material := StandardMaterial3D.new()
	material.albedo_texture = texture
	material.albedo_color = Color.WHITE if texture else Color("e5d7ba")
	picture.material_override = material


func _exit_tree() -> void:
	if Context.object == self:
		Context.object = null
		Context.tooltip = ""
