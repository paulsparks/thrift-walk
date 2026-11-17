class_name ProductFrame
extends StaticBody3D
var data: Dictionary = {}
var _image_id := ""
@onready var picture: MeshInstance3D = $Picture
@onready var interaction: InteractComponent = $InteractComponent


func _ready() -> void:
	connect("triggered", _inspect)


func update_data(next: Dictionary) -> void:
	data = next
	position = Vector3(data.x as float, data.y as float, data.z as float)
	interaction.tooltip = str(data.name)
	if Context.object == self:
		Context.tooltip = interaction.tooltip
	var image_id := str(data.get("imageAssetId", ""))
	if image_id != _image_id:
		_image_id = image_id
		_load_image(image_id)


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
